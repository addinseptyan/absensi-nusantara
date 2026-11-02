import { and, asc, eq } from "drizzle-orm";
import { Input } from "@/components/ui/input";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/shared/action-form";
import { GlassCard } from "@/components/shared/glass-card";
import { Modal } from "@/components/shared/modal";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";
import { fmtShort } from "@/lib/format";
import { addPkl, deletePkl, updatePkl } from "./actions";

const day = (d: string) => `${fmtShort(d)} ${d.slice(0, 4)}`;

export default async function PklPage() {
  await requirePermission("pkl.manage");
  const [students, assignments] = await Promise.all([
    db.select({ id: s.people.id, name: s.people.name, classId: s.classes.id, className: s.classes.name }).from(s.people)
      .innerJoin(s.classEnrollments, eq(s.classEnrollments.personId, s.people.id)).innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
      .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true)))
      .where(and(eq(s.people.type, "student"), eq(s.people.status, "active"))).orderBy(asc(s.classes.name), asc(s.people.name)),
    db.select().from(s.pklAssignments).orderBy(asc(s.pklAssignments.startDate)),
  ]);
  const byId = new Map(students.map((x) => [x.id, x]));
  const classes = [...new Set(students.map((x) => x.classId))].map((id) => ({ id, name: students.find((x) => x.classId === id)!.className, list: students.filter((x) => x.classId === id) }));

  const groups = new Map<string, { place: string; from: string; to: string; ids: number[] }>();
  for (const a of assignments) {
    const k = `${a.placeName}|${a.startDate}|${a.endDate}`;
    const g = groups.get(k) ?? { place: a.placeName, from: a.startDate, to: a.endDate, ids: [] };
    groups.set(k, { ...g, ids: [...g.ids, a.studentId] });
  }

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">PKL</h1>
        <p className="text-sm text-slate-600">Selama PKL, siswa berstatus PKL, tidak dihitung hadir maupun alpa, dan hari PKL dikeluarkan dari hari efektif.</p></div>

      <GlassCard className="p-4">
        <h2 className="mb-3 font-medium">Catat PKL baru</h2>
        <ActionForm action={addPkl} reset className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm sm:col-span-3">Tempat PKL<Input name="place" placeholder="mis. CV Maju Jaya, atau PKL (tempat beragam)" required maxLength={120} /></label>
            <label className="space-y-1 text-sm">Mulai<Input type="date" name="from" required /></label>
            <label className="space-y-1 text-sm">Selesai<Input type="date" name="to" required /></label>
          </div>
          <fieldset><legend className="mb-2 text-sm">Siswa peserta. Centang satu kelas penuh, atau buka kelas lalu pilih siswanya.</legend>
            <div className="space-y-2">{classes.map((c) => (
              <details key={c.id} className="rounded-lg border bg-white">
                <summary className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input type="checkbox" name="class" value={c.id} className="size-4 accent-teal-700" /><span className="font-medium">{c.name}</span><span className="text-slate-500">({c.list.length} siswa, centang untuk semua)</span>
                </summary>
                <div className="grid gap-1 border-t px-3 py-2 sm:grid-cols-2">{c.list.map((x) => (
                  <label key={x.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="student" value={x.id} className="size-4 accent-teal-700" />{x.name}</label>))}</div>
              </details>))}</div>
          </fieldset>
          <SubmitButton>Simpan PKL</SubmitButton>
        </ActionForm>
      </GlassCard>

      <section className="rounded-2xl border bg-white">
        <h2 className="border-b px-4 py-2 font-medium">Daftar PKL</h2>
        {groups.size === 0 ? <p className="p-6 text-sm text-slate-600">Belum ada data PKL.</p> : (
          <ul className="divide-y">{[...groups.values()].map((g) => {
            const key = { oPlace: g.place, oFrom: g.from, oTo: g.to };
            const perClass = [...new Set(g.ids.map((i) => byId.get(i)?.className ?? "?"))].map((n) => `${n} (${g.ids.filter((i) => byId.get(i)?.className === n).length})`).join(", ");
            return (
              <li key={`${g.place}${g.from}${g.to}`} className="flex flex-col gap-2 p-3 md:flex-row md:items-start">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{g.place}</p>
                  <p className="text-xs text-slate-500">{day(g.from)} - {day(g.to)} · {g.ids.length} siswa · {perClass}</p>
                  <details className="mt-1 text-xs text-slate-600"><summary className="cursor-pointer">Lihat nama</summary>{g.ids.map((i) => byId.get(i)?.name ?? "(tidak aktif)").join(", ")}</details>
                </div>
                <div className="flex gap-2">
                  <Modal label="Ubah" title="Ubah data PKL">
                    <ActionForm action={updatePkl} className="grid gap-3 sm:grid-cols-2">
                      {Object.entries(key).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                      <label className="space-y-1 text-sm sm:col-span-2">Tempat PKL<Input name="place" defaultValue={g.place} required maxLength={120} /></label>
                      <label className="space-y-1 text-sm">Mulai<Input type="date" name="from" defaultValue={g.from} required /></label>
                      <label className="space-y-1 text-sm">Selesai<Input type="date" name="to" defaultValue={g.to} required /></label>
                      <div className="sm:col-span-2"><SubmitButton>Simpan perubahan</SubmitButton></div>
                    </ActionForm>
                  </Modal>
                  <ConfirmAction action={deletePkl} fields={key} label="Hapus" title="Hapus data PKL ini?" description={`PKL di "${g.place}" untuk ${g.ids.length} siswa dihapus. Hari-harinya kembali dihitung hadir atau alpa sesuai scan.`} />
                </div>
              </li>);
          })}</ul>)}
      </section>
    </div>
  );
}
