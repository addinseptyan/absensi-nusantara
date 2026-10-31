import "dotenv/config";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema as s } from "../db";
import { addDays, eachDate, isoWeekday, localParts } from "../lib/attendance/time";

// Pakai: npm run analyze -- 2026-07-13 2026-10-31
// Membantu menjawab: hari mana yang kemungkinan libur, siapa yang tidak pernah scan, dan seberapa banyak yang terlambat.
async function main() {
  const from = process.argv[2] ?? "2026-07-13";
  const to = process.argv[3] ?? localParts(new Date()).date;

  const stu = await db.select({ pin: s.people.devicePin, name: s.people.name, cls: s.classes.name }).from(s.people)
    .innerJoin(s.classEnrollments, eq(s.classEnrollments.personId, s.people.id))
    .innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
    .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true)))
    .where(and(eq(s.people.type, "student"), eq(s.people.status, "active")));
  const byPin = new Map(stu.map((x) => [x.pin!, x]));
  const staff = await db.select({ pin: s.people.devicePin, name: s.people.name }).from(s.people)
    .where(and(eq(s.people.type, "staff"), eq(s.people.status, "active")));
  const staffByPin = new Map(staff.map((x) => [x.pin!, x.name]));
  const staffByDate = new Map<string, Set<string>>();

  const logs = await db.select({ pin: s.rawLogs.devicePin, at: s.rawLogs.punchedAt }).from(s.rawLogs)
    .where(and(gte(s.rawLogs.punchedAt, new Date(`${addDays(from, -1)}T00:00:00Z`)), lte(s.rawLogs.punchedAt, new Date(`${addDays(to, 2)}T00:00:00Z`))));
  const byDate = new Map<string, Map<string, number[]>>(); // tanggal -> pin -> menit scan
  for (const l of logs) {
    const { date, minutes } = localParts(l.at);
    if (date < from || date > to) continue;
    if (staffByPin.has(l.pin)) { staffByDate.set(date, (staffByDate.get(date) ?? new Set()).add(staffByPin.get(l.pin)!)); continue; }
    if (!byPin.has(l.pin)) continue;
    const m = byDate.get(date) ?? new Map<string, number[]>();
    m.set(l.pin, [...(m.get(l.pin) ?? []), minutes]);
    byDate.set(date, m);
  }

  const n = stu.length, thr = Math.ceil(n * 0.3);
  const days = eachDate(from, to).filter((d) => isoWeekday(d) !== 7);
  const cnt = (d: string) => byDate.get(d)?.size ?? 0;
  const low = days.filter((d) => cnt(d) < thr);
  const good = days.filter((d) => cnt(d) >= thr);
  console.log(`\nSiswa aktif: ${n}. Hari Senin-Sabtu: ${days.length}. Ambang "ramai": minimal ${thr} siswa scan.\n`);

  console.log("=== 1. HARI SEPI (kemungkinan libur / tidak ada kegiatan) ===");
  const groups: string[][] = [];
  for (const d of low) {
    const last = groups[groups.length - 1];
    if (last && (new Date(d).getTime() - new Date(last[last.length - 1]).getTime()) / 86400000 <= 2) last.push(d);
    else groups.push([d]);
  }
  for (const g of groups) console.log(`${g[0]}${g.length > 1 ? " s/d " + g[g.length - 1] : ""}  (${g.length} hari, siswa scan per hari: ${g.map(cnt).join(",")})`);
  if (!groups.length) console.log("(tidak ada)");

  console.log("\n=== 1b. GURU/PEGAWAI YANG SCAN DI HARI SEPI ===");
  for (const d of low) { const names = [...(staffByDate.get(d) ?? [])]; console.log(`${d}: ${names.length} orang${names.length ? " - " + names.map((x) => x.split(" ")[0]).join(", ") : ""}`); }

  console.log("\n=== 2. KEHADIRAN PER BULAN (hanya hari ramai, berdasarkan scan masuk) ===");
  const months = new Map<string, { d: number; s: number }>();
  for (const d of good) { const m = d.slice(0, 7), x = months.get(m) ?? { d: 0, s: 0 }; months.set(m, { d: x.d + 1, s: x.s + cnt(d) }); }
  console.table([...months].map(([m, x]) => ({ bulan: m, hariRamai: x.d, rataSiswaScan: Math.round(x.s / x.d), persen: `${Math.round((x.s / x.d / n) * 100)}%` })));

  console.log("=== 3. PER KELAS (hari ramai) ===");
  console.table([...new Set(stu.map((x) => x.cls))].sort().map((c) => {
    const members = stu.filter((x) => x.cls === c);
    const scans = good.reduce((a, d) => a + members.filter((x) => byDate.get(d)?.has(x.pin!)).length, 0);
    return { kelas: c, siswa: members.length, persenScan: `${Math.round((scans / (members.length * good.length)) * 100)}%` };
  }));

  console.log("=== 4. SISWA YANG TIDAK PERNAH SCAN DI RENTANG INI ===");
  const never = stu.filter((x) => ![...byDate.values()].some((m) => m.has(x.pin!)));
  console.log(never.length ? never.map((x) => `${x.pin} ${x.name} (${x.cls})`).join("\n") : "(tidak ada)");

  console.log("\n=== 5. JAM SCAN MASUK PERTAMA (hari ramai, jendela 05:00-10:00) ===");
  const buckets = { "sebelum/tepat 07:00": 0, "07:01-07:05": 0, "07:06-07:15": 0, "07:16-07:30": 0, "setelah 07:30": 0 };
  for (const d of good) for (const mins of byDate.get(d)!.values()) {
    const first = Math.min(...mins.filter((m) => m >= 300 && m <= 600));
    if (!Number.isFinite(first)) continue;
    const k = first <= 420 ? "sebelum/tepat 07:00" : first <= 425 ? "07:01-07:05" : first <= 435 ? "07:06-07:15" : first <= 450 ? "07:16-07:30" : "setelah 07:30";
    buckets[k as keyof typeof buckets]++;
  }
  const tot = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
  console.table(Object.entries(buckets).map(([k, v]) => ({ waktu: k, jumlah: v, persen: `${Math.round((v / tot) * 100)}%` })));
}
main().catch((e) => { console.error(e); process.exit(1); });
