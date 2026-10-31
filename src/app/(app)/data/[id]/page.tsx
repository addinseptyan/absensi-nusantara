import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Input } from "@/components/ui/input";
import { ActionForm, SubmitButton } from "@/components/shared/action-form";
import { GlassCard } from "@/components/shared/glass-card";
import { db, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { savePerson } from "../actions";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const sel = "block h-9 w-full rounded-md border bg-white px-2 text-sm";

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ jenis?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const isNew = id === "baru";
  const [person] = isNew ? [] : await db.select().from(s.people).where(eq(s.people.id, Number(id)));
  if (!isNew && !person) notFound();
  const type = person?.type ?? (q.jenis === "staff" ? "staff" : "student");
  if (!can(user.permissions, type === "student" ? "student.manage" : "staff.manage")) throw new Error("Anda tidak punya izin untuk data ini.");

  const [classes, enrollment, workdays] = await Promise.all([
    db.select({ id: s.classes.id, name: s.classes.name }).from(s.classes)
      .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true))).orderBy(asc(s.classes.name)),
    person ? db.select({ classId: s.classEnrollments.classId }).from(s.classEnrollments).where(eq(s.classEnrollments.personId, person.id)) : [],
    person ? db.select().from(s.staffWorkDays).where(eq(s.staffWorkDays.staffId, person.id)) : [],
  ]);
  const currentClass = enrollment.find((e) => classes.some((c) => c.id === e.classId))?.classId;
  const days = new Set(workdays.map((w) => w.weekday));
  const label = type === "student" ? "siswa" : "guru/pegawai";

  return (
    <div className="space-y-4">
      <Link href={`/data?jenis=${type}`} className="text-sm text-teal-800 underline">← Kembali ke daftar</Link>
      <h1 className="text-2xl font-semibold text-slate-900">{isNew ? `Tambah ${label}` : `Ubah data ${label}`}</h1>
      <GlassCard className="p-4">
        <ActionForm action={savePerson} reset={isNew} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="type" value={type} />{person && <input type="hidden" name="id" value={person.id} />}
          <label className="space-y-1 text-sm sm:col-span-2">Nama (tanpa gelar)<Input name="name" defaultValue={person?.name} required maxLength={100} /></label>
          <label className="space-y-1 text-sm">Gelar depan<Input name="titlePrefix" defaultValue={person?.titlePrefix ?? ""} placeholder="mis. Drs." maxLength={30} /></label>
          <label className="space-y-1 text-sm">Gelar belakang<Input name="titleSuffix" defaultValue={person?.titleSuffix ?? ""} placeholder="mis. S.Pd., M.Pd." maxLength={30} /></label>
          {type === "student" ? (<>
            <label className="space-y-1 text-sm">NIS<Input name="nis" defaultValue={person?.nis ?? ""} maxLength={30} inputMode="numeric" /></label>
            <label className="space-y-1 text-sm">Kelas (tahun ajaran aktif)<select name="classId" defaultValue={currentClass ?? ""} className={sel}><option value="">Belum ada kelas</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          </>) : <label className="space-y-1 text-sm">NIP<Input name="nip" defaultValue={person?.nip ?? ""} maxLength={30} inputMode="numeric" /></label>}
          <label className="space-y-1 text-sm">{type === "student" ? "No. HP wali murid" : "No. HP"}<Input name="parentPhone" defaultValue={person?.parentPhone ?? ""} inputMode="tel" placeholder="08xxxxxxxxxx" maxLength={20} /></label>
          <label className="space-y-1 text-sm">PIN mesin absen<Input name="devicePin" defaultValue={person?.devicePin ?? ""} maxLength={20} /><span className="text-xs text-slate-500">Harus sama dengan ID orang ini di mesin. Tanpa PIN, scan tidak bisa dicocokkan.</span></label>
          <label className="space-y-1 text-sm">Status<select name="status" defaultValue={person?.status ?? "active"} className={sel}><option value="active">Aktif</option><option value="graduated">Lulus</option><option value="moved">Pindah</option><option value="inactive">Nonaktif</option></select></label>
          {type === "staff" && (
            <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm">Hari wajib hadir <span className="text-slate-500">(di hari lain scan opsional, tidak dihitung alpa)</span></legend>
              <div className="flex flex-wrap gap-3">{DAYS.map((d, i) => <label key={d} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"><input type="checkbox" name="wd" value={i + 1} defaultChecked={days.has(i + 1)} className="size-4 accent-teal-700" />{d}</label>)}</div></fieldset>)}
          <div className="sm:col-span-2"><SubmitButton>{isNew ? "Tambahkan" : "Simpan perubahan"}</SubmitButton></div>
        </ActionForm>
        <p className="mt-4 text-xs text-slate-500">Data tidak dihapus agar riwayat kehadirannya tetap utuh. Untuk siswa yang keluar, ubah statusnya menjadi Lulus, Pindah, atau Nonaktif.</p>
      </GlassCard>
    </div>
  );
}
