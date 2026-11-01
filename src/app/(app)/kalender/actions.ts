"use server";
import { and, between, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { guard } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";
import { recomputeCapped } from "@/lib/attendance/recompute";
import { eachDate } from "@/lib/attendance/time";

const Add = z.object({
  from: z.string().date(), to: z.string().date(), kind: z.enum(["non_effective", "effective"]),
  reason: z.string().trim().min(3, "Keterangan minimal 3 huruf.").max(120), scope: z.enum(["school", "X", "XI", "XII"]), audience: z.enum(["all", "student", "staff"]),
});
const Key = z.object({ from: z.string().date(), to: z.string().date(), reason: z.string(), scopeType: z.enum(["school", "grade", "class"]), grade: z.string(), audience: z.enum(["all", "student", "staff"]) });
type Key = z.infer<typeof Key>;

// Pembangun query dipakai bersama oleh tambah, hapus, dan ubah (DRY). Tidak di-await di sini agar bisa digabung dalam satu transaksi.
function rowsOf(f: z.infer<typeof Add>, userId: number) {
  const dates = eachDate(f.from, f.to);
  if (f.from > f.to || dates.length > 200) throw new Error("Rentang tanggal tidak valid (maksimal 200 hari).");
  const isGrade = f.scope !== "school";
  return dates.map((date) => ({
    date, kind: f.kind, reason: f.reason, audience: f.audience, createdBy: userId,
    scopeType: (isGrade ? "grade" : "school") as "grade" | "school", grade: isGrade ? (f.scope as "X" | "XI" | "XII") : null,
  }));
}
const upsert = (rows: ReturnType<typeof rowsOf>, f: z.infer<typeof Add>) => db.insert(s.calendarDays).values(rows).onConflictDoUpdate({
  target: [s.calendarDays.date, s.calendarDays.audience, s.calendarDays.scopeType, s.calendarDays.grade, s.calendarDays.classId],
  set: { kind: f.kind, reason: f.reason },
});
const removeWhere = (k: Key) => db.delete(s.calendarDays).where(and(
  between(s.calendarDays.date, k.from, k.to), eq(s.calendarDays.reason, k.reason), eq(s.calendarDays.scopeType, k.scopeType),
  eq(s.calendarDays.audience, k.audience), k.grade ? eq(s.calendarDays.grade, k.grade as "X" | "XI" | "XII") : isNull(s.calendarDays.grade),
));
const note = (re: boolean) => (re ? "Rekap sudah dihitung ulang." : "Rentangnya panjang, tekan Hitung ulang di halaman Rekap.");

export async function addEntries(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("calendar.manage");
    const f = Add.parse(Object.fromEntries(form));
    await upsert(rowsOf(f, user.id), f);
    await audit(user.id, "calendar.add", "calendar_days", `${f.from}..${f.to}`, f);
    const re = await recomputeCapped(f.from, f.to);
    revalidatePath("/kalender");
    return `Tersimpan di kalender. ${note(re)}`;
  });
}

export async function updateEntries(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("calendar.manage");
    const raw = Object.fromEntries(form) as Record<string, string>;
    const old = Key.parse({ from: raw.oFrom, to: raw.oTo, reason: raw.oReason, scopeType: raw.oScopeType, grade: raw.oGrade, audience: raw.oAudience });
    const f = Add.parse(raw);
    await db.batch([removeWhere(old), upsert(rowsOf(f, user.id), f)]); // hapus lama + simpan baru dalam satu transaksi
    await audit(user.id, "calendar.update", "calendar_days", `${old.from}..${old.to}`, f);
    const re = await recomputeCapped(old.from < f.from ? old.from : f.from, old.to > f.to ? old.to : f.to);
    revalidatePath("/kalender");
    return `Entri kalender diubah. ${note(re)}`;
  });
}

export async function deleteEntries(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("calendar.manage");
    const k = Key.parse(Object.fromEntries(form));
    await removeWhere(k);
    await audit(user.id, "calendar.delete", "calendar_days", `${k.from}..${k.to}`, k);
    const re = await recomputeCapped(k.from, k.to);
    revalidatePath("/kalender");
    return `Entri kalender dihapus. ${note(re)}`;
  });
}
