"use server";
import { guard } from "@/lib/action";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const date = z.string().date().or(z.literal("")).transform((v) => v || null);
const Period = z.object({
  id: z.coerce.number().int(), name: z.string().trim().min(2).max(60), appliesTo: z.enum(["all", "student", "staff"]),
  startDate: date, endDate: date, priority: z.coerce.number().int().min(0).max(100),
  checkInWindowStart: hhmm, checkInWindowEnd: hhmm, checkOutWindowEnd: hhmm,
  onTimeGraceMin: z.coerce.number().int().min(0).max(120), checkOutEarlyMin: z.coerce.number().int().min(0).max(240), minGapBetweenScansMin: z.coerce.number().int().min(0).max(240),
});

async function savePeriod_impl(form: FormData): Promise<string> {
  const user = await requirePermission("settings.rules");
  const { id, ...p } = Period.parse(Object.fromEntries(form));
  if (p.startDate && p.endDate && p.startDate > p.endDate) throw new Error("Tanggal selesai harus setelah tanggal mulai.");
  await db.update(s.rulePeriods).set(p).where(eq(s.rulePeriods.id, id));
  for (let weekday = 1; weekday <= 7; weekday++) {
    const isSchoolDay = form.get(`d${weekday}s`) === "on";
    const checkIn = hhmm.safeParse(form.get(`d${weekday}i`)), checkOut = hhmm.safeParse(form.get(`d${weekday}o`));
    if (isSchoolDay && (!checkIn.success || !checkOut.success)) throw new Error("Hari sekolah wajib punya jam masuk dan pulang.");
    const row = { rulePeriodId: id, weekday, isSchoolDay, checkIn: isSchoolDay && checkIn.success ? checkIn.data : null, checkOut: isSchoolDay && checkOut.success ? checkOut.data : null };
    await db.insert(s.rulePeriodDays).values(row).onConflictDoUpdate({ target: [s.rulePeriodDays.rulePeriodId, s.rulePeriodDays.weekday], set: row });
  }
  await audit(user.id, "rules.update", "rule_periods", String(id), p);
  revalidatePath("/aturan");
  return "Aturan jam disimpan. Tekan Hitung ulang di halaman Rekap agar berlaku pada rekap yang sudah ada.";
}

export async function savePeriod(form: FormData) {
  return guard(() => savePeriod_impl(form));
}

async function addPeriod_impl(form: FormData): Promise<string> {
  const user = await requirePermission("settings.rules");
  const f = z.object({ name: z.string().trim().min(2).max(60), copyFrom: z.coerce.number().int(), startDate: z.string().date(), endDate: z.string().date() }).parse(Object.fromEntries(form));
  if (f.startDate > f.endDate) throw new Error("Tanggal selesai harus setelah tanggal mulai.");
  const [src] = await db.select().from(s.rulePeriods).where(eq(s.rulePeriods.id, f.copyFrom));
  const { id: _id, ...base } = src;
  const [np] = await db.insert(s.rulePeriods).values({ ...base, name: f.name, startDate: f.startDate, endDate: f.endDate, priority: src.priority + 10 }).returning({ id: s.rulePeriods.id });
  const days = await db.select().from(s.rulePeriodDays).where(eq(s.rulePeriodDays.rulePeriodId, f.copyFrom));
  await db.insert(s.rulePeriodDays).values(days.map(({ id: _d, ...d }) => ({ ...d, rulePeriodId: np.id })));
  await audit(user.id, "rules.create", "rule_periods", String(np.id), f);
  revalidatePath("/aturan");
  return "Periode ditambahkan. Atur jam masuk dan pulangnya di kartu periode baru.";
}

export async function addPeriod(form: FormData) {
  return guard(() => addPeriod_impl(form));
}

async function deletePeriod_impl(form: FormData): Promise<string> {
  const user = await requirePermission("settings.rules");
  const id = Number(form.get("id"));
  const [p] = await db.select().from(s.rulePeriods).where(eq(s.rulePeriods.id, id));
  if (!p?.startDate && !p?.endDate) throw new Error("Aturan dasar (tanpa tanggal) tidak bisa dihapus.");
  // Rekap lama hanya menyimpan rujukan ke periode ini; lepaskan dulu agar database tidak menolak penghapusan
  await db.update(s.attendanceDaily).set({ rulePeriodId: null }).where(eq(s.attendanceDaily.rulePeriodId, id));
  await db.delete(s.rulePeriods).where(eq(s.rulePeriods.id, id));
  await audit(user.id, "rules.delete", "rule_periods", String(id), { name: p.name });
  revalidatePath("/aturan");
  return "Periode dihapus. Tekan Hitung ulang di halaman Rekap untuk tanggal yang terdampak.";
}

export async function deletePeriod(form: FormData) {
  return guard(() => deletePeriod_impl(form));
}
