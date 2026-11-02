import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/action-form";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { db, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { fullName } from "@/lib/person";
import { can } from "@/lib/permissions";
import { SelectField } from "@/components/shared/select-field";

const STATUS = { active: "Aktif", graduated: "Lulus", moved: "Pindah", inactive: "Nonaktif" } as const;
const btn = "inline-flex h-9 items-center rounded-[var(--radius-control)] px-3 text-sm font-medium shadow-sm";
const sel = "h-9 rounded-md border bg-white px-2 text-sm";

export default async function DataPage({ searchParams }: { searchParams: Promise<{ jenis?: string; q?: string; kelas?: string; status?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowed = (["student", "staff"] as const).filter((t) => can(user.permissions, t === "student" ? "student.manage" : "staff.manage"));
  if (!allowed.length) throw new Error("Anda tidak punya izin membuka halaman ini.");

  const q = await searchParams;
  const jenis = allowed.find((t) => t === q.jenis) ?? allowed[0];
  const status = q.status ?? "active";
  const classes = await db.select({ id: s.classes.id, name: s.classes.name }).from(s.classes)
    .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true))).orderBy(asc(s.classes.name));

  const conds = [eq(s.people.type, jenis)];
  if (status !== "all") conds.push(eq(s.people.status, status as keyof typeof STATUS));
  if (q.kelas && jenis === "student") conds.push(eq(s.classes.id, Number(q.kelas)));
  if (q.q?.trim()) { const like = `%${q.q.trim()}%`; conds.push(or(ilike(s.people.name, like), ilike(s.people.devicePin, like), ilike(s.people.nis, like), ilike(s.people.nip, like))!); }
  const rows = await db.select({
    id: s.people.id, name: s.people.name, titlePrefix: s.people.titlePrefix, titleSuffix: s.people.titleSuffix, status: s.people.status,
    pin: s.people.devicePin, nis: s.people.nis, nip: s.people.nip, className: s.classes.name,
  }).from(s.people)
    .leftJoin(s.classEnrollments, and(eq(s.classEnrollments.personId, s.people.id), inArray(s.classEnrollments.classId, classes.map((c) => c.id).concat(0))))
    .leftJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
    .where(and(...conds)).orderBy(asc(s.classes.name), asc(s.people.name)).limit(300);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold text-slate-900">Data siswa dan guru</h1>
          <p className="text-sm text-slate-600">Nama ditulis tanpa gelar. Gelar diisi di kolom terpisah dan hanya tampil di cetakan.</p></div>
        <Button render={<Link href={`/data/baru?jenis=${jenis}`} />} nativeButton={false}>+ Tambah {jenis === "student" ? "siswa" : "guru/pegawai"}</Button>
      </div>

      <GlassCard className="space-y-3 p-4">
        {allowed.length > 1 && (
          <div className="flex gap-2">{allowed.map((t) => (
            <Button key={t} variant={t === jenis ? "default" : "outline"} render={<Link href={`/data?jenis=${t}`} />} nativeButton={false}>{t === "student" ? "Siswa" : "Guru dan pegawai"}</Button>))}</div>)}
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="jenis" value={jenis} />
          <label className="min-w-48 flex-1 space-y-1 text-sm">Cari<Input name="q" defaultValue={q.q} placeholder="Nama, PIN, atau NIS/NIP" /></label>
          {jenis === "student" && <label className="space-y-1 text-sm">Kelas<SelectField name="kelas" defaultValue={q.kelas ?? ""} className={`block ${sel}`}><option value="">Semua</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectField></label>}
          <label className="space-y-1 text-sm">Status<SelectField name="status" defaultValue={status} className={`block ${sel}`}><option value="active">Aktif</option><option value="all">Semua</option>{(["graduated", "moved", "inactive"] as const).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}</SelectField></label>
          <SubmitButton>Terapkan</SubmitButton>
        </form>
      </GlassCard>

      <section className="rounded-2xl border bg-white">
        <p className="border-b px-4 py-2 text-sm text-slate-600">{rows.length} orang{rows.length === 300 ? " (dibatasi 300, persempit pencarian)" : ""}</p>
        {rows.length === 0 ? <p className="p-6 text-sm text-slate-600">Tidak ada data yang cocok.</p> : (
          <ul className="divide-y">{rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{fullName(r)}</p>
                <p className="text-xs text-slate-500">{jenis === "student" ? `${r.className ?? "Belum ada kelas"} · NIS ${r.nis ?? "-"}` : `NIP ${r.nip ?? "-"}`} · PIN mesin {r.pin ?? "-"}</p></div>
              <div className="flex items-center gap-2">
                {!r.pin && <Pill tone="warn">PIN belum diisi</Pill>}
                <Pill tone={r.status === "active" ? "ok" : "idle"}>{STATUS[r.status]}</Pill>
                <Button variant="outline" size="sm" render={<Link href={`/data/${r.id}`} />} nativeButton={false}>Ubah</Button>
              </div>
            </li>))}</ul>)}
      </section>
    </div>
  );
}
