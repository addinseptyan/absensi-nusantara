"use server";
import { guard } from "@/lib/action";
import bcrypt from "bcryptjs";
import { and, eq, ne, notInArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";

const Create = z.object({
  name: z.string().trim().min(2).max(100),
  username: z.string().trim().regex(/^[A-Za-z0-9._-]{3,30}$/, "Username 3-30 karakter: huruf, angka, titik, garis bawah, atau strip."),
  email: z.string().trim().email("Format email tidak valid.").optional().or(z.literal("")),
  password: z.string().min(8, "Kata sandi minimal 8 karakter").max(100),
  roleId: z.coerce.number().int(),
  personId: z.string().optional(),
});

async function createUser_impl(form: FormData): Promise<string> {
  const admin = await requirePermission("user.manage");
  const f = Create.parse(Object.fromEntries(form));
  const username = f.username.toLowerCase();
  const email = f.email ? f.email.toLowerCase() : null;
  const taken = await db.select({ id: s.users.id }).from(s.users).where(or(eq(sql`lower(${s.users.username})`, username), email ? eq(sql`lower(${s.users.email})`, email) : undefined));
  if (taken.length) throw new Error("Username atau email itu sudah dipakai akun lain.");
  const [u] = await db.insert(s.users).values({
    name: f.name, username, email, passwordHash: await bcrypt.hash(f.password, 12), personId: f.personId ? Number(f.personId) : null,
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

export async function updateUser(form: FormData) {
  return guard(async () => {
    const admin = await requirePermission("user.manage");
    const f = z.object({
      userId: z.coerce.number().int(),
      name: z.string().trim().min(2, "Nama minimal 2 huruf.").max(100),
      username: z.string().trim().regex(/^[A-Za-z0-9._-]{3,30}$/, "Username 3-30 karakter: huruf, angka, titik, garis bawah, atau strip."),
      email: z.string().trim().email("Format email tidak valid.").optional().or(z.literal("")),
      personId: z.string().optional(),
    }).parse(Object.fromEntries(form));
    const roleIds = [...new Set(form.getAll("roleId").map(Number).filter(Boolean))];
    if (!roleIds.length) throw new Error("Pilih minimal satu role.");
    const username = f.username.toLowerCase(), email = f.email ? f.email.toLowerCase() : null;

    const taken = await db.select({ id: s.users.id }).from(s.users)
      .where(and(ne(s.users.id, f.userId), or(eq(sql`lower(${s.users.username})`, username), email ? eq(sql`lower(${s.users.email})`, email) : undefined)));
    if (taken.length) throw new Error("Username atau email itu sudah dipakai akun lain.");

    // Selalu harus tersisa minimal satu admin aktif
    const [adminRole] = await db.select().from(s.roles).where(eq(s.roles.slug, "admin"));
    if (adminRole && !roleIds.includes(adminRole.id)) {
      const [wasAdmin] = await db.select().from(s.userRoles).where(and(eq(s.userRoles.userId, f.userId), eq(s.userRoles.roleId, adminRole.id)));
      const others = await db.select({ id: s.users.id }).from(s.userRoles).innerJoin(s.users, eq(s.users.id, s.userRoles.userId))
        .where(and(eq(s.userRoles.roleId, adminRole.id), eq(s.users.isActive, true), ne(s.users.id, f.userId)));
      if (wasAdmin && !others.length) throw new Error("Harus ada minimal satu admin aktif. Jadikan orang lain admin terlebih dulu.");
    }
    await db.batch([
      db.update(s.users).set({ name: f.name, username, email, personId: f.personId ? Number(f.personId) : null }).where(eq(s.users.id, f.userId)),
      db.insert(s.userRoles).values(roleIds.map((roleId) => ({ userId: f.userId, roleId }))).onConflictDoNothing(),
      db.delete(s.userRoles).where(and(eq(s.userRoles.userId, f.userId), notInArray(s.userRoles.roleId, roleIds))),
    ]);
    await audit(admin.id, "user.update", "users", String(f.userId), { name: f.name, username, roleIds });
    revalidatePath("/pengguna");
    return `Data ${f.name} diperbarui.`;
  });
}
