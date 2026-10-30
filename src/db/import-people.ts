import "dotenv/config";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import * as s from "./schema";

/**
 * Impor siswa & guru dari data/people.csv.
 * Aman dijalankan berulang: orang dicocokkan lewat PIN mesin (devicePin).
 *
 * Kolom CSV: pin,name,type,class,position,status
 *   type   = student | staff
 *   class  = contoh "XI-BD" (kosong untuk guru)
 *   status = active | inactive | graduated | moved
 *
 * Tahun ajaran bisa diubah lewat .env:
 *   AY_NAME=2026/2027  AY_START=2026-07-13  AY_END=2027-06-26
 */
const db = drizzle(neon(process.env.DATABASE_URL!), { schema: s });

const AY_NAME = process.env.AY_NAME ?? "2026/2027";
const AY_START = process.env.AY_START ?? "2026-07-01";
const AY_END = process.env.AY_END ?? "2027-06-30";

type Row = { pin: string; name: string; type: "student" | "staff"; class: string; position: string; status: string };

function readCsv(path: string): Row[] {
  const [head, ...lines] = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const cols = head.split(",").map((c) => c.trim());
  return lines.filter(Boolean).map((line) => {
    const v = line.split(",").map((c) => c.trim());
    return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? ""])) as Row;
  });
}

async function main() {
  const rows = readCsv("data/people.csv");
  const validStatus = ["active", "inactive", "graduated", "moved"];
  for (const r of rows) {
    if (!r.pin || !r.name || !["student", "staff"].includes(r.type)) throw new Error(`Baris tidak valid: ${JSON.stringify(r)}`);
    if (!validStatus.includes(r.status)) throw new Error(`Status salah untuk PIN ${r.pin}: ${r.status}`);
  }

  // 1. Tahun ajaran (dibuat jika belum ada, dan dijadikan aktif)
  let [ay] = await db.select().from(s.academicYears).where(eq(s.academicYears.name, AY_NAME));
  if (!ay) {
    await db.update(s.academicYears).set({ isActive: false });
    [ay] = await db
      .insert(s.academicYears)
      .values({ name: AY_NAME, startDate: AY_START, endDate: AY_END, isActive: true })
      .returning();
    console.log(`Tahun ajaran ${AY_NAME} dibuat.`);
  }

  // 2. Orang (upsert berdasarkan PIN mesin)
  const saved = await db
    .insert(s.people)
    .values(rows.map((r) => ({ devicePin: r.pin, name: r.name, type: r.type, status: r.status as never })))
    .onConflictDoUpdate({
      target: s.people.devicePin,
      set: { name: sql`excluded.name`, type: sql`excluded.type`, status: sql`excluded.status` },
    })
    .returning({ id: s.people.id, pin: s.people.devicePin });
  const personId = new Map(saved.map((p) => [p.pin!, p.id]));

  // 3. Kelas (hanya yang benar-benar ada di CSV, jadi XI-AK tidak dibuat)
  const majors = await db.select().from(s.majors);
  const majorId = new Map(majors.map((m) => [m.code, m.id]));
  const classNames = [...new Set(rows.filter((r) => r.type === "student").map((r) => r.class))];
  const classId = new Map<string, number>();
  for (const cn of classNames) {
    const [grade, code] = cn.split("-");
    if (!["X", "XI", "XII"].includes(grade) || !majorId.has(code)) throw new Error(`Kelas tidak dikenal: ${cn}`);
    const name = `${grade} ${code}`;
    const [row] = await db
      .insert(s.classes)
      .values({ academicYearId: ay.id, grade: grade as never, majorId: majorId.get(code)!, name })
      .onConflictDoUpdate({ target: [s.classes.academicYearId, s.classes.name], set: { name } })
      .returning({ id: s.classes.id });
    classId.set(cn, row.id);
  }

  // 4. Keanggotaan kelas siswa
  const enrollments = rows
    .filter((r) => r.type === "student")
    .map((r) => ({ personId: personId.get(r.pin)!, classId: classId.get(r.class)!, startDate: AY_START }));
  await db.insert(s.classEnrollments).values(enrollments).onConflictDoNothing();

  // Ringkasan + peringatan
  const students = rows.filter((r) => r.type === "student");
  console.log(`Selesai: ${rows.length - students.length} pegawai, ${students.length} siswa, ${classNames.length} kelas.`);
  for (const cn of classNames.sort()) console.log(`  ${cn}: ${students.filter((r) => r.class === cn).length} siswa`);
  const inactive = rows.filter((r) => r.status !== "active");
  console.log(`Tidak aktif: ${inactive.length}`);

  const seen = new Map<string, string[]>();
  for (const r of rows) seen.set(r.name.toLowerCase(), [...(seen.get(r.name.toLowerCase()) ?? []), r.pin]);
  for (const [n, pins] of seen) if (pins.length > 1) console.log(`PERINGATAN nama ganda "${n}": PIN ${pins.join(", ")}. Cek manual.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
