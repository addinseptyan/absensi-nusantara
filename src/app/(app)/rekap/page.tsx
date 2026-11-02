import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { studentSummary, visibleClasses } from "@/lib/attendance/summary";
import { localParts } from "@/lib/attendance/time";
import { can } from "@/lib/permissions";
import { recomputeRange } from "./actions";
import { SelectField } from "@/components/shared/select-field";
import { DateField } from "@/components/shared/date-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const exportQs = new URLSearchParams({ from, to, ...(kelas && { kelas: String(kelas.id) }) });
  const exportBtn = "inline-flex h-8 items-center rounded-[var(--radius-control)] border bg-white px-3 text-sm hover:bg-slate-50";
  const tone = (p: number | null) => (p === null ? "idle" : p >= 90 ? "ok" : p >= 80 ? "warn" : "bad") as "ok" | "warn" | "bad" | "idle";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Rekap kehadiran siswa</h1>
        <p className="text-sm text-slate-600">Persentase = (hadir + terlambat + dispensasi) dibagi hari efektif. PKL dan hari libur tidak dihitung.</p>
      </div>

      <GlassCard className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">Dari<DateField name="from" defaultValue={from} /></label>
          <label className="space-y-1 text-sm">Sampai<DateField name="to" defaultValue={to} /></label>
          <label className="space-y-1 text-sm">Kelas
            <SelectField name="kelas" defaultValue={kelas?.id ?? ""} className="block h-9 rounded-md border bg-white px-3 text-sm">
              <option value="">Semua kelas</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectField>
          </label>
          <SubmitButton type="submit">Tampilkan</SubmitButton>
        </form>
        {can(user.permissions, "rekap.export") && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/60 pt-3">
            <span className="text-sm text-slate-700">Unduh rekap ini:</span>
            <Button variant="outline" size="sm" render={<a href={`/api/export/rekap?format=xlsx&${exportQs}`} />} nativeButton={false}>Excel (.xlsx)</Button>
            <Button variant="outline" size="sm" render={<a href={`/api/export/rekap?format=pdf&${exportQs}`} />} nativeButton={false}>PDF</Button>
          </div>
        )}
        {can(user.permissions, "settings.rules") && (
          <ActionForm confirm={{ title: "Hitung ulang rekap?", description: "Seluruh rekap pada rentang ini dihitung ulang dari data scan. Koreksi manual tidak berubah.", label: "Ya, hitung ulang" }} action={recomputeRange} className="mt-3 flex items-center gap-3 border-t border-white/60 pt-3">
            <input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} />
            <SubmitButton type="submit" variant="outline" size="sm">Hitung ulang rentang ini</SubmitButton>
            <span className="text-xs text-slate-500">Pakai setelah mengubah aturan atau kalender. Maksimal 62 hari.</span>
          </ActionForm>
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
            <Table className="w-full min-w-[760px] text-sm">
              <TableHeader className="border-b text-slate-500"><TableRow>
                <TableHead className="px-3 py-2 text-left font-medium">Nama</TableHead><TableHead className="px-2 text-left font-medium">Kelas</TableHead>
                {["Efektif", "Hadir", "Terlambat", "Izin", "Sakit", "Dispen", "PKL", "Alpa"].map((h) => <TableHead key={h} className="px-2 text-right font-medium">{h}</TableHead>)}
                <TableHead className="px-3 text-right font-medium">Kehadiran</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map((r) => (
                <TableRow key={r.personId} className="border-b last:border-0 hover:bg-slate-50">
                  <TableCell className="px-3 py-2"><HoverCard>
            <HoverCardTrigger delay={150} render={<Link className="text-teal-800 hover:underline" href={`/rekap/${r.personId}?from=${from}&to=${to}`} />}>{r.name}</HoverCardTrigger>
            <HoverCardContent className="w-64 space-y-2 text-sm">
              <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">Kelas {r.className}</p></div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt>Kehadiran</dt><dd className="text-right font-medium">{r.pct === null ? "-" : `${r.pct}%`}</dd>
                <dt>Hari efektif</dt><dd className="text-right">{r.effective}</dd>
                <dt>Terlambat</dt><dd className="text-right">{r.terlambat}</dd>
                <dt>Izin dan sakit</dt><dd className="text-right">{r.izin + r.sakit}</dd>
                <dt>Alpa</dt><dd className="text-right font-medium">{r.alpa}</dd>
              </dl>
              <p className="text-xs text-muted-foreground">Klik nama untuk rincian harian.</p>
            </HoverCardContent>
          </HoverCard></TableCell><TableCell className="px-2 text-slate-600">{r.className}</TableCell>
                  <TableCell className={NUM}>{r.effective}</TableCell><TableCell className={NUM}>{r.hadir + r.terlambat}</TableCell><TableCell className={NUM}>{r.terlambat}</TableCell>
                  <TableCell className={NUM}>{r.izin}</TableCell><TableCell className={NUM}>{r.sakit}</TableCell><TableCell className={NUM}>{r.dispensasi}</TableCell><TableCell className={NUM}>{r.pkl}</TableCell>
                  <TableCell className={`${NUM} ${r.alpa ? "font-medium text-red-700" : ""}`}>{r.alpa}</TableCell>
                  <TableCell className="px-3 text-right"><Pill tone={tone(r.pct)}>{r.pct === null ? "-" : `${r.pct}%`}</Pill></TableCell>
                </TableRow>))}</TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
