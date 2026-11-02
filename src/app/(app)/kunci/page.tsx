import { desc, eq } from "drizzle-orm";
import { Input } from "@/components/ui/input";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/shared/action-form";
import { DateField } from "@/components/shared/date-field";
import { GlassCard } from "@/components/shared/glass-card";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";
import { fmtShort, fmtWib } from "@/lib/format";
import { addLock, removeLock } from "./actions";

const day = (d: string) => `${fmtShort(d)} ${d.slice(0, 4)}`;

export default async function LockPage() {
  await requirePermission("period.lock");
  const locks = await db.select({ id: s.periodLocks.id, from: s.periodLocks.startDate, to: s.periodLocks.endDate, reason: s.periodLocks.reason, at: s.periodLocks.createdAt, who: s.users.name })
    .from(s.periodLocks).leftJoin(s.users, eq(s.users.id, s.periodLocks.lockedBy)).orderBy(desc(s.periodLocks.startDate));
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">Kunci periode</h1>
        <p className="text-sm text-slate-600">Kunci rekap yang sudah ditandatangani dan dilaporkan (misalnya satu bulan atau satu semester). Pada periode terkunci, koreksi kehadiran ditolak dan hitung ulang tidak mengubah apa pun, sehingga angka laporan tidak berubah diam-diam. Untuk mengubahnya, buka dulu kuncinya; pembukaan tercatat di riwayat perubahan.</p></div>
      <GlassCard className="p-4">
        <ActionForm action={addLock} reset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">Dari<DateField name="from" required /></label>
          <label className="space-y-1 text-sm">Sampai<DateField name="to" required /></label>
          <label className="space-y-1 text-sm lg:col-span-2">Keterangan<Input name="reason" placeholder="mis. Rekap Oktober 2026 sudah ditandatangani" required maxLength={200} /></label>
          <div className="sm:col-span-2 lg:col-span-4"><SubmitButton>Kunci periode</SubmitButton></div>
        </ActionForm>
      </GlassCard>
      <section className="rounded-2xl border bg-white">
        {locks.length === 0 ? <p className="p-6 text-sm text-slate-600">Belum ada periode yang dikunci.</p> : (
          <ul className="divide-y">{locks.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <div className="flex-1"><p className="text-sm font-medium">{day(l.from)} - {day(l.to)}</p><p className="text-xs text-slate-500">{l.reason} · dikunci {l.who ?? "-"}, {fmtWib(l.at)}</p></div>
              <ConfirmAction action={removeLock} fields={{ id: l.id }} tone="neutral" label="Buka kunci" title="Buka kunci periode ini?" description={`Rekap ${day(l.from)} - ${day(l.to)} bisa berubah lagi (koreksi dan hitung ulang diizinkan). Pastikan memang perlu, lalu kunci kembali setelah selesai.`} />
            </li>))}</ul>)}
      </section>
    </div>
  );
}
