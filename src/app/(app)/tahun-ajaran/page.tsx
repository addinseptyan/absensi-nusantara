import { and, asc, desc, eq } from "drizzle-orm";
import { Input } from "@/components/ui/input";
import { ActionForm, SubmitButton } from "@/components/shared/action-form";
import { DateField } from "@/components/shared/date-field";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { SelectField } from "@/components/shared/select-field";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";
import { fmtShort } from "@/lib/format";
import { processYearEnd } from "./actions";

const day = (d: string) => `${fmtShort(d)} ${d.slice(0, 4)}`;

export default async function YearPage() {
  await requirePermission("academic_year.manage");
  const [years, students] = await Promise.all([
    db.select().from(s.academicYears).orderBy(desc(s.academicYears.startDate)),
    db.select({ id: s.people.id, name: s.people.name, className: s.classes.name, grade: s.classes.grade }).from(s.classEnrollments)
      .innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId)).innerJoin(s.people, eq(s.people.id, s.classEnrollments.personId))
      .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true)))
      .where(and(eq(s.people.status, "active"), eq(s.people.type, "student"))).orderBy(asc(s.classes.name), asc(s.people.name)),
  ]);
  const cur = years.find((y) => y.isActive);
  const [a] = (cur?.name ?? "").split("/").map(Number);
  const suggestion = a ? `${a + 1}/${a + 2}` : "";
  const classes = [...new Set(students.map((x) => x.className))];

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">Tahun ajaran dan kenaikan kelas</h1>
        <p className="text-sm text-slate-600">Dilakukan sekali di akhir tahun ajaran. Siswa dipindahkan ke kelas baru, yang lulus diarsipkan, dan tahun ajaran baru menjadi aktif. Data kehadiran tahun lalu tidak dihapus.</p></div>

      <GlassCard className="p-4 text-sm">
        <p className="mb-2 font-medium">Riwayat tahun ajaran</p>
        <ul className="space-y-1">{years.map((y) => <li key={y.id} className="flex items-center gap-2"><span className="font-medium">{y.name}</span><span className="text-slate-500">{day(y.startDate)} - {day(y.endDate)}</span>{y.isActive && <Pill tone="ok">Aktif</Pill>}</li>)}</ul>
      </GlassCard>

      <GlassCard className="space-y-4 p-4">
        <h2 className="font-medium">Proses akhir tahun</h2>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Sebelum memproses: unduh rekap akhir tahun, <strong>kunci periodenya</strong> di menu Kunci periode, dan unduh <strong>cadangan data</strong> di Kesehatan sistem. Proses ini tidak bisa diurungkan dari aplikasi.</p>
        <ActionForm action={processYearEnd} className="space-y-5" confirm={{ title: "Proses akhir tahun ajaran?", description: "Tahun ajaran baru dibuat dan diaktifkan, siswa dipindahkan ke kelas sesuai pilihan, dan yang lulus diarsipkan. Pastikan semua pilihan sudah benar dan rekap tahun ini sudah diunduh dan dikunci.", label: "Ya, proses sekarang" }}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">Nama tahun ajaran baru<Input name="name" defaultValue={suggestion} placeholder="2027/2028" required /></label>
            <label className="space-y-1 text-sm">Mulai<DateField name="from" required /></label>
            <label className="space-y-1 text-sm">Selesai<DateField name="to" required /></label>
          </div>
          {classes.map((c) => {
            const list = students.filter((x) => x.className === c), top = list[0].grade === "XII";
            return (
              <section key={c} className="rounded-xl border bg-white">
                <h3 className="border-b px-3 py-2 text-sm font-medium">{c} <span className="font-normal text-slate-500">({list.length} siswa, {top ? "bawaan: lulus" : "bawaan: naik kelas"})</span></h3>
                <ul className="divide-y">{list.map((x) => (
                  <li key={x.id} className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center">
                    <span className="flex-1 text-sm">{x.name}</span>
                    <div className="sm:w-52"><SelectField name={`d:${x.id}`} defaultValue={top ? "lulus" : "naik"}>
                      {top ? <option value="lulus">Lulus</option> : <option value="naik">Naik kelas</option>}
                      <option value="tinggal">Tinggal kelas</option><option value="keluar">Keluar / pindah sekolah</option>
                    </SelectField></div>
                  </li>))}</ul>
              </section>);
          })}
          <SubmitButton pendingText="Memproses…">Proses akhir tahun</SubmitButton>
        </ActionForm>
        <p className="text-xs text-slate-500">Siswa yang pindah jurusan: proses seperti biasa, lalu ubah kelasnya di menu Data siswa setelah tahun ajaran baru aktif. Kelas X untuk semua jurusan dibuat otomatis untuk siswa baru.</p>
      </GlassCard>
    </div>
  );
}
