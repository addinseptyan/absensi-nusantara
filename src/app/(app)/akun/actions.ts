"use server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { guard } from "@/lib/action";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";

async function me() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function changePassword(form: FormData) {
  return guard(async () => {
    const user = await me();
    const f = z.object({
      current: z.string().min(1, "Isi kata sandi saat ini."),
      next: z.string().min(8, "Kata sandi baru minimal 8 karakter.").max(100),
      confirm: z.string(),
    }).parse(Object.fromEntries(form));
    if (f.next !== f.confirm) throw new Error("Konfirmasi kata sandi tidak sama.");
    if (f.next === f.current) throw new Error("Kata sandi baru harus berbeda dari yang lama.");
    if (user.username && f.next.toLowerCase() === user.username.toLowerCase()) throw new Error("Kata sandi tidak boleh sama dengan username.");
    const [row] = await db.select({ hash: s.users.passwordHash }).from(s.users).where(eq(s.users.id, user.id));
    if (!(await bcrypt.compare(f.current, row.hash))) throw new Error("Kata sandi saat ini salah.");
    await db.update(s.users).set({ passwordHash: await bcrypt.hash(f.next, 12), mustChangePassword: false }).where(eq(s.users.id, user.id));
    await audit(user.id, "account.password_change", "users", String(user.id));
    revalidatePath("/", "layout");
    return "Kata sandi diganti.";
  });
}

export async function updateProfile(form: FormData) {
  return guard(async () => {
    const user = await me();
    const f = z.object({ name: z.string().trim().min(2, "Nama minimal 2 huruf.").max(100) }).parse(Object.fromEntries(form));
    await db.update(s.users).set({ name: f.name }).where(eq(s.users.id, user.id));
    await audit(user.id, "account.profile_update", "users", String(user.id), { name: f.name });
    revalidatePath("/", "layout");
    return "Nama diperbarui.";
  });
}
