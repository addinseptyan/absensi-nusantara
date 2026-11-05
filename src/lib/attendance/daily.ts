import { and, asc, eq, inArray, lte, gte } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { can } from "@/lib/permissions";

/** Status satu hari untuk semua siswa aktif di kelas-kelas tertentu (termasuk yang belum punya baris rekap). */
export function dailyRows(date: string, classIds: number[]) {
   if (!classIds.length) return Promise.resolve([]);
   return db.select({
      personId: s.people.id, name: s.people.name, className: s.classes.name,
      status: s.attendanceDaily.status, checkIn: s.attendanceDaily.checkIn, checkOut: s.attendanceDaily.checkOut,
      isManual: s.attendanceDaily.isManual, note: s.attendanceDaily.note,
      noCheckOut: s.attendanceDaily.noCheckOut, leftEarly: s.attendanceDaily.leftEarly, excusedExit: s.attendanceDaily.excusedExit,
   })
      .from(s.people)
      .innerJoin(s.classEnrollments, eq(s.classEnrollments.personId, s.people.id))
      .innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
      .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true)))
      .leftJoin(s.attendanceDaily, and(eq(s.attendanceDaily.personId, s.people.id), eq(s.attendanceDaily.date, date)))
      .where(and(eq(s.people.type, "student"), eq(s.people.status, "active"), inArray(s.classes.id, classIds)))
      .orderBy(asc(s.classes.name), asc(s.people.name));
}

/** Boleh mengoreksi? Mengembalikan "student" | "staff" agar pemanggil bisa memilih action audit yang tepat. */
export async function assertCanCorrect(user: { personId: number | null; permissions: string[] }, personId: number, date: string) {
   const [person] = await db.select({ type: s.people.type }).from(s.people).where(eq(s.people.id, personId));
   if (!person) throw new Error("Data tidak ditemukan.");

   if (person.type === "staff") {
      if (!can(user.permissions, "attendance.correct_staff")) throw new Error("Anda tidak punya izin mengoreksi kehadiran guru.");
   } else {
      const [row] = await db.select({ homeroom: s.classes.homeroomStaffId }).from(s.classEnrollments)
         .innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
         .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true)))
         .where(eq(s.classEnrollments.personId, personId));
      if (!row) throw new Error("Siswa tidak terdaftar di kelas aktif.");
      const allowed = can(user.permissions, "attendance.correct") ||
         (can(user.permissions, "leave.create_own_class") && !!user.personId && row.homeroom === user.personId);
      if (!allowed) throw new Error("Anda tidak punya izin mengoreksi siswa ini.");
   }

   const [lock] = await db.select().from(s.periodLocks).where(and(lte(s.periodLocks.startDate, date), gte(s.periodLocks.endDate, date)));
   if (lock) throw new Error("Periode ini sudah dikunci. Hubungi admin.");
   return person.type;
}

/** Status satu hari untuk semua guru/pegawai aktif (cermin dailyRows untuk siswa). */
export function staffDailyRows(date: string) {
   return db.select({
      personId: s.people.id, name: s.people.name, titlePrefix: s.people.titlePrefix, titleSuffix: s.people.titleSuffix,
      status: s.attendanceDaily.status, checkIn: s.attendanceDaily.checkIn, checkOut: s.attendanceDaily.checkOut,
      isManual: s.attendanceDaily.isManual, note: s.attendanceDaily.note,
      noCheckOut: s.attendanceDaily.noCheckOut, leftEarly: s.attendanceDaily.leftEarly, excusedExit: s.attendanceDaily.excusedExit,
   })
      .from(s.people)
      .leftJoin(s.attendanceDaily, and(eq(s.attendanceDaily.personId, s.people.id), eq(s.attendanceDaily.date, date)))
      .where(and(eq(s.people.type, "staff"), eq(s.people.status, "active")))
      .orderBy(asc(s.people.name));
}
