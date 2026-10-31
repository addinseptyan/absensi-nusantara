import "dotenv/config";
import { db, schema as s } from "../db";
import { eachDate } from "../lib/attendance/time";

// Pakai: npm run calendar -- <dari> <sampai> <non_effective|effective> "<alasan>" [school|X|XI|XII] [all|student|staff]
// Contoh libur sekolah   : npm run calendar -- 2026-12-22 2027-01-02 non_effective "Libur semester"
// Contoh ujian kelas XII : npm run calendar -- 2027-03-08 2027-03-12 non_effective "Ujian XII, belajar di rumah" X
//                          (ulangi untuk XI)
async function main() {
  const [from, to, kind, reason, scope = "school", audience = "all"] = process.argv.slice(2);
  if (!from || !to || !["effective", "non_effective"].includes(kind) || !reason) throw new Error("Argumen kurang. Lihat contoh di bagian atas file ini.");
  const isGrade = ["X", "XI", "XII"].includes(scope);
  if (!isGrade && scope !== "school") throw new Error("Scope harus school, X, XI, atau XII.");
  const values = eachDate(from, to).map((date) => ({
    date, kind: kind as "effective" | "non_effective", reason,
    audience: audience as "all" | "student" | "staff",
    scopeType: (isGrade ? "grade" : "school") as "grade" | "school",
    grade: isGrade ? (scope as "X" | "XI" | "XII") : null,
  }));
  const res = await db.insert(s.calendarDays).values(values).onConflictDoNothing().returning({ id: s.calendarDays.id });
  console.log(`${res.length} tanggal ditambahkan (${values.length - res.length} sudah ada). Jalankan npm run recompute agar rekap diperbarui.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
