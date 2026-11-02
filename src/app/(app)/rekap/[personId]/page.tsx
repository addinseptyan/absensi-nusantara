import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateField } from "@/components/shared/date-field";
import { SubmitButton } from "@/components/shared/action-form";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPersonDetail, rowNotes } from "@/lib/attendance/detail";
import { localParts } from "@/lib/attendance/time";
import { STATUS_LABEL, STATUS_TONE, fmtDay, fmtShort, fmtTime } from "@/lib/format";
import { fullName } from "@/lib/person";
import { can } from "@/lib/permissions";

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const LIST = ["terlambat", "izin", "sakit", "dispensasi", "alpa"] as const;

export default async function PersonDetailPage({ params, searchParams }: { params: Promise<{ personId: string }>; searchParams: Promise<{ from?: string; to?: string; libur?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [{ personId }, q] = await Promise.all([params, searchParams]);
  const today = localParts(new Date()).date;
  const from = isDate(q.from) ? q.from! : `${today.slice(0, 8)}01`;
  const to = isDate(q.to) ? q.to! : today;
  const data = Number.isInteger(Number(personId)) ? await getPersonDetail(user, Number(personId), from, to) : null;
  if (!data) notFound();

  const { person, rows } = data;
  const n = (st: string) => rows.filter((r) => r.status === st).length;
  const present = n("hadir") + n("terlambat") + n("dispensasi");
  const effective = present + n("izin") + n("sakit") + n("alpa");
  const pct = effective ? Math.round((present / effective) * 1000) / 10 : null;
  const shown = q.libur ? rows : rows.filter((r) => r.status !== "libur" || r.checkIn);
  const back = new URLSearchParams({ from, to });
  const backHref = person.type === "staff" ? (can(user.permissions, "rekap.view_all") ? `/rekap-guru?${back}` : null) : `/rekap?${back}`;
  const dl = (format: string) => `/api/export/rekap?jenis=detail&personId=${person.id}&from=${from}&to=${to}&format=${format}`;

  return (
    <div className="space-y-4">
      {backHref && <Link href={backHref} className="text-sm text-teal-800 underline">← Kembali ke rekap</Link>}
      <div><h1 className="text-2xl font-semibold text-slate-900">{fullName(person)}</h1><p className="text-sm text-slate-600">{person.className ? `Kelas ${person.className}` : "Guru dan pegawai"}</p></div>

      <GlassCard className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">Dari<DateField name="from" defaultValue={from} /></label>
          <label className="space-y-1 text-sm">Sampai<DateField name="to" defaultValue={to} /></label>
          {q.libur && <input type="hidden" name="libur" value="1" />}
          <SubmitButton>Tampilkan</SubmitButton>
        </form>
        {can(user.permissions, "rekap.export") && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/60 pt-3">
            <span className="text-sm text-slate-700">Unduh rincian ini:</span>
            <Button variant="outline" size="sm" render={<a href={dl("xlsx")} />} nativeButton={false}>Excel (.xlsx)</Button>
            <Button variant="outline" size="sm" render={<a href={dl("pdf")} />} nativeButton={false}>PDF</Button>
          </div>
        )}
      </GlassCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {([["Hari efektif", effective], ["Hadir", n("hadir") + n("terlambat")], ["Terlambat", n("terlambat")], ["Izin", n("izin")], ["Sakit", n("sakit")], ["Dispensasi", n("dispensasi")], ["Alpa", n("alpa")], ["Kehadiran", pct === null ? "-" : `${pct}%`]] as const).map(([label, v]) => (
          <GlassCard key={label} className="p-3"><p className="text-xs text-slate-600">{label}</p><p className="text-xl font-semibold tabular-nums">{v}</p></GlassCard>))}
      </div>

      <GlassCard className="space-y-1 p-4 text-sm">
        {LIST.map((st) => { const ds = rows.filter((r) => r.status === st).map((r) => fmtShort(r.date)); return ds.length ? <p key={st}><span className="font-medium">{STATUS_LABEL[st]} ({ds.length}):</span> {ds.join(", ")}</p> : null; })}
        {!LIST.some((st) => n(st)) && <p className="text-slate-600">Tidak ada terlambat, izin, sakit, dispensasi, maupun alpa pada rentang ini.</p>}
      </GlassCard>

      <section className="rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b p-3"><h2 className="font-medium">Rincian harian</h2>
          <Link className="text-sm text-teal-800 underline" href={`?${new URLSearchParams({ from, to, ...(q.libur ? {} : { libur: "1" }) })}`}>{q.libur ? "Sembunyikan hari libur" : "Tampilkan hari libur"}</Link></div>
        {shown.length === 0 ? <p className="p-6 text-sm text-slate-600">Belum ada data pada rentang ini. Admin dapat menekan Hitung ulang di halaman rekap.</p> : (
          <Table className="min-w-[640px] text-sm">
            <TableHeader><TableRow><TableHead className="px-3">Tanggal</TableHead><TableHead>Status</TableHead><TableHead>Masuk</TableHead><TableHead>Pulang</TableHead><TableHead>Keterangan</TableHead></TableRow></TableHeader>
            <TableBody>{shown.map((r) => (
              <TableRow key={r.date} className={r.status === "libur" ? "text-slate-400" : ""}>
                <TableCell className="px-3">{fmtDay(r.date)}</TableCell><TableCell><Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill></TableCell>
                <TableCell className="tabular-nums">{fmtTime(r.checkIn)}</TableCell><TableCell className="tabular-nums">{fmtTime(r.checkOut)}</TableCell>
                <TableCell className="whitespace-normal pr-3 text-slate-600">{rowNotes(r).join(" · ")}</TableCell>
              </TableRow>))}</TableBody>
          </Table>)}
      </section>
    </div>
  );
}
