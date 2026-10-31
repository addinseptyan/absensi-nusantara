import { and, asc, between, eq, inArray, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { can } from "@/lib/permissions";

const cnt = (status: string) =>
  sql<number>`count(*) filter (where ${s.attendanceDaily.status} = ${status})`.mapWith(Number);

/** Kelas yang boleh dilihat pengguna: semua (rekap.view_all) atau hanya kelas yang ia ampu (wali kelas). */
export async function visibleClasses(user: { personId: number | null; permissions: string[] }) {
  const base = db.select({ id: s.classes.id, name: s.classes.name }).from(s.classes)
    .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true)));
  if (can(user.permissions, "rekap.view_all")) return base.orderBy(asc(s.classes.name));
  if (!can(user.permissions, "rekap.view_own_class") || !user.personId) return [];
  return base.where(eq(s.classes.homeroomStaffId, user.personId)).orderBy(asc(s.classes.name));
}

/** Rekap per siswa pada rentang tanggal. Satu sumber untuk tampilan web dan export nanti. */
export async function studentSummary(from: string, to: string, classIds: number[]) {
  if (!classIds.length) return [];
  const rows = await db.select({
    personId: s.people.id, name: s.people.name, className: s.classes.name,
    hadir: cnt("hadir"), terlambat: cnt("terlambat"), izin: cnt("izin"), sakit: cnt("sakit"),
    dispensasi: cnt("dispensasi"), pkl: cnt("pkl"), alpa: cnt("alpa"), pending: cnt("belum_ada_data"),
  })
    .from(s.attendanceDaily)
    .innerJoin(s.people, eq(s.people.id, s.attendanceDaily.personId))
    .innerJoin(s.classEnrollments, eq(s.classEnrollments.personId, s.people.id))
    .innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
    .where(and(between(s.attendanceDaily.date, from, to), eq(s.people.type, "student"), inArray(s.classes.id, classIds)))
    .groupBy(s.people.id, s.classes.name)
    .orderBy(asc(s.classes.name), asc(s.people.name));
  return rows.map((r) => {
    const present = r.hadir + r.terlambat + r.dispensasi; // dispensasi dihitung hadir
    const effective = present + r.izin + r.sakit + r.alpa; // PKL dan libur tidak masuk penyebut
    return { ...r, present, effective, pct: effective ? Math.round((present / effective) * 1000) / 10 : null };
  });
}
