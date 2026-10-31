import { and, eq, gte, lte, max } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, schema as s } from "../../db";
import { computeDay, resolveCalendar, resolveRule, type PersonType } from "./engine";
import { addDays, eachDate, isoWeekday, localParts } from "./time";

type Scans = Map<string, Date[]>; // tanggal lokal -> scan
const ex = (col: string) => sql.raw(`excluded."${col}"`);
const CHUNK = 500;

/** Hitung ulang attendance_daily untuk rentang tanggal (maksimal sampai hari ini). Aman dijalankan berulang. */
export async function recompute(from: string, to: string) {
  const today = localParts(new Date()).date;
  const end = to > today ? today : to;
  const summary = { rows: 0, byStatus: {} as Record<string, number>, noScanDates: [] as string[], lockedDays: 0, studentsWithoutClass: [] as string[], syncedAt: null as Date | null };
  if (from > end) return summary;

  const [periods, ruleDays, calendar, leaves, pkls, workDayRows, locks, people, enrollments, [{ synced }]] = await Promise.all([
    db.select().from(s.rulePeriods).where(eq(s.rulePeriods.isActive, true)),
    db.select().from(s.rulePeriodDays),
    db.select().from(s.calendarDays).where(and(gte(s.calendarDays.date, from), lte(s.calendarDays.date, end))),
    db.select().from(s.leaves).where(and(lte(s.leaves.startDate, end), gte(s.leaves.endDate, from), eq(s.leaves.status, "approved"))),
    db.select().from(s.pklAssignments).where(and(lte(s.pklAssignments.startDate, end), gte(s.pklAssignments.endDate, from))),
    db.select().from(s.staffWorkDays),
    db.select().from(s.periodLocks).where(and(lte(s.periodLocks.startDate, end), gte(s.periodLocks.endDate, from))),
    db.select().from(s.people).where(eq(s.people.status, "active")),
    db.select({ personId: s.classEnrollments.personId, classId: s.classes.id, grade: s.classes.grade })
      .from(s.classEnrollments)
      .innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
      .innerJoin(s.academicYears, eq(s.academicYears.id, s.classes.academicYearId))
      .where(eq(s.academicYears.isActive, true)),
    db.select({ synced: max(s.syncRuns.finishedAt) }).from(s.syncRuns).where(eq(s.syncRuns.status, "success")),
  ]);
  const syncedAt = synced ? new Date(synced) : null;
  summary.syncedAt = syncedAt;

  // Scan mentah per PIN per tanggal lokal (margin 1 hari agar zona waktu aman)
  const logs = await db.select({ pin: s.rawLogs.devicePin, at: s.rawLogs.punchedAt }).from(s.rawLogs)
    .where(and(gte(s.rawLogs.punchedAt, new Date(`${addDays(from, -1)}T00:00:00Z`)), lte(s.rawLogs.punchedAt, new Date(`${addDays(end, 2)}T00:00:00Z`))));
  const scansByPin = new Map<string, Scans>();
  for (const l of logs) {
    const at = new Date(l.at);
    const byDate = scansByPin.get(l.pin) ?? new Map();
    const d = localParts(at).date;
    byDate.set(d, [...(byDate.get(d) ?? []), at]);
    scansByPin.set(l.pin, byDate);
  }

  const lockedDates = new Set(locks.flatMap((l) => eachDate(l.startDate > from ? l.startDate : from, l.endDate < end ? l.endDate : end)));
  const classOf = new Map(enrollments.map((e) => [e.personId, e]));
  const workDays = new Map<number, Set<number>>();
  for (const w of workDayRows) workDays.set(w.staffId, (workDays.get(w.staffId) ?? new Set()).add(w.weekday));

  const dates = eachDate(from, end);
  const scanCountByDate = new Map<string, number>();
  const rows: (typeof s.attendanceDaily.$inferInsert)[] = [];

  for (const p of people) {
    const type: PersonType = p.type;
    const enr = classOf.get(p.id);
    if (type === "student" && !enr) { summary.studentsWithoutClass.push(p.name); continue; }
    const scans = (p.devicePin && scansByPin.get(p.devicePin)) || new Map<string, Date[]>();

    for (const date of dates) {
      if (lockedDates.has(date)) { summary.lockedDays++; continue; }
      const todays = scans.get(date) ?? [];
      scanCountByDate.set(date, (scanCountByDate.get(date) ?? 0) + (todays.length ? 1 : 0));

      const cal = resolveCalendar(calendar, date, type, enr?.grade, enr?.classId);
      const required = type === "student" || (workDays.get(p.id)?.has(isoWeekday(date)) ?? false);
      const rule = resolveRule(periods, ruleDays, date, type);
      const myLeaves = leaves.filter((l) => l.personId === p.id && l.startDate <= date && l.endDate >= date);
      const fullDay = myLeaves.find((l) => l.type !== "izin_keluar");

      const r = computeDay({
        date, scans: todays, rule,
        isEffective: cal !== "non_effective" && required,
        leave: (fullDay?.type as "izin" | "sakit" | "dispensasi" | undefined) ?? null,
        exitLeave: myLeaves.some((l) => l.type === "izin_keluar"),
        pkl: pkls.some((k) => k.studentId === p.id && k.startDate <= date && k.endDate >= date),
        syncedAt,
      });
      rows.push({ personId: p.id, date, ...r, isManual: false, rulePeriodId: rule?.periodId ?? null, computedAt: new Date() });
      summary.byStatus[r.status] = (summary.byStatus[r.status] ?? 0) + 1;
    }
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(s.attendanceDaily).values(rows.slice(i, i + CHUNK)).onConflictDoUpdate({
      target: [s.attendanceDaily.personId, s.attendanceDaily.date],
      set: {
        status: ex("status"), checkIn: ex("checkIn"), checkOut: ex("checkOut"), noCheckOut: ex("noCheckOut"),
        leftEarly: ex("leftEarly"), excusedExit: ex("excusedExit"), rulePeriodId: ex("rulePeriodId"), computedAt: ex("computedAt"),
      },
      setWhere: eq(s.attendanceDaily.isManual, false), // koreksi manual tidak pernah tertimpa
    });
  }
  summary.rows = rows.length;

  // Hari kerja biasa (Sen-Sab) tanpa satu pun scan dari siapa pun: kemungkinan libur belum dimasukkan ke kalender
  summary.noScanDates = dates.filter((d) => isoWeekday(d) !== 7 && !scanCountByDate.get(d) && !lockedDates.has(d)
    && d <= (syncedAt ? localParts(syncedAt).date : end));
  return summary;
}
