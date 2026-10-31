import { asc } from "drizzle-orm";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/shared/glass-card";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";
import { addPeriod, deletePeriod, savePeriod } from "./actions";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const t = (v: string | null) => (v ? v.slice(0, 5) : "");
const sel = "block h-9 w-full rounded-md border bg-white px-2 text-sm";

export default async function RulesPage() {
  await requirePermission("settings.rules");
  const [periods, days] = await Promise.all([db.select().from(s.rulePeriods).orderBy(asc(s.rulePeriods.priority), asc(s.rulePeriods.id)), db.select().from(s.rulePeriodDays)]);
  const num = (name: string, label: string, v: number, hint?: string) => <label className="space-y-1 text-sm" title={hint}>{label}<Input type="number" name={name} defaultValue={v} min={0} /></label>;

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">Aturan jam</h1>
        <p className="text-sm text-slate-600">Jam masuk, pulang, dan toleransi. Periode yang lebih khusus (misalnya Ramadan) menimpa aturan dasar pada tanggalnya. Setelah mengubah aturan yang sudah berlaku, tekan <strong>Hitung ulang</strong> di halaman Rekap untuk rentang yang terdampak.</p></div>

      {periods.map((p) => (
        <GlassCard key={p.id} className="p-4">
          <ActionForm action={savePeriod} className="space-y-4">
            <input type="hidden" name="id" value={p.id} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-sm">Nama<Input name="name" defaultValue={p.name} required /></label>
              <label className="space-y-1 text-sm">Berlaku untuk<select name="appliesTo" defaultValue={p.appliesTo} className={sel}><option value="all">Siswa dan guru</option><option value="student">Siswa</option><option value="staff">Guru</option></select></label>
              <label className="space-y-1 text-sm">Mulai (kosong = selalu)<Input type="date" name="startDate" defaultValue={p.startDate ?? ""} /></label>
              <label className="space-y-1 text-sm">Selesai<Input type="date" name="endDate" defaultValue={p.endDate ?? ""} /></label>
              {num("priority", "Prioritas", p.priority, "Angka lebih besar menang jika dua aturan berlaku bersamaan")}
              {num("onTimeGraceMin", "Toleransi tepat waktu (menit)", p.onTimeGraceMin)}
              {num("checkOutEarlyMin", "Pulang awal jika sebelum (menit)", p.checkOutEarlyMin)}
              {num("minGapBetweenScansMin", "Jeda minimal masuk ke pulang (menit)", p.minGapBetweenScansMin)}
              <label className="space-y-1 text-sm">Scan masuk paling awal<Input type="time" name="checkInWindowStart" defaultValue={t(p.checkInWindowStart)} required /></label>
              <label className="space-y-1 text-sm">Scan masuk paling akhir<Input type="time" name="checkInWindowEnd" defaultValue={t(p.checkInWindowEnd)} required /></label>
              <label className="space-y-1 text-sm">Scan pulang paling akhir<Input type="time" name="checkOutWindowEnd" defaultValue={t(p.checkOutWindowEnd)} required /></label>
            </div>
            <table className="w-full max-w-xl text-sm"><thead className="text-left text-slate-500"><tr><th className="py-1 font-medium">Hari</th><th className="font-medium">Sekolah</th><th className="font-medium">Masuk</th><th className="font-medium">Pulang</th></tr></thead>
              <tbody>{DAYS.map((d, i) => { const row = days.find((x) => x.rulePeriodId === p.id && x.weekday === i + 1);
                return <tr key={d}><td className="py-1">{d}</td><td><input type="checkbox" name={`d${i + 1}s`} defaultChecked={row?.isSchoolDay ?? false} className="size-4 accent-teal-700" /></td>
                  <td><Input type="time" name={`d${i + 1}i`} defaultValue={t(row?.checkIn ?? null)} className="w-32" /></td><td><Input type="time" name={`d${i + 1}o`} defaultValue={t(row?.checkOut ?? null)} className="w-32" /></td></tr>; })}</tbody></table>
            <SubmitButton type="submit">Simpan {p.name}</SubmitButton>
          </ActionForm>
          {(p.startDate || p.endDate) && <div className="mt-3"><ConfirmAction action={deletePeriod} fields={{ id: p.id }} label="Hapus periode ini" title={`Hapus periode "${p.name}"?`} description="Jam masuk dan pulang periode ini dihapus. Tanggal yang tercakup kembali memakai aturan dasar setelah rekap dihitung ulang." /></div>}
        </GlassCard>))}

      <GlassCard className="p-4">
        <h2 className="mb-3 font-medium">Tambah periode khusus (misalnya Ramadan)</h2>
        <ActionForm action={addPeriod} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" reset>
          <label className="space-y-1 text-sm">Nama<Input name="name" placeholder="Ramadan 2027" required /></label>
          <label className="space-y-1 text-sm">Mulai<Input type="date" name="startDate" required /></label>
          <label className="space-y-1 text-sm">Selesai<Input type="date" name="endDate" required /></label>
          <label className="space-y-1 text-sm">Salin pengaturan dari<select name="copyFrom" className={sel}>{periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <div className="flex items-end"><SubmitButton type="submit" variant="outline">Tambah</SubmitButton></div>
        </ActionForm>
        <p className="mt-2 text-xs text-slate-500">Setelah ditambahkan, edit jam masuk dan pulangnya di kartu periode barunya.</p>
      </GlassCard>
    </div>
  );
}
