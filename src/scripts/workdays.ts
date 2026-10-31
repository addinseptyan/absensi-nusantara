import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "../db";

// Pakai: npm run workdays -- <hari> <pin...>
// Hari: 1=Senin ... 6=Sabtu.  Pin boleh rentang.
// Contoh: npm run workdays -- 1,2,3,4,5,6 2001-2012     (semua guru wajib Senin-Sabtu)
//         npm run workdays -- 1,3 2005                  (guru tertentu hanya Senin & Rabu)
//         npm run workdays -- none 1001                 (tidak wajib scan sama sekali)
// Kepala Sekolah (1001) sengaja tidak diatur = tidak wajib scan.
async function main() {
   const [daysArg, ...pinArgs] = process.argv.slice(2);
   const none = daysArg === "none"; // "none" = tidak wajib scan (hapus semua hari wajib hadir)
   const days = none ? [] : (daysArg ?? "").split(",").map(Number).filter((d) => d >= 1 && d <= 7);
   if ((!days.length && !none) || !pinArgs.length) throw new Error("Argumen kurang. Lihat contoh di bagian atas file ini.");
   const pins = pinArgs.flatMap((a) => {
      const [x, y] = a.split("-").map(Number);
      return y ? Array.from({ length: y - x + 1 }, (_, i) => String(x + i)) : [String(x)];
   });
   const staff = await db.select().from(s.people).where(and(inArray(s.people.devicePin, pins), eq(s.people.type, "staff")));
   if (!staff.length) throw new Error("Tidak ada pegawai dengan PIN tersebut.");
   const ids = staff.map((p) => p.id);
   await db.delete(s.staffWorkDays).where(inArray(s.staffWorkDays.staffId, ids));
   if (days.length) await db.insert(s.staffWorkDays).values(ids.flatMap((staffId) => days.map((weekday) => ({ staffId, weekday }))));
   console.log(none ? `${staff.length} pegawai diatur TIDAK wajib scan.` : `${staff.length} pegawai diatur wajib hadir hari: ${days.join(",")}.`, "Jalankan npm run recompute.");
}
main().catch((e) => { console.error(e); process.exit(1); });