"use server";
import { and, eq, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";
import { LOCKED_ADMIN_PERMISSIONS, type PermissionCode } from "@/lib/permissions";

export async function savePermissions(form: FormData) {
  const admin = await requirePermission("role.manage");
  const [roles, perms] = await Promise.all([db.select().from(s.roles), db.select({ code: s.permissions.code }).from(s.permissions)]);
  for (const r of roles) {
    const want = perms.map((p) => p.code).filter((c) =>
      form.get(`p:${r.id}:${c}`) === "on" || (r.slug === "admin" && LOCKED_ADMIN_PERMISSIONS.includes(c as PermissionCode)));
    // Tambah dulu baru hapus sisanya, agar admin tidak pernah sempat kehilangan akses
    if (want.length) await db.insert(s.rolePermissions).values(want.map((permissionCode) => ({ roleId: r.id, permissionCode }))).onConflictDoNothing();
    await db.delete(s.rolePermissions).where(and(eq(s.rolePermissions.roleId, r.id), want.length ? notInArray(s.rolePermissions.permissionCode, want) : undefined));
  }
  await audit(admin.id, "role.permissions_update", "roles", "all", Object.fromEntries(roles.map((r) => [r.slug, form.getAll(`p:${r.id}`).length])));
  revalidatePath("/hak-akses");
}

export async function createRole(form: FormData) {
  const admin = await requirePermission("role.manage");
  const f = z.object({ name: z.string().trim().min(2).max(50), copyFrom: z.string().optional() }).parse(Object.fromEntries(form));
  let slug = f.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "role";
  const [dup] = await db.select().from(s.roles).where(eq(s.roles.slug, slug));
  if (dup) slug = `${slug}_${Date.now().toString(36)}`;
  const [role] = await db.insert(s.roles).values({ slug, name: f.name, isSystem: false }).returning({ id: s.roles.id });
  if (f.copyFrom) {
    const src = await db.select().from(s.rolePermissions).where(eq(s.rolePermissions.roleId, Number(f.copyFrom)));
    if (src.length) await db.insert(s.rolePermissions).values(src.map((x) => ({ roleId: role.id, permissionCode: x.permissionCode })));
  }
  await audit(admin.id, "role.create", "roles", String(role.id), { name: f.name });
  revalidatePath("/hak-akses");
}

export async function deleteRole(form: FormData) {
  const admin = await requirePermission("role.manage");
  const id = Number(form.get("roleId"));
  const [role] = await db.select().from(s.roles).where(eq(s.roles.id, id));
  if (!role || role.isSystem) throw new Error("Role bawaan tidak bisa dihapus.");
  const [used] = await db.select().from(s.userRoles).where(eq(s.userRoles.roleId, id)).limit(1);
  if (used) throw new Error("Role masih dipakai pengguna. Pindahkan penggunanya dulu.");
  await db.delete(s.roles).where(eq(s.roles.id, id));
  await audit(admin.id, "role.delete", "roles", String(id), { name: role.name });
  revalidatePath("/hak-akses");
}
