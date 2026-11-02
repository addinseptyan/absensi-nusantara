import { and, desc, eq, gte, ilike, lt, or } from "drizzle-orm";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateField } from "@/components/shared/date-field";
import { SubmitButton } from "@/components/shared/action-form";
import { GlassCard } from "@/components/shared/glass-card";
import { SelectField } from "@/components/shared/select-field";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";
import { addDays } from "@/lib/attendance/time";
import { fmtWib } from "@/lib/format";

const LABEL: Record<string, string> = {
  "attendance.correct": "Koreksi kehadiran", "calendar.add": "Tambah kalender", "calendar.update": "Ubah kalender", "calendar.delete": "Hapus kalender",
  "rules.update": "Ubah aturan jam", "rules.create": "Tambah periode aturan", "rules.delete": "Hapus periode aturan",
  "user.create": "Buat akun", "user.update": "Ubah akun", "user.delete": "Hapus akun", "user.activate": "Aktifkan akun", "user.deactivate": "Nonaktifkan akun", "user.password_reset": "Reset kata sandi",
  "role.create": "Tambah role", "role.delete": "Hapus role", "role.permissions_update": "Ubah hak akses", "person.create": "Tambah siswa/guru", "person.update": "Ubah data siswa/guru",
  "pkl.add": "Catat PKL", "pkl.update": "Ubah PKL", "pkl.delete": "Hapus PKL", "class.homeroom_set": "Atur wali kelas", "rekap.export": "Unduh rekap",
  "account.password_change": "Ganti kata sandi sendiri", "account.profile_update": "Ubah nama sendiri", "period.lock": "Kunci periode", "period.unlock": "Buka kunci periode", "backup.download": "Unduh cadangan data",
};
const json = (v: unknown) => (v == null ? "" : JSON.stringify(v, null, 1));
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string; user?: string }> }) {
  await requirePermission("audit.view");
  const q = await searchParams;
  const conds = [];
  if (isDate(q.from)) conds.push(gte(s.auditLogs.createdAt, new Date(`${q.from}T00:00:00+07:00`)));
  if (isDate(q.to)) conds.push(lt(s.auditLogs.createdAt, new Date(`${addDays(q.to!, 1)}T00:00:00+07:00`)));
  if (q.user) conds.push(eq(s.auditLogs.userId, Number(q.user)));
  if (q.q?.trim()) { const like = `%${q.q.trim()}%`; conds.push(or(ilike(s.auditLogs.action, like), ilike(s.auditLogs.entityId, like), ilike(s.auditLogs.reason, like))!); }

  const [rows, users] = await Promise.all([
    db.select({ id: s.auditLogs.id, at: s.auditLogs.createdAt, who: s.users.name, action: s.auditLogs.action, entity: s.auditLogs.entity, entityId: s.auditLogs.entityId, reason: s.auditLogs.reason, before: s.auditLogs.before, after: s.auditLogs.after })
      .from(s.auditLogs).leftJoin(s.users, eq(s.users.id, s.auditLogs.userId)).where(and(...conds)).orderBy(desc(s.auditLogs.id)).limit(300),
    db.select({ id: s.users.id, name: s.users.name }).from(s.users).orderBy(s.users.name),
  ]);

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">Riwayat perubahan</h1>
        <p className="text-sm text-slate-600">Catatan siapa mengubah apa dan kapan. Catatan ini tidak bisa diubah atau dihapus dari aplikasi.</p></div>
      <GlassCard className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 space-y-1 text-sm">Cari<Input name="q" defaultValue={q.q} placeholder="Jenis tindakan, target, atau keterangan" /></label>
          <label className="space-y-1 text-sm">Pengguna<SelectField name="user" defaultValue={q.user ?? ""} className="min-w-44"><option value="">Semua</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</SelectField></label>
          <label className="space-y-1 text-sm">Dari<DateField name="from" defaultValue={q.from} /></label>
          <label className="space-y-1 text-sm">Sampai<DateField name="to" defaultValue={q.to} /></label>
          <SubmitButton>Terapkan</SubmitButton>
        </form>
      </GlassCard>
      <section className="rounded-2xl border bg-white">
        <p className="border-b px-4 py-2 text-sm text-slate-600">{rows.length} catatan terbaru{rows.length === 300 ? " (dibatasi 300, persempit pencarian)" : ""}</p>
        {rows.length === 0 ? <p className="p-6 text-sm text-slate-600">Tidak ada catatan yang cocok.</p> : (
          <Table className="min-w-[760px] text-sm">
            <TableHeader><TableRow><TableHead className="px-3">Waktu</TableHead><TableHead>Pengguna</TableHead><TableHead>Tindakan</TableHead><TableHead>Target</TableHead><TableHead>Keterangan</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="px-3">{fmtWib(r.at)}</TableCell><TableCell>{r.who ?? "-"}</TableCell>
                <TableCell className="font-medium">{LABEL[r.action] ?? r.action}</TableCell>
                <TableCell className="whitespace-normal text-slate-600">{r.entity}{r.entityId ? ` · ${r.entityId}` : ""}</TableCell>
                <TableCell className="whitespace-normal pr-3 text-slate-600">{r.reason}
                  {(r.before != null || r.after != null) && (
                    <details className="text-xs"><summary className="cursor-pointer text-teal-800">Rincian</summary>
                      <pre className="mt-1 max-w-md overflow-x-auto rounded bg-slate-50 p-2">{json({ sebelum: r.before, sesudah: r.after })}</pre></details>)}
                </TableCell>
              </TableRow>))}</TableBody>
          </Table>)}
      </section>
    </div>
  );
}
