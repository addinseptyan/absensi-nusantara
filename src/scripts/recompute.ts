import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema as s } from "../db";
import { recompute } from "../lib/attendance/recompute";
import { localParts } from "../lib/attendance/time";

// Pakai: npm run recompute            (dari awal tahun ajaran aktif sampai hari ini)
//        npm run recompute -- 2026-10-01 2026-10-31
async function main() {
  const [ay] = await db.select().from(s.academicYears).where(eq(s.academicYears.isActive, true));
  if (!ay) throw new Error("Belum ada tahun ajaran aktif. Jalankan npm run db:import.");
  const from = process.argv[2] ?? ay.startDate;
  const to = process.argv[3] ?? localParts(new Date()).date;
  console.log(`Menghitung ulang ${from} s/d ${to} (tahun ajaran ${ay.name})...`);
  const r = await recompute(from, to);
  console.log(`\nSelesai: ${r.rows} baris. Sync sukses terakhir: ${r.syncedAt ? r.syncedAt.toISOString() : "BELUM ADA (semua hari jadi belum_ada_data)"}`);
  console.table(r.byStatus);
  console.log("Per jenis (student = siswa, staff = guru/pegawai):");
  console.table(r.byType);
  if (r.studentsWithoutClass.length) console.log(`Siswa tanpa kelas (dilewati): ${r.studentsWithoutClass.join(", ")}`);
  if (r.lockedDays) console.log(`${r.lockedDays} hari dilewati karena periodenya dikunci.`);
  if (r.noScanDates.length) {
    console.log(`\nTanggal tanpa scan sama sekali dari siapa pun (kemungkinan LIBUR, saat ini dihitung alpa):\n  ${r.noScanDates.join(", ")}`);
    console.log(`Jika memang libur, tambahkan: npm run calendar -- <dari> <sampai> non_effective "Alasan"`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
