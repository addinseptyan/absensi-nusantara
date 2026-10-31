import { Fragment } from "react";
import { asc } from "drizzle-orm";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/shared/glass-card";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";
import { LOCKED_ADMIN_PERMISSIONS, type PermissionCode } from "@/lib/permissions";
import { createRole, deleteRole, savePermissions } from "./actions";

export default async function AccessPage() {
  await requirePermission("role.manage");
  const [roles, perms, rp] = await Promise.all([
    db.select().from(s.roles).orderBy(asc(s.roles.id)),
    db.select().from(s.permissions).orderBy(asc(s.permissions.group), asc(s.permissions.code)),
    db.select().from(s.rolePermissions),
  ]);
  const has = new Set(rp.map((x) => `${x.roleId}:${x.permissionCode}`));

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">Hak akses</h1>
        <p className="text-sm text-slate-600">Centang fitur yang boleh dipakai tiap role. Perubahan berlaku saat pengguna membuka halaman berikutnya.</p></div>

      <section className="rounded-2xl border bg-white">
        <ActionForm action={savePermissions} confirm={{ title: "Simpan perubahan hak akses?", description: "Perubahan berlaku untuk semua pengguna dengan role terkait saat mereka membuka halaman berikutnya.", label: "Ya, simpan" }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 border-b bg-white"><tr><th className="px-3 py-2 text-left font-medium">Fitur</th>
                {roles.map((r) => <th key={r.id} className="px-3 text-center font-medium">{r.name}</th>)}</tr></thead>
              <tbody>{perms.map((p, i) => (
                <Fragment key={p.code}>
                  {(i === 0 || perms[i - 1].group !== p.group) && <tr className="bg-slate-50"><td colSpan={roles.length + 1} className="px-3 py-1.5 text-xs font-semibold text-slate-600">{p.group}</td></tr>}
                  <tr className="border-b last:border-0">
                    <td className="px-3 py-2"><p>{p.description}</p><p className="text-xs text-slate-400">{p.code}</p></td>
                    {roles.map((r) => {
                      const locked = r.slug === "admin" && LOCKED_ADMIN_PERMISSIONS.includes(p.code as PermissionCode);
                      return <td key={r.id} className="text-center"><input type="checkbox" name={`p:${r.id}:${p.code}`} defaultChecked={locked || has.has(`${r.id}:${p.code}`)}
                        disabled={locked} title={locked ? "Terkunci agar admin tidak kehilangan akses" : undefined} className="size-4 accent-teal-700" /></td>;
                    })}
                  </tr>
                </Fragment>))}</tbody>
            </table>
          </div>
          <div className="border-t p-3"><SubmitButton type="submit">Simpan hak akses</SubmitButton></div>
        </ActionForm>
      </section>

      <GlassCard className="space-y-4 p-4">
        <ActionForm action={createRole} className="flex flex-wrap items-end gap-3" reset>
          <label className="space-y-1 text-sm">Nama role baru<Input name="name" placeholder="mis. Kepala Sekolah" required /></label>
          <label className="space-y-1 text-sm">Salin izin dari
            <select name="copyFrom" className="block h-9 rounded-md border bg-white px-2 text-sm"><option value="">Kosong</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <SubmitButton type="submit" variant="outline">Tambah role</SubmitButton>
        </ActionForm>
        <div className="flex flex-wrap gap-2">{roles.filter((r) => !r.isSystem).map((r) => (
          <ConfirmAction key={r.id} action={deleteRole} fields={{ roleId: r.id }} label={`Hapus role ${r.name}`} title={`Hapus role "${r.name}"?`} description="Role dihapus beserta pengaturan izinnya. Role yang masih dipakai pengguna tidak bisa dihapus." />))}</div>
      </GlassCard>
    </div>
  );
}
