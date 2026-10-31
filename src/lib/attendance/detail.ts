import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { visibleClasses } from "./summary";
import { isoWeekday, localParts, toMinutes } from "./time";

/** Detail harian satu siswa. Mengembalikan null jika siswa tidak ada atau pengguna tidak berhak melihatnya. */
export async function getStudentDetail(user: { personId: number | null; permissions: string[] }, personId: number, from: string, to: string) {
  const [person] = await db.select({ id: s.people.id, name: s.people.name, className: s.classes.name, classId: s.classes.id }).from(s.people)
    .innerJoin(s.classEnrollments, eq(s.classEnrollments.personId, s.people.id))
    .innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
    .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true)))
    .where(and(eq(s.people.id, personId), eq(s.people.type, "student")));
  if (!person || !(await visibleClasses(user)).some((c) => c.id === person.classId)) return null;

  const [days, leaves, ruleDays] = await Promise.all([
    db.select().from(s.attendanceDaily).where(and(eq(s.attendanceDaily.personId, personId), gte(s.attendanceDaily.date, from), lte(s.attendanceDaily.date, to))).orderBy(asc(s.attendanceDaily.date)),
    db.select().from(s.leaves).where(and(eq(s.leaves.personId, personId), lte(s.leaves.startDate, to), gte(s.leaves.endDate, from))),
    db.select().from(s.rulePeriodDays),
  ]);

  const rows = days.map((d) => {
    const rule = ruleDays.find((r) => r.rulePeriodId === d.rulePeriodId && r.weekday === isoWeekday(d.date));
    const lateMin = d.status === "terlambat" && d.checkIn && rule?.checkIn ? Math.max(0, localParts(d.checkIn).minutes - toMinutes(rule.checkIn)) : null;
    const leave = leaves.find((l) => l.startDate <= d.date && l.endDate >= d.date);
    return { ...d, lateMin, leaveNote: leave ? [leave.type, leave.note].filter(Boolean).join(": ") : null };
  });
  return { person, rows };
}
