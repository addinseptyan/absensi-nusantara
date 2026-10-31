"use server";
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

export async function createUser(form: FormData) {
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
}

export async function setPassword(form: FormData) {
  const admin = await requirePermission("user.manage");
  const f = z.object({ userId: z.coerce.number().int(), password: z.string().min(8).max(100) }).parse(Object.fromEntries(form));
  await db.update(s.users).set({ passwordHash: await bcrypt.hash(f.password, 12), mustChangePassword: true }).where(eq(s.users.id, f.userId));
  await audit(admin.id, "user.password_reset", "users", String(f.userId));
  revalidatePath("/pengguna");
}

export async function toggleActive(form: FormData) {
  const admin = await requirePermission("user.manage");
  const userId = Number(form.get("userId"));
  if (userId === admin.id) throw new Error("Anda tidak bisa menonaktifkan akun sendiri.");
  const [u] = await db.select().from(s.users).where(eq(s.users.id, userId));
  await db.update(s.users).set({ isActive: !u.isActive }).where(eq(s.users.id, userId));
  await audit(admin.id, u.isActive ? "user.deactivate" : "user.activate", "users", String(userId));
  revalidatePath("/pengguna");
}
