import { asc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";
import { addDays } from "@/lib/attendance/time";
import { fmtShort } from "@/lib/format";
import { addEntries, deleteEntries } from "./actions";

const AUD = { all: "Siswa dan guru", student: "Siswa", staff: "Guru" } as const;
const sel = "block h-9 w-full rounded-md border bg-white px-2 text-sm";

export default async function CalendarPage() {
  await requirePermission("calendar.manage");
  const [ay] = await db.select().from(s.academicYears).where(eq(s.academicYears.isActive, true));
  const entries = await db.select().from(s.calendarDays).orderBy(asc(s.calendarDays.date));

  type Group = { from: string; to: string; kind: string; reason: string; scopeType: string; grade: string; audience: keyof typeof AUD };
  const groups: Group[] = [];
  for (const e of entries) {
    const key = { kind: e.kind, reason: e.reason, scopeType: e.scopeType, grade: e.grade ?? "", audience: e.audience };
    const g = groups.find((x) => x.to === addDays(e.date, -1) && (Object.keys(key) as (keyof typeof key)[]).every((k) => x[k] === key[k]));
    if (g) g.to = e.date; else groups.push({ from: e.date, to: e.date, ...key });
  }
  groups.sort((a, b) => b.from.localeCompare(a.from));

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">Kalender</h1>
        <p className="text-sm text-slate-600">Tandai libur, belajar di rumah, atau beri keterangan pada hari tertentu. Rekap otomatis dihitung ulang untuk rentang yang diubah.</p></div>

      <GlassCard className="p-4">
        <form action={addEntries} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm">Dari<Input type="date" name="from" defaultValue={ay?.startDate} required /></label>
          <label className="space-y-1 text-sm">Sampai<Input type="date" name="to" defaultValue={ay?.startDate} required /></label>
          <label className="space-y-1 text-sm">Jenis<select name="kind" className={sel}><option value="non_effective">Tidak efektif (libur / belajar di rumah)</option><option value="effective">Hari efektif, hanya keterangan</option></select></label>
          <label className="space-y-1 text-sm">Berlaku untuk<select name="scope" className={sel}><option value="school">Seluruh sekolah</option><option value="X">Kelas X</option><option value="XI">Kelas XI</option><option value="XII">Kelas XII</option></select></label>
          <label className="space-y-1 text-sm">Peserta<select name="audience" className={sel}><option value="all">Siswa dan guru</option><option value="student">Siswa saja</option><option value="staff">Guru saja</option></select></label>
          <label className="space-y-1 text-sm">Keterangan<Input name="reason" placeholder="mis. Libur Natal" required maxLength={120} /></label>
          <div className="sm:col-span-2 lg:col-span-3"><Button type="submit">Simpan ke kalender</Button></div>
        </form>
      </GlassCard>

      <section className="rounded-2xl border bg-white">
        {groups.length === 0 ? <p className="p-6 text-sm text-slate-600">Kalender masih kosong.</p> : (
          <ul className="divide-y">{groups.map((g) => (
            <li key={`${g.from}-${g.reason}-${g.scopeType}-${g.grade}-${g.audience}`} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <p className="text-sm font-medium sm:w-48">{g.from === g.to ? fmtShort(g.from) : `${fmtShort(g.from)} - ${fmtShort(g.to)}`} <span className="font-normal text-slate-500">{g.to.slice(0, 4)}</span></p>
              <div className="flex-1"><p className="text-sm">{g.reason}</p>
                <p className="text-xs text-slate-500">{g.scopeType === "school" ? "Seluruh sekolah" : `Kelas ${g.grade}`} · {AUD[g.audience]}</p></div>
              <Pill tone={g.kind === "non_effective" ? "warn" : "ok"}>{g.kind === "non_effective" ? "Tidak efektif" : "Keterangan"}</Pill>
              <form action={deleteEntries}>
                {(["from", "to", "reason", "scopeType", "grade", "audience"] as const).map((k) => <input key={k} type="hidden" name={k} value={g[k]} />)}
                <Button size="sm" variant="ghost">Hapus</Button></form>
            </li>))}</ul>)}
      </section>
    </div>
  );
}
