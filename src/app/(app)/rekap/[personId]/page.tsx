import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStudentDetail } from "@/lib/attendance/detail";
import { localParts } from "@/lib/attendance/time";
import { STATUS_LABEL, STATUS_TONE, fmtDay, fmtShort, fmtTime } from "@/lib/format";

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const LIST = ["terlambat", "izin", "sakit", "dispensasi", "alpa"] as const;

export default async function StudentDetailPage({ params, searchParams }: { params: Promise<{ personId: string }>; searchParams: Promise<{ from?: string; to?: string; libur?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [{ personId }, q] = await Promise.all([params, searchParams]);
  const today = localParts(new Date()).date;
  const from = isDate(q.from) ? q.from! : `${today.slice(0, 8)}01`;
  const to = isDate(q.to) ? q.to! : today;
  const data = Number.isInteger(Number(personId)) ? await getStudentDetail(user, Number(personId), from, to) : null;
  if (!data) notFound();

  const { person, rows } = data;
  const n = (st: string) => rows.filter((r) => r.status === st).length;
  const present = n("hadir") + n("terlambat") + n("dispensasi");
  const effective = present + n("izin") + n("sakit") + n("alpa");
  const pct = effective ? Math.round((present / effective) * 1000) / 10 : null;
  const shown = q.libur ? rows : rows.filter((r) => r.status !== "libur" || r.checkIn);
  const back = new URLSearchParams({ from, to });

  return (
    <div className="space-y-4">
      <Link href={`/rekap?${back}`} className="text-sm text-teal-800 underline">← Kembali ke rekap</Link>
      <div><h1 className="text-2xl font-semibold text-slate-900">{person.name}</h1><p className="text-sm text-slate-600">Kelas {person.className}</p></div>

      <GlassCard className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">Dari<Input type="date" name="from" defaultValue={from} /></label>
          <label className="space-y-1 text-sm">Sampai<Input type="date" name="to" defaultValue={to} /></label>
          {q.libur && <input type="hidden" name="libur" value="1" />}
          <Button type="submit">Tampilkan</Button>
        </form>
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
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead className="border-b text-left text-slate-500"><tr><th className="px-3 py-2 font-medium">Tanggal</th><th className="font-medium">Status</th><th className="font-medium">Masuk</th><th className="font-medium">Pulang</th><th className="font-medium">Keterangan</th></tr></thead>
            <tbody>{shown.map((r) => {
              const notes = [r.lateMin ? `terlambat ${r.lateMin} menit` : null, r.noCheckOut ? "tidak absen pulang" : null, r.leftEarly ? "pulang awal" : null, r.excusedExit ? "izin keluar" : null, r.leaveNote, r.isManual ? `dikoreksi: ${r.note ?? ""}` : null].filter(Boolean);
              return (<tr key={r.date} className={`border-b last:border-0 ${r.status === "libur" ? "text-slate-400" : ""}`}>
                <td className="px-3 py-2">{fmtDay(r.date)}</td><td><Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill></td>
                <td className="tabular-nums">{fmtTime(r.checkIn)}</td><td className="tabular-nums">{fmtTime(r.checkOut)}</td><td className="pr-3 text-slate-600">{notes.join(" · ")}</td></tr>);
            })}</tbody></table></div>)}
      </section>
    </div>
  );
}
