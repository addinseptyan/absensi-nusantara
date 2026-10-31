"use server";
import { guard } from "@/lib/action";
import { and, between, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";
import { recomputeCapped } from "@/lib/attendance/recompute";
import { eachDate } from "@/lib/attendance/time";

const Add = z.object({
  from: z.string().date(), to: z.string().date(), kind: z.enum(["non_effective", "effective"]),
  reason: z.string().trim().min(3).max(120), scope: z.enum(["school", "X", "XI", "XII"]), audience: z.enum(["all", "student", "staff"]),
});

async function addEntries_impl(form: FormData): Promise<string> {
  const user = await requirePermission("calendar.manage");
  const f = Add.parse(Object.fromEntries(form));
  const dates = eachDate(f.from, f.to);
  if (f.from > f.to || dates.length > 200) throw new Error("Rentang tanggal tidak valid (maksimal 200 hari).");
  const isGrade = f.scope !== "school";
  await db.insert(s.calendarDays).values(dates.map((date) => ({
    date, kind: f.kind, reason: f.reason, audience: f.audience, createdBy: user.id,
    scopeType: (isGrade ? "grade" : "school") as "grade" | "school", grade: isGrade ? (f.scope as "X" | "XI" | "XII") : null,
  }))).onConflictDoUpdate({
    target: [s.calendarDays.date, s.calendarDays.audience, s.calendarDays.scopeType, s.calendarDays.grade, s.calendarDays.classId],
    set: { kind: f.kind, reason: f.reason },
  });
  await audit(user.id, "calendar.add", "calendar_days", `${f.from}..${f.to}`, f);
  const re = await recomputeCapped(f.from, f.to);
  revalidatePath("/kalender");
  return re ? "Tersimpan di kalender. Rekap sudah dihitung ulang." : "Tersimpan di kalender. Rentangnya panjang, tekan Hitung ulang di halaman Rekap.";
}

export async function addEntries(form: FormData) {
  return guard(() => addEntries_impl(form));
}

const Del = z.object({ from: z.string().date(), to: z.string().date(), reason: z.string(), scopeType: z.enum(["school", "grade", "class"]), grade: z.string(), audience: z.enum(["all", "student", "staff"]) });

async function deleteEntries_impl(form: FormData): Promise<string> {
  const user = await requirePermission("calendar.manage");
  const f = Del.parse(Object.fromEntries(form));
  await db.delete(s.calendarDays).where(and(
    between(s.calendarDays.date, f.from, f.to), eq(s.calendarDays.reason, f.reason), eq(s.calendarDays.scopeType, f.scopeType),
    eq(s.calendarDays.audience, f.audience), f.grade ? eq(s.calendarDays.grade, f.grade as "X" | "XI" | "XII") : isNull(s.calendarDays.grade),
  ));
  await audit(user.id, "calendar.delete", "calendar_days", `${f.from}..${f.to}`, f);
  const re = await recomputeCapped(f.from, f.to);
  revalidatePath("/kalender");
  return re ? "Entri kalender dihapus. Rekap sudah dihitung ulang." : "Entri kalender dihapus. Tekan Hitung ulang di halaman Rekap.";
}

export async function deleteEntries(form: FormData) {
  return guard(() => deleteEntries_impl(form));
}
