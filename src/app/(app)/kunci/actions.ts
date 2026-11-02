"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { guard } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";

export async function addLock(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("period.lock");
    const f = z.object({ from: z.string().date(), to: z.string().date(), reason: z.string().trim().min(3, "Keterangan minimal 3 huruf.").max(200) }).parse(Object.fromEntries(form));
    if (f.from > f.to) throw new Error("Tanggal selesai harus setelah tanggal mulai.");
    await db.insert(s.periodLocks).values({ startDate: f.from, endDate: f.to, reason: f.reason, lockedBy: user.id });
    await audit(user.id, "period.lock", "period_locks", `${f.from}..${f.to}`, f);
    revalidatePath("/kunci");
    return "Periode dikunci. Rekap pada rentang ini tidak akan berubah.";
  });
}

export async function removeLock(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("period.lock");
    const id = Number(form.get("id"));
    const [lock] = await db.select().from(s.periodLocks).where(eq(s.periodLocks.id, id));
    if (!lock) throw new Error("Kunci tidak ditemukan.");
    await db.delete(s.periodLocks).where(eq(s.periodLocks.id, id));
    await audit(user.id, "period.unlock", "period_locks", `${lock.startDate}..${lock.endDate}`, lock);
    revalidatePath("/kunci");
    return "Kunci dibuka. Rekap pada rentang itu bisa berubah lagi, jadi kunci kembali setelah selesai.";
  });
}
