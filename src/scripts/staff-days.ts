import "dotenv/config";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema as s } from "../db";
import { addDays, eachDate, isoWeekday, localParts } from "../lib/attendance/time";

// Pakai: npm run staff-days -- 2026-07-13 2026-10-31
// Menampilkan, untuk tiap guru, persen minggu yang ia scan pada tiap hari (Sen-Sab),
// lalu USULAN perintah workdays. Cocokkan dengan jadwal mengajar sebenarnya sebelum dijalankan.
const THRESHOLD = 50;
const NAMA = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

async function main() {
  const from = process.argv[2] ?? "2026-07-13";
  const to = process.argv[3] ?? localParts(new Date()).date;

  const staff = await db.select({ pin: s.people.devicePin, name: s.people.name }).from(s.people)
    .where(and(eq(s.people.type, "staff"), eq(s.people.status, "active")));
  const cal = await db.select({ date: s.calendarDays.date, audience: s.calendarDays.audience }).from(s.calendarDays)
    .where(and(gte(s.calendarDays.date, from), lte(s.calendarDays.date, to), eq(s.calendarDays.scopeType, "school"), eq(s.calendarDays.kind, "non_effective")));
  const off = new Set(cal.filter((c) => c.audience !== "student").map((c) => c.date));

  const logs = await db.select({ pin: s.rawLogs.devicePin, at: s.rawLogs.punchedAt }).from(s.rawLogs)
    .where(and(gte(s.rawLogs.punchedAt, new Date(`${addDays(from, -1)}T00:00:00Z`)), lte(s.rawLogs.punchedAt, new Date(`${addDays(to, 2)}T00:00:00Z`))));
  const scanned = new Map<string, Set<string>>();
  for (const l of logs) scanned.set(l.pin, (scanned.get(l.pin) ?? new Set()).add(localParts(l.at).date));

  const days = eachDate(from, to).filter((d) => isoWeekday(d) !== 7 && !off.has(d));
  const table: Record<string, string>[] = [];
  const suggestions: string[] = [];
  for (const t of staff) {
    const mine = scanned.get(t.pin!) ?? new Set<string>();
    const row: Record<string, string> = { pin: t.pin!, nama: t.name.slice(0, 22) };
    const pick: number[] = [];
    for (let wd = 1; wd <= 6; wd++) {
      const ds = days.filter((d) => isoWeekday(d) === wd);
      const pct = ds.length ? Math.round((ds.filter((d) => mine.has(d)).length / ds.length) * 100) : 0;
      row[NAMA[wd - 1]] = `${pct}%`;
      if (pct >= THRESHOLD) pick.push(wd);
    }
    table.push(row);
    suggestions.push(pick.length ? `npm run workdays -- ${pick.join(",")} ${t.pin}   # ${t.name}` : `# ${t.pin} ${t.name}: tidak ada hari >= ${THRESHOLD}%, cek manual (mungkin tidak wajib scan)`);
  }
  console.log(`\nHari kerja dihitung: ${days.length} (Sen-Sab, tanpa libur sekolah). Ambang usulan: ${THRESHOLD}%.\n`);
  console.table(table);
  console.log("USULAN (cocokkan dengan jadwal asli sebelum dijalankan):\n" + suggestions.join("\n"));
}
main().catch((e) => { console.error(e); process.exit(1); });
