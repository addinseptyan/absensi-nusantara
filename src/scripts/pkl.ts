import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "../db";

// Pakai: npm run pkl -- <mulai> <selesai> "<tempat>" "<kelas>" ["<kelas>" ...]
// Contoh: npm run pkl -- 2026-08-31 2026-12-15 "PKL (tempat belum diisi)" "XII AK" "XII BD" "XII TKR"
// Aman diulang: data PKL dengan tanggal mulai yang sama untuk siswa tsb diganti. Setelah itu jalankan npm run recompute.
async function main() {
  const [from, to, place, ...classNames] = process.argv.slice(2);
  if (!from || !to || !place || !classNames.length) throw new Error("Argumen kurang. Lihat contoh di bagian atas file ini.");
  const students = await db.select({ id: s.people.id, name: s.people.name, cls: s.classes.name }).from(s.people)
    .innerJoin(s.classEnrollments, eq(s.classEnrollments.personId, s.people.id))
    .innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
    .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true)))
    .where(and(inArray(s.classes.name, classNames), eq(s.people.status, "active")));
  if (!students.length) throw new Error("Tidak ada siswa aktif di kelas tersebut. Cek penulisan nama kelas.");
  const ids = students.map((x) => x.id);
  await db.delete(s.pklAssignments).where(and(inArray(s.pklAssignments.studentId, ids), eq(s.pklAssignments.startDate, from)));
  await db.insert(s.pklAssignments).values(ids.map((studentId) => ({ studentId, placeName: place, startDate: from, endDate: to })));
  const per = classNames.map((c) => `${c}: ${students.filter((x) => x.cls === c).length}`).join(", ");
  console.log(`${students.length} siswa dicatat PKL ${from} s/d ${to}. (${per}). Jalankan npm run recompute.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
