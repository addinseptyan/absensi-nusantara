import { and, asc, eq, max } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { dailyRows } from "./daily";
import { localParts } from "./time";

type Count = { total: number; hadir: number; terlambat: number; izinSakit: number; alpa: number; pkl: number; libur: number; belum: number };
const blank = (): Count => ({ total: 0, hadir: 0, terlambat: 0, izinSakit: 0, alpa: 0, pkl: 0, libur: 0, belum: 0 });
function bump(c: Count, status: string | null) {
  c.total++;
  if (status === "hadir" || status === "dispensasi") c.hadir++;
  else if (status === "terlambat") c.terlambat++;
  else if (status === "izin" || status === "sakit") c.izinSakit++;
  else if (status === "alpa") c.alpa++;
  else if (status === "pkl") c.pkl++;
  else if (status === "libur") c.libur++;
  else c.belum++;
}
/** Ringkasan kehadiran siswa hari ini per kelas. Hanya angka, TANPA nama siswa. */
export async function getTodayOverview() {
  const date = localParts(new Date()).date;
  const classes = await db.select({ id: s.classes.id, name: s.classes.name }).from(s.classes)
    .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true))).orderBy(asc(s.classes.name));
  const rows = await dailyRows(date, classes.map((c) => c.id));
  const [{ synced }] = await db.select({ synced: max(s.syncRuns.finishedAt) }).from(s.syncRuns).where(eq(s.syncRuns.status, "success"));
  const total = blank(), per = new Map<string, Count>();
  for (const r of rows) { bump(total, r.status); const c = per.get(r.className) ?? blank(); bump(c, r.status); per.set(r.className, c); }
  return { date, total, perClass: [...per].map(([name, c]) => ({ name, ...c })), syncedAt: synced ? new Date(synced) : null };
}
export const required = (c: Count) => c.total - c.pkl - c.libur;
