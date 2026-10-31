import { asc, eq, isNull, sql } from "drizzle-orm";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";
import { fmtWib } from "@/lib/format";
import { createUser, deleteUser, setPassword, toggleActive } from "./actions";

export default async function UsersPage() {
  const me = await requirePermission("user.manage");
  const [users, roles, staff] = await Promise.all([
    db.select({
      id: s.users.id, name: s.users.name, email: s.users.email, isActive: s.users.isActive, lastLoginAt: s.users.lastLoginAt, person: s.people.name,
      roles: sql<string>`coalesce(string_agg(${s.roles.name}, ', '), '')`,
    }).from(s.users)
      .leftJoin(s.userRoles, eq(s.userRoles.userId, s.users.id)).leftJoin(s.roles, eq(s.roles.id, s.userRoles.roleId))
      .leftJoin(s.people, eq(s.people.id, s.users.personId)).groupBy(s.users.id, s.people.name).orderBy(asc(s.users.name)),
    db.select().from(s.roles).orderBy(asc(s.roles.name)),
    db.select({ id: s.people.id, name: s.people.name }).from(s.people).leftJoin(s.users, eq(s.users.personId, s.people.id))
      .where(sql`${s.people.type} = 'staff' and ${s.people.status} = 'active' and ${isNull(s.users.id)}`).orderBy(asc(s.people.name)),
  ]);
  const sel = "h-9 rounded-md border bg-white px-2 text-sm";

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">Pengguna</h1>
        <p className="text-sm text-slate-600">Akun yang bisa masuk ke aplikasi. Untuk wali kelas, hubungkan akun dengan data gurunya.</p></div>

      <GlassCard className="p-4">
        <h2 className="mb-3 font-medium">Tambah pengguna</h2>
        <ActionForm action={createUser} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" reset>
          <label className="space-y-1 text-sm">Nama<Input name="name" required /></label>
          <label className="space-y-1 text-sm">Email<Input name="email" type="email" required /></label>
          <label className="space-y-1 text-sm">Kata sandi sementara<Input name="password" type="text" minLength={8} required /></label>
          <label className="space-y-1 text-sm">Role<select name="roleId" className={`${sel} block w-full`} required>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label className="space-y-1 text-sm">Data guru (opsional)<select name="personId" className={`${sel} block w-full`}><option value="">Tidak dihubungkan</option>{staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <div className="flex items-end"><SubmitButton type="submit">Buat akun</SubmitButton></div>
        </ActionForm>
      </GlassCard>

      <section className="rounded-2xl border bg-white">
        <ul className="divide-y">{users.map((u) => (
          <li key={u.id} className="flex flex-col gap-2 p-3 lg:flex-row lg:items-center">
            <div className="lg:w-72"><p className="text-sm font-medium">{u.name} {u.id === me.id && <span className="text-xs text-slate-500">(Anda)</span>}</p>
              <p className="text-xs text-slate-500">{u.email}{u.person ? ` · guru: ${u.person}` : ""}</p></div>
            <div className="lg:w-56"><Pill tone={u.isActive ? "ok" : "idle"}>{u.isActive ? "Aktif" : "Nonaktif"}</Pill> <span className="text-xs text-slate-600">{u.roles || "tanpa role"}</span>
              <p className="text-xs text-slate-500">Login terakhir {fmtWib(u.lastLoginAt)}</p></div>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <ActionForm action={setPassword} className="flex gap-2" reset><input type="hidden" name="userId" value={u.id} />
                <Input name="password" placeholder="Sandi baru (min. 8)" minLength={8} required className="w-44" /><SubmitButton type="submit" size="sm" variant="outline">Ganti sandi</SubmitButton></ActionForm>
              {u.id !== me.id && (<>
                <ConfirmAction action={toggleActive} fields={{ userId: u.id }} tone="neutral" label={u.isActive ? "Nonaktifkan" : "Aktifkan"}
                  title={u.isActive ? `Nonaktifkan ${u.name}?` : `Aktifkan ${u.name}?`}
                  description={u.isActive ? "Akun ini tidak bisa login lagi sampai diaktifkan kembali. Riwayat datanya tetap tersimpan." : "Akun ini bisa login lagi."} />
                <ConfirmAction action={deleteUser} fields={{ userId: u.id }} label="Hapus" title={`Hapus akun ${u.name}?`}
                  description="Akun dihapus permanen. Jika akun sudah punya riwayat tindakan, penghapusan ditolak dan sebaiknya gunakan Nonaktifkan." />
              </>)}
            </div>
          </li>))}</ul>
      </section>
    </div>
  );
}
