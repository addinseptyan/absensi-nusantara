import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { can } from "@/lib/permissions";
import { findCalendarEntry } from "./engine";
import { visibleClasses } from "./summary";
import { isoWeekday, localParts, toMinutes } from "./time";

type User = { personId: number | null; permissions: string[] };

/** Detail harian satu siswa atau guru. Null jika tidak ada atau pengguna tidak berhak melihatnya. */
export async function getPersonDetail(user: User, personId: number, from: string, to: string, yearId?: number) {
  const [p] = await db.select({ id: s.people.id, name: s.people.name, titlePrefix: s.people.titlePrefix, titleSuffix: s.people.titleSuffix, type: s.people.type })
    .from(s.people).where(eq(s.people.id, personId));
  if (!p) return null;

  let cls: { classId: number; className: string; grade: "X" | "XI" | "XII" } | null = null;
  if (p.type === "student") {
    const [row] = await db.select({ classId: s.classes.id, className: s.classes.name, grade: s.classes.grade }).from(s.classEnrollments)
      .innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
      .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), yearId ? eq(s.academicYears.id, yearId) : eq(s.academicYears.isActive, true)))
      .where(eq(s.classEnrollments.personId, personId));
    if (!row || !(await visibleClasses(user, yearId)).some((c) => c.id === row.classId)) return null;
    cls = row;
  } else if (!(can(user.permissions, "rekap.view_all") || (can(user.permissions, "rekap.view_self") && user.personId === p.id))) {
    return null;
  }

  const [days, leaves, ruleDays, calendar] = await Promise.all([
    db.select().from(s.attendanceDaily).where(and(eq(s.attendanceDaily.personId, personId), gte(s.attendanceDaily.date, from), lte(s.attendanceDaily.date, to))).orderBy(asc(s.attendanceDaily.date)),
    db.select().from(s.leaves).where(and(eq(s.leaves.personId, personId), lte(s.leaves.startDate, to), gte(s.leaves.endDate, from))),
    db.select().from(s.rulePeriodDays),
    db.select().from(s.calendarDays).where(and(gte(s.calendarDays.date, from), lte(s.calendarDays.date, to))),
  ]);

  const rows = days.map((d) => {
    const rule = ruleDays.find((r) => r.rulePeriodId === d.rulePeriodId && r.weekday === isoWeekday(d.date));
    const lateMin = d.status === "terlambat" && d.checkIn && rule?.checkIn ? Math.max(0, localParts(d.checkIn).minutes - toMinutes(rule.checkIn)) : null;
    const leave = leaves.find((l) => l.startDate <= d.date && l.endDate >= d.date);
    const entry = findCalendarEntry(calendar, d.date, p.type, cls?.grade, cls?.classId);
    const calNote = d.status === "libur"
      ? (entry?.reason ?? (isoWeekday(d.date) === 7 ? "Hari Minggu" : p.type === "staff" ? "Bukan hari wajib hadir" : "Bukan hari sekolah"))
      : entry?.kind === "effective" ? `Catatan kalender: ${entry.reason}` : null;
    return { ...d, calNote, lateMin, leaveNote: leave ? [leave.type, leave.note].filter(Boolean).join(": ") : null };
  });
  return { person: { ...p, className: cls?.className ?? null, classId: cls?.classId ?? null }, rows };
}

/** Keterangan gabungan satu baris (dipakai halaman rincian dan export). */
export function rowNotes(r: { calNote?: string | null; lateMin?: number | null; noCheckOut: boolean; leftEarly: boolean; excusedExit: boolean; leaveNote?: string | null; isManual: boolean; note: string | null }) {
  return [r.calNote, r.lateMin ? `terlambat ${r.lateMin} menit` : null, r.noCheckOut ? "tidak absen pulang" : null, r.leftEarly ? "pulang awal" : null,
    r.excusedExit ? "izin keluar" : null, r.leaveNote, r.isManual ? `dikoreksi: ${r.note ?? ""}` : null].filter(Boolean) as string[];
}
