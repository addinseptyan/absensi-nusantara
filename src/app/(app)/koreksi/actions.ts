"use server";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { guard } from "@/lib/action";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { assertCanCorrect } from "@/lib/attendance/daily";
import { recompute } from "@/lib/attendance/recompute";

const Who = z.object({ personId: z.coerce.number().int(), date: z.string().date() });
const Form = Who.extend({ status: z.enum(["hadir", "izin", "sakit", "dispensasi", "alpa", "auto"]), note: z.string().trim().max(300).default("") });
type Snap = { status: string; isManual: boolean; note: string | null } | null;
const key = (personId: number, date: string) => and(eq(s.attendanceDaily.personId, personId), eq(s.attendanceDaily.date, date));

async function snapshot(personId: number, date: string): Promise<Snap> {
  const [r] = await db.select().from(s.attendanceDaily).where(key(personId, date));
  return r ? { status: r.status, isManual: r.isManual, note: r.note } : null;
}

/** Terapkan keadaan: status manual, atau "auto" = hapus koreksi dan hitung ulang HANYA siswa ini. */
async function apply(personId: number, date: string, status: string, note: string | null) {
  if (status === "auto") {
    await db.delete(s.attendanceDaily).where(and(key(personId, date), eq(s.attendanceDaily.isManual, true)));
    await recompute(date, date, { personIds: [personId] });
    return;
  }
  const st = status as "hadir" | "izin" | "sakit" | "dispensasi" | "alpa";
  await db.insert(s.attendanceDaily).values({ personId, date, status: st, isManual: true, note })
    .onConflictDoUpdate({ target: [s.attendanceDaily.personId, s.attendanceDaily.date], set: { status: st, isManual: true, note, computedAt: new Date() } });
}

async function authorize(personId: number, date: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await assertCanCorrect(user, personId, date);
  return user;
}

export async function correct(form: FormData) {
  return guard(async () => {
    const f = Form.parse(Object.fromEntries(form));
    if (f.status !== "auto" && f.note.length < 3) throw new Error("Keterangan wajib diisi (minimal 3 huruf).");
    const user = await authorize(f.personId, f.date);
    const before = await snapshot(f.personId, f.date);
    await apply(f.personId, f.date, f.status, f.status === "auto" ? null : f.note);
    await audit(user.id, "attendance.correct", "attendance_daily", `${f.personId}:${f.date}`, { status: f.status }, f.note || "Kembali ke otomatis", before);
    revalidatePath("/koreksi");
    return f.status === "auto" ? "Dikembalikan ke hitungan otomatis (hanya siswa ini)." : "Koreksi tersimpan.";
  });
}

/** Urungkan perubahan terakhir pada siswa dan tanggal ini. Menekan lagi mengulangi perubahan (bolak-balik). */
export async function undoCorrection(form: FormData) {
  return guard(async () => {
    const f = Who.parse(Object.fromEntries(form));
    const user = await authorize(f.personId, f.date);
    const [last] = await db.select().from(s.auditLogs)
      .where(and(eq(s.auditLogs.action, "attendance.correct"), eq(s.auditLogs.entityId, `${f.personId}:${f.date}`))).orderBy(desc(s.auditLogs.id)).limit(1);
    if (!last) throw new Error("Belum ada perubahan yang bisa diurungkan.");
    const prev = last.before as Snap;
    const now = await snapshot(f.personId, f.date);
    if (prev?.isManual) await apply(f.personId, f.date, prev.status, prev.note);
    else await apply(f.personId, f.date, "auto", null);
    await audit(user.id, "attendance.correct", "attendance_daily", `${f.personId}:${f.date}`, { status: prev?.isManual ? prev.status : "auto" }, "Diurungkan", now);
    revalidatePath("/koreksi");
    return "Perubahan terakhir diurungkan.";
  });
}
