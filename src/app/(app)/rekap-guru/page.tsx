import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateField } from "@/components/shared/date-field";
import { SubmitButton, FilterForm } from "@/components/shared/action-form";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { requirePermission } from "@/lib/auth/current-user";
import { staffSummary } from "@/lib/attendance/summary";
import { localParts } from "@/lib/attendance/time";
import { fullName } from "@/lib/person";
import { can } from "@/lib/permissions";
import { ExportDialog } from "@/components/shared/export-dialog";
import { getPrintPlace, signOptions } from "@/lib/export/sign";

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const NUM = "px-2 text-right tabular-nums";

export default async function StaffRecapPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
   const user = await requirePermission("rekap.view_all");
   const q = await searchParams;
   const today = localParts(new Date()).date;
   const from = isDate(q.from) ? q.from! : `${today.slice(0, 8)}01`;
   const to = isDate(q.to) ? q.to! : today;
   const rows = await staffSummary(from, to);
   const tone = (p: number | null) => (p === null ? "idle" : p >= 90 ? "ok" : p >= 80 ? "warn" : "bad") as "ok" | "warn" | "bad" | "idle";
   const qs = new URLSearchParams({ from, to });

   return (
      <div className="space-y-4">
         <div><h1 className="text-2xl font-semibold text-slate-900">Rekap guru dan pegawai</h1>
            <p className="text-sm text-slate-600">Hari efektif adalah hari wajib hadir masing-masing. Scan di luar jadwal dicatat sebagai "scan tambahan" dan tidak memengaruhi persentase.</p></div>
         <GlassCard className="p-4">
            <FilterForm className="flex flex-wrap items-end gap-3">
               <label className="space-y-1 text-sm">Dari<DateField name="from" defaultValue={from} /></label>
               <label className="space-y-1 text-sm">Sampai<DateField name="to" defaultValue={to} /></label>
               <SubmitButton pendingText="Memuat…">Tampilkan</SubmitButton>
            </FilterForm>
            {can(user.permissions, "rekap.export") && (
               <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/60 pt-3">
                  <span className="text-sm text-slate-700">Unduh rekap ini:</span>
                  <ExportDialog params={{ jenis: "guru", from, to }} signOptions={signOptions(false)} defaultPlace={await getPrintPlace()} defaultDate={today} />
               </div>)}
            {can(user.permissions, "attendance.correct_staff") && (
               <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/60 pt-3">
                  <span className="text-sm text-slate-700">Ada guru yang hadir tapi tidak sempat scan, atau izin/sakit?</span>
                  <Button variant="outline" size="sm" render={<Link href="/koreksi?jenis=guru" />} nativeButton={false}>Buka koreksi kehadiran guru</Button>
               </div>)}
         </GlassCard>
         <section className="rounded-2xl border bg-white">
            {rows.length === 0 ? <p className="p-6 text-sm text-slate-600">Belum ada rekap untuk rentang ini. Admin dapat menekan Hitung ulang di halaman Rekap siswa.</p> : (
               <Table className="min-w-[760px] text-sm">
                  <TableHeader><TableRow><TableHead className="px-3">Nama</TableHead>
                     {["Wajib", "Hadir", "Terlambat", "Izin", "Sakit", "Dispen", "Alpa", "Tambahan"].map((h) => <TableHead key={h} className="px-2 text-right">{h}</TableHead>)}
                     <TableHead className="px-3 text-right">Kehadiran</TableHead></TableRow></TableHeader>
                  <TableBody>{rows.map((r) => (
                     <TableRow key={r.personId}>
                        <TableCell className="px-3"><Link className="text-teal-800 hover:underline" href={`/rekap/${r.personId}?${qs}`}>{fullName(r)}</Link></TableCell>
                        <TableCell className={NUM}>{r.effective}</TableCell><TableCell className={NUM}>{r.hadir + r.terlambat}</TableCell><TableCell className={NUM}>{r.terlambat}</TableCell>
                        <TableCell className={NUM}>{r.izin}</TableCell><TableCell className={NUM}>{r.sakit}</TableCell><TableCell className={NUM}>{r.dispensasi}</TableCell>
                        <TableCell className={`${NUM} ${r.alpa ? "font-medium text-red-700" : ""}`}>{r.alpa}</TableCell><TableCell className={NUM}>{r.extra}</TableCell>
                        <TableCell className="px-3 text-right"><Pill tone={tone(r.pct)}>{r.pct === null ? "-" : `${r.pct}%`}</Pill></TableCell>
                     </TableRow>))}</TableBody>
               </Table>)}
         </section>
      </div>
   );
}