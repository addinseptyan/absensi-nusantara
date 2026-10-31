import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dailyRows } from "@/lib/attendance/daily";
import { visibleClasses } from "@/lib/attendance/summary";
import { localParts } from "@/lib/attendance/time";
import { STATUS_LABEL, STATUS_TONE, fmtTime } from "@/lib/format";
import { correct } from "./actions";

const OPTIONS = [["hadir", "Hadir (tanpa scan)"], ["izin", "Izin"], ["sakit", "Sakit"], ["dispensasi", "Dispensasi"], ["alpa", "Alpa"], ["auto", "Kembali ke otomatis"]] as const;

export default async function KoreksiPage({ searchParams }: { searchParams: Promise<{ tanggal?: string; kelas?: string; semua?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const classes = await visibleClasses(user);
  if (!classes.length) return <GlassCard className="p-6 text-sm text-slate-700">Anda belum memiliki akses ke kelas mana pun.</GlassCard>;

  const q = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.tanggal ?? "") ? q.tanggal! : localParts(new Date()).date;
  const kelas = classes.find((c) => String(c.id) === q.kelas);
  const all = await dailyRows(date, kelas ? [kelas.id] : classes.map((c) => c.id));
  const rows = q.semua ? all : all.filter((r) => !r.status || r.status === "alpa" || r.status === "belum_ada_data" || r.isManual);
  const base = new URLSearchParams({ tanggal: date, ...(kelas && { kelas: String(kelas.id) }) });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Koreksi kehadiran</h1>
        <p className="text-sm text-slate-600">Tandai siswa yang hadir tapi tidak scan, atau yang izin, sakit, dispensasi. Setiap perubahan dicatat dan tidak tertimpa hitung ulang.</p>
      </div>
      <GlassCard className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">Tanggal<Input type="date" name="tanggal" defaultValue={date} /></label>
          <label className="space-y-1 text-sm">Kelas
            <select name="kelas" defaultValue={kelas?.id ?? ""} className="block h-9 rounded-md border bg-white px-3 text-sm">
              <option value="">Semua kelas</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {q.semua && <input type="hidden" name="semua" value="1" />}
          <SubmitButton type="submit">Tampilkan</SubmitButton>
          <Link className="text-sm text-teal-800 underline" href={`/koreksi?${base}${q.semua ? "" : "&semua=1"}`}>{q.semua ? "Hanya yang perlu dicek" : "Tampilkan semua siswa"}</Link>
        </form>
      </GlassCard>

      <section className="rounded-2xl border bg-white">
        {rows.length === 0 ? <p className="p-6 text-sm text-slate-600">Tidak ada siswa yang perlu dikoreksi pada tanggal ini.</p> : (
          <ul className="divide-y">{rows.map((r) => {
            const editable = r.status !== "libur" && r.status !== "pkl";
            return (
              <li key={r.personId} className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
                <div className="md:w-64">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.className} · masuk {fmtTime(r.checkIn)} · pulang {fmtTime(r.checkOut)}</p>
                </div>
                <div className="md:w-40">
                  <Pill tone={r.status ? STATUS_TONE[r.status] : "warn"}>{r.status ? STATUS_LABEL[r.status] : "Belum ada rekap"}</Pill>
                  {r.isManual && <span className="ml-1 text-xs text-slate-500">manual</span>}
                  {r.note && <p className="mt-0.5 text-xs text-slate-500">{r.note}</p>}
                </div>
                {editable ? (
                  <ActionForm action={correct} className="flex flex-1 flex-wrap gap-2" reset>
                    <input type="hidden" name="personId" value={r.personId} /><input type="hidden" name="date" value={date} />
                    <select name="status" defaultValue="hadir" className="h-9 rounded-md border bg-white px-2 text-sm">{OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    <Input name="note" placeholder="Keterangan (wajib)" className="min-w-40 flex-1" maxLength={300} />
                    <SubmitButton type="submit" size="sm" variant="outline">Simpan</SubmitButton>
                  </ActionForm>
                ) : <p className="text-xs text-slate-500">Hari libur atau PKL, tidak perlu dikoreksi.</p>}
              </li>
            );
          })}</ul>
        )}
      </section>
    </div>
  );
}
