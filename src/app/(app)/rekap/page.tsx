import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { studentSummary, visibleClasses } from "@/lib/attendance/summary";
import { localParts } from "@/lib/attendance/time";
import { can } from "@/lib/permissions";
import { recomputeRange } from "./actions";

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const NUM = "px-2 py-2 text-right tabular-nums";

export default async function RekapPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; kelas?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const classes = await visibleClasses(user);
  if (!classes.length) return <GlassCard className="p-6 text-sm text-slate-700">Anda belum memiliki akses ke rekap kelas mana pun. Hubungi admin sekolah.</GlassCard>;

  const q = await searchParams;
  const today = localParts(new Date()).date;
  const from = isDate(q.from) ? q.from! : `${today.slice(0, 8)}01`;
  const to = isDate(q.to) ? q.to! : today;
  const kelas = classes.find((c) => String(c.id) === q.kelas);
  const rows = await studentSummary(from, to, kelas ? [kelas.id] : classes.map((c) => c.id));

  const totals = rows.reduce((a, r) => ({ present: a.present + r.present, effective: a.effective + r.effective, alpa: a.alpa + r.alpa, late: a.late + r.terlambat, pending: a.pending + r.pending }),
    { present: 0, effective: 0, alpa: 0, late: 0, pending: 0 });
  const avg = totals.effective ? Math.round((totals.present / totals.effective) * 1000) / 10 : null;
  const tone = (p: number | null) => (p === null ? "idle" : p >= 90 ? "ok" : p >= 80 ? "warn" : "bad") as "ok" | "warn" | "bad" | "idle";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Rekap kehadiran siswa</h1>
        <p className="text-sm text-slate-600">Persentase = (hadir + terlambat + dispensasi) dibagi hari efektif. PKL dan hari libur tidak dihitung.</p>
      </div>

      <GlassCard className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">Dari<Input type="date" name="from" defaultValue={from} /></label>
          <label className="space-y-1 text-sm">Sampai<Input type="date" name="to" defaultValue={to} /></label>
          <label className="space-y-1 text-sm">Kelas
            <select name="kelas" defaultValue={kelas?.id ?? ""} className="block h-9 rounded-md border bg-white px-3 text-sm">
              <option value="">Semua kelas</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <Button type="submit">Tampilkan</Button>
        </form>
        {can(user.permissions, "settings.rules") && (
          <form action={recomputeRange} className="mt-3 flex items-center gap-3 border-t border-white/60 pt-3">
            <input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} />
            <Button type="submit" variant="outline" size="sm">Hitung ulang rentang ini</Button>
            <span className="text-xs text-slate-500">Pakai setelah mengubah aturan atau kalender. Maksimal 62 hari.</span>
          </form>
        )}
      </GlassCard>

      <div className="grid gap-3 sm:grid-cols-3">
        <GlassCard className="p-4"><p className="text-sm text-slate-600">Rata-rata kehadiran</p><p className="text-2xl font-semibold">{avg === null ? "-" : `${avg}%`}</p></GlassCard>
        <GlassCard className="p-4"><p className="text-sm text-slate-600">Total alpa</p><p className="text-2xl font-semibold">{totals.alpa}</p></GlassCard>
        <GlassCard className="p-4"><p className="text-sm text-slate-600">Total terlambat</p><p className="text-2xl font-semibold">{totals.late}</p></GlassCard>
      </div>

      {totals.pending > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{totals.pending} hari siswa belum ada datanya (belum disync atau hari belum selesai). Angka akan berubah setelah sync berikutnya.</p>}

      <section className="rounded-2xl border bg-white">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-600">Belum ada rekap untuk rentang ini. Admin dapat menekan <strong>Hitung ulang rentang ini</strong> setelah agent menarik data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b text-slate-500"><tr>
                <th className="px-3 py-2 text-left font-medium">Nama</th><th className="px-2 text-left font-medium">Kelas</th>
                {["Efektif", "Hadir", "Terlambat", "Izin", "Sakit", "Dispen", "PKL", "Alpa"].map((h) => <th key={h} className="px-2 text-right font-medium">{h}</th>)}
                <th className="px-3 text-right font-medium">Kehadiran</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.personId} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-2">{r.name}</td><td className="px-2 text-slate-600">{r.className}</td>
                  <td className={NUM}>{r.effective}</td><td className={NUM}>{r.hadir + r.terlambat}</td><td className={NUM}>{r.terlambat}</td>
                  <td className={NUM}>{r.izin}</td><td className={NUM}>{r.sakit}</td><td className={NUM}>{r.dispensasi}</td><td className={NUM}>{r.pkl}</td>
                  <td className={`${NUM} ${r.alpa ? "font-medium text-red-700" : ""}`}>{r.alpa}</td>
                  <td className="px-3 text-right"><Pill tone={tone(r.pct)}>{r.pct === null ? "-" : `${r.pct}%`}</Pill></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
