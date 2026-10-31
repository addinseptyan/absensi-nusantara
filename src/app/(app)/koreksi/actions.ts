"use server";
import { guard } from "@/lib/action";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { assertCanCorrect } from "@/lib/attendance/daily";
import { recompute } from "@/lib/attendance/recompute";
import { redirect } from "next/navigation";

const Form = z.object({
  personId: z.coerce.number().int(),
  date: z.string().date(),
  status: z.enum(["hadir", "izin", "sakit", "dispensasi", "alpa", "auto"]),
  note: z.string().trim().max(300).default(""),
});

async function correct_impl(form: FormData): Promise<string> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const f = Form.parse(Object.fromEntries(form));
  if (f.status !== "auto" && f.note.length < 3) throw new Error("Keterangan wajib diisi (minimal 3 huruf).");
  await assertCanCorrect(user, f.personId, f.date);

  const where = and(eq(s.attendanceDaily.personId, f.personId), eq(s.attendanceDaily.date, f.date));
  const [before] = await db.select().from(s.attendanceDaily).where(where);

  if (f.status === "auto") {
    await db.delete(s.attendanceDaily).where(and(where, eq(s.attendanceDaily.isManual, true)));
    await recompute(f.date, f.date); // hitung ulang otomatis untuk hari itu
  } else {
    await db.insert(s.attendanceDaily).values({ personId: f.personId, date: f.date, status: f.status, isManual: true, note: f.note })
      .onConflictDoUpdate({ target: [s.attendanceDaily.personId, s.attendanceDaily.date], set: { status: f.status, isManual: true, note: f.note, computedAt: new Date() } });
  }
  await db.insert(s.auditLogs).values({
    userId: user.id, action: "attendance.correct", entity: "attendance_daily", entityId: `${f.personId}:${f.date}`,
    before: before ? { status: before.status, isManual: before.isManual } : null, after: { status: f.status }, reason: f.note || "Kembali ke otomatis",
  });
  revalidatePath("/koreksi");
  return f.status === "auto" ? "Dikembalikan ke hitungan otomatis." : "Koreksi tersimpan.";
}

export async function correct(form: FormData) {
  return guard(() => correct_impl(form));
}
