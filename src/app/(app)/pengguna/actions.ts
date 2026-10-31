"use server";
import { guard } from "@/lib/action";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";

const Create = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(100),
  roleId: z.coerce.number().int(),
  personId: z.string().optional(),
});

async function createUser_impl(form: FormData): Promise<string> {
  const admin = await requirePermission("user.manage");
  const f = Create.parse(Object.fromEntries(form));
  const email = f.email.toLowerCase();
  const [dup] = await db.select({ id: s.users.id }).from(s.users).where(eq(sql`lower(${s.users.email})`, email));
  if (dup) throw new Error("Email itu sudah dipakai akun lain.");
  const [u] = await db.insert(s.users).values({
    name: f.name, email, passwordHash: await bcrypt.hash(f.password, 12), personId: f.personId ? Number(f.personId) : null,
  }).returning({ id: s.users.id });
  await db.insert(s.userRoles).values({ userId: u.id, roleId: f.roleId });
  await audit(admin.id, "user.create", "users", String(u.id), { email, roleId: f.roleId });
  revalidatePath("/pengguna");
  return `Akun ${f.name} dibuat. Berikan email dan kata sandi sementara kepada pengguna.`;
}

export async function createUser(form: FormData) {
  return guard(() => createUser_impl(form));
}

async function setPassword_impl(form: FormData): Promise<string> {
  const admin = await requirePermission("user.manage");
  const f = z.object({ userId: z.coerce.number().int(), password: z.string().min(8).max(100) }).parse(Object.fromEntries(form));
  await db.update(s.users).set({ passwordHash: await bcrypt.hash(f.password, 12), mustChangePassword: true }).where(eq(s.users.id, f.userId));
  await audit(admin.id, "user.password_reset", "users", String(f.userId));
  revalidatePath("/pengguna");
  return "Kata sandi diganti.";
}

export async function setPassword(form: FormData) {
  return guard(() => setPassword_impl(form));
}

async function toggleActive_impl(form: FormData): Promise<string> {
  const admin = await requirePermission("user.manage");
  const userId = Number(form.get("userId"));
  if (userId === admin.id) throw new Error("Anda tidak bisa menonaktifkan akun sendiri.");
  const [u] = await db.select().from(s.users).where(eq(s.users.id, userId));
  if (!u) throw new Error("Akun tidak ditemukan.");
  await db.update(s.users).set({ isActive: !u.isActive }).where(eq(s.users.id, userId));
  await audit(admin.id, u.isActive ? "user.deactivate" : "user.activate", "users", String(userId));
  revalidatePath("/pengguna");
  return `Akun ${u.name} ${u.isActive ? "dinonaktifkan" : "diaktifkan"}.`;
}

export async function toggleActive(form: FormData) {
  return guard(() => toggleActive_impl(form));
}

export async function deleteUser(form: FormData) {
  return guard(async () => {
    const admin = await requirePermission("user.manage");
    const userId = Number(form.get("userId"));
    if (userId === admin.id) throw new Error("Anda tidak bisa menghapus akun sendiri.");
    const [u] = await db.select().from(s.users).where(eq(s.users.id, userId));
    if (!u) throw new Error("Akun tidak ditemukan.");
    try {
      await db.delete(s.users).where(eq(s.users.id, userId));
    } catch {
      throw new Error("Akun ini sudah punya riwayat tindakan (log, koreksi, atau pengaturan), jadi tidak bisa dihapus. Gunakan Nonaktifkan agar tidak bisa login.");
    }
    await audit(admin.id, "user.delete", "users", String(userId), { email: u.email });
    revalidatePath("/pengguna");
    return `Akun ${u.name} dihapus.`;
  });
}
