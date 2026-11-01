import { cache } from "react";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { can, type PermissionCode } from "@/lib/permissions";
import { readSession } from "./session";

/** Pengguna login beserta izinnya (izin selalu dibaca dari database, jadi perubahan admin langsung berlaku). */
export const getCurrentUser = cache(async () => {
  const uid = await readSession();
  if (!uid) return null;
  const [u] = await db.select({ id: s.users.id, name: s.users.name, email: s.users.email, personId: s.users.personId, username: s.users.username, mustChangePassword: s.users.mustChangePassword, isActive: s.users.isActive })
    .from(s.users).where(eq(s.users.id, uid));
  if (!u?.isActive) return null;
  const rows = await db.selectDistinct({ code: s.rolePermissions.permissionCode })
    .from(s.userRoles)
    .innerJoin(s.rolePermissions, eq(s.rolePermissions.roleId, s.userRoles.roleId))
    .where(eq(s.userRoles.userId, uid));
  const roleRows = await db.select({ name: s.roles.name }).from(s.userRoles)
    .innerJoin(s.roles, eq(s.roles.id, s.userRoles.roleId)).where(eq(s.userRoles.userId, uid)).orderBy(asc(s.roles.id));
  return { ...u, roles: roleRows.map((r) => r.name), permissions: rows.map((r) => r.code) };
});

/** Dipakai di halaman dan server action: wajib login DAN punya izin (dicek di server). */
export async function requirePermission(code: PermissionCode) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) throw new Error("Ganti kata sandi Anda dulu di halaman Akun saya.");
  if (!can(user.permissions, code)) throw new Error("Anda tidak punya izin untuk tindakan ini.");
  return user;
}
