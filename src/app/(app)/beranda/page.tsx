import Link from "next/link";
import { redirect } from "next/navigation";
import { max, eq } from "drizzle-orm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateField } from "@/components/shared/date-field";
import { FilterForm, SubmitButton } from "@/components/shared/action-form";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { SelectField } from "@/components/shared/select-field";
import { db, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dailyRows } from "@/lib/attendance/daily";
import { visibleClasses } from "@/lib/attendance/summary";
import { localParts } from "@/lib/attendance/time";
import { STATUS_LABEL, STATUS_TONE, fmtTime, fmtWib } from "@/lib/format";
import { can } from "@/lib/permissions";

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function BerandaPage({ searchParams }: { searchParams: Promise<{ tanggal?: string; kelas?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const classes = await visibleClasses(user);
  if (!classes.length) return <GlassCard className="p-6 text-sm text-slate-700">Anda belum memiliki akses ke kelas mana pun.</GlassCard>;
  const q = await searchParams;
  const date = isDate(q.tanggal) ? q.tanggal! : localParts(new Date()).date;
  const canAll = can(user.permissions, "rekap.view_all");
  const kelas = classes.find((c) => String(c.id) === q.kelas) ?? (canAll ? undefined : classes[0]);
  const rows = await dailyRows(date, kelas ? [kelas.id] : classes.map((c) => c.id));
  const [{ synced }] = await db.select({ synced: max(s.syncRuns.finishedAt) }).from(s.syncRuns).where(eq(s.syncRuns.status, "success"));

  const n = (...st: (string | null)[]) => rows.filter((r) => st.includes(r.status)).length;
  const wajib = rows.length - n("pkl") - n("libur");
  const cards: [string, number][] = [["Hadir", n("hadir", "terlambat", "dispensasi")], ["Terlambat", n("terlambat")], ["Izin dan sakit", n("izin", "sakit")], ["Alpa", n("alpa")], ["Belum ada data", n(null, "belum_ada_data")], ["PKL", n("pkl")]];
  const dateText = new Date(`${date}T12:00:00+07:00`).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">Kehadiran harian siswa</h1><p className="text-sm text-slate-600">{dateText} · {wajib} siswa wajib hadir · data diperbarui {synced ? fmtWib(synced) : "belum pernah"}</p></div>
      <GlassCard className="p-4">
        <FilterForm className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">Tanggal<DateField name="tanggal" defaultValue={date} /></label>
          <label className="space-y-1 text-sm">Kelas
            <SelectField name="kelas" defaultValue={kelas?.id ?? ""} className="min-w-44">{canAll && <option value="">Semua kelas</option>}{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectField>
          </label>
          <SubmitButton pendingText="Memuat…">Tampilkan</SubmitButton>
        </FilterForm>
      </GlassCard>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, v]) => <GlassCard key={label} className="p-3"><p className="text-xs text-slate-600">{label}</p><p className="text-2xl font-semibold tabular-nums">{v}</p></GlassCard>)}
      </div>
      <section className="rounded-2xl border bg-white">
        <Table className="min-w-[720px] text-sm">
          <TableHeader><TableRow><TableHead className="px-3">Nama</TableHead><TableHead>Kelas</TableHead><TableHead>Status</TableHead><TableHead>Masuk</TableHead><TableHead>Pulang</TableHead><TableHead>Keterangan</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((r) => {
            const notes = [r.isManual && r.note ? `dikoreksi: ${r.note}` : null, r.noCheckOut ? "tidak absen pulang" : null, r.leftEarly ? "pulang awal" : null, r.excusedExit ? "izin keluar" : null].filter(Boolean);
            return (
              <TableRow key={r.personId}>
                <TableCell className="px-3"><Link className="text-teal-800 hover:underline" href={`/rekap/${r.personId}?from=${date}&to=${date}`}>{r.name}</Link></TableCell>
                <TableCell className="text-slate-600">{r.className}</TableCell>
                <TableCell><Pill tone={r.status ? STATUS_TONE[r.status] : "warn"}>{r.status ? STATUS_LABEL[r.status] : "Belum ada data"}</Pill></TableCell>
                <TableCell className="tabular-nums">{fmtTime(r.checkIn)}</TableCell><TableCell className="tabular-nums">{fmtTime(r.checkOut)}</TableCell>
                <TableCell className="whitespace-normal pr-3 text-slate-600">{notes.join(" · ")}</TableCell>
              </TableRow>);
          })}</TableBody>
        </Table>
      </section>
    </div>
  );
}
