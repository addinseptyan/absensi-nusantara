import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "../db";

// Pakai: npm run wali -- "X AK=2010" "X BD=2012" ...   (nama kelas = PIN mesin wali kelas)
async function main() {
  const [ay] = await db.select().from(s.academicYears).where(eq(s.academicYears.isActive, true));
  for (const arg of process.argv.slice(2)) {
    const [cls, pin] = arg.split("=").map((x) => x.trim());
    const [c] = await db.select().from(s.classes).where(and(eq(s.classes.academicYearId, ay.id), eq(s.classes.name, cls)));
    const [t] = await db.select().from(s.people).where(and(eq(s.people.devicePin, pin), eq(s.people.type, "staff")));
    if (!c || !t) { console.log(`LEWATI "${arg}": ${!c ? "kelas" : "pegawai"} tidak ditemukan.`); continue; }
    await db.update(s.classes).set({ homeroomStaffId: t.id }).where(eq(s.classes.id, c.id));
    console.log(`${c.name}: wali kelas = ${t.name}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
