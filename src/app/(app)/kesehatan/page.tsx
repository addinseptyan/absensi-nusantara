import { count, desc, max } from "drizzle-orm";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/shared/action-form";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";
import { ago, fmtWib } from "@/lib/format";
import { sendCommand } from "./actions";
import { AutoRefresh } from "./auto-refresh";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TONE = { success: "ok", running: "warn", pending: "warn", partial: "warn", failed: "bad", expired: "idle" } as const;
const LABEL = { success: "Berhasil", running: "Berjalan", pending: "Menunggu agent", partial: "Sebagian", failed: "Gagal", expired: "Kedaluwarsa" } as const;
const COMMANDS = [
  ["diagnose", "Diagnosa"], ["test_connection", "Tes koneksi"], ["sync_now", "Sync sekarang"], ["sync_time", "Samakan jam mesin"],
] as const;

type Step = { name: string; ok: boolean; detail: string };

export default async function HealthPage() {
  await requirePermission("system.health");
  const [agents, commands, runs, logs, [{ total, lastScan }]] = await Promise.all([
    db.select().from(s.agents),
    db.select().from(s.agentCommands).orderBy(desc(s.agentCommands.id)).limit(5),
    db.select().from(s.syncRuns).orderBy(desc(s.syncRuns.id)).limit(6),
    db.select().from(s.systemLogs).orderBy(desc(s.systemLogs.id)).limit(12),
    db.select({ total: count(), lastScan: max(s.rawLogs.punchedAt) }).from(s.rawLogs),
  ]);
  const online = (d: Date | null) => !!d && Date.now() - new Date(d).getTime() < 120_000;

  return (
    <div className="space-y-4">
      <AutoRefresh />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Kesehatan sistem</h1>
        <p className="text-sm text-slate-600">Halaman ini diperbarui otomatis tiap 15 detik.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {agents.map((a) => (
          <GlassCard key={a.id} className="p-4">
            <div className="flex items-center justify-between"><p className="font-medium">{a.name}</p><Pill tone={online(a.lastSeenAt) ? "ok" : "bad"}>{online(a.lastSeenAt) ? "Online" : "Offline"}</Pill></div>
            <p className="mt-1 text-sm text-slate-600">Terakhir terlihat {ago(a.lastSeenAt)}, versi {a.version ?? "?"}</p>
          </GlassCard>
        ))}
        <GlassCard className="p-4">
          <p className="font-medium">Data absen di database</p>
          <p className="mt-1 text-sm text-slate-600">{total.toLocaleString("id-ID")} scan, terbaru {fmtWib(lastScan)}</p>
        </GlassCard>
      </div>

      <GlassCard className="flex flex-wrap items-center gap-2 p-4">
        <p className="mr-2 text-sm font-medium">Perintah ke agent:</p>
        {COMMANDS.map(([type, label]) => (
          <ActionForm key={type} action={sendCommand}><input type="hidden" name="type" value={type} /><SubmitButton variant={type === "diagnose" ? "default" : "outline"} size="sm" pendingText="Mengirim…">{label}</SubmitButton></ActionForm>
        ))}
      </GlassCard>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-2 font-medium">Perintah terakhir</h2>
        {commands.length === 0 && <p className="text-sm text-slate-500">Belum ada perintah. Tekan Diagnosa untuk memulai.</p>}
        <ul className="divide-y">
          {commands.map((c) => {
            const steps = (c.result as { steps?: Step[] } | null)?.steps;
            return (
              <li key={c.id} className="py-2 text-sm">
                <div className="flex items-center gap-2"><Pill tone={TONE[c.status]}>{LABEL[c.status]}</Pill><span className="font-medium">{c.type}</span><span className="text-slate-500">{fmtWib(c.createdAt)}</span></div>
                {c.errorMessage && <p className="mt-1 text-red-700">{c.errorMessage}</p>}
                {steps && <ul className="mt-1 space-y-0.5">{steps.map((st) => <li key={st.name} className={st.ok ? "text-emerald-800" : "text-red-700"}>{st.ok ? "✓" : "✗"} {st.name}: {st.detail}</li>)}</ul>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-2 font-medium">Riwayat sync</h2>
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader className="text-left text-slate-500"><TableRow><TableHead className="py-1 pr-3">Waktu</TableHead><TableHead className="pr-3">Pemicu</TableHead><TableHead className="pr-3">Status</TableHead><TableHead className="pr-3">Ditarik</TableHead><TableHead className="pr-3">Baru</TableHead><TableHead>Keterangan</TableHead></TableRow></TableHeader>
            <TableBody>{runs.map((r) => (
              <TableRow key={r.id} className="border-t"><TableCell className="py-1.5 pr-3">{fmtWib(r.startedAt)}</TableCell><TableCell className="pr-3">{r.trigger === "schedule" ? "Jadwal" : "Manual"}</TableCell>
                <TableCell className="pr-3"><Pill tone={TONE[r.status]}>{LABEL[r.status]}</Pill></TableCell><TableCell className="pr-3">{r.fetchedCount}</TableCell><TableCell className="pr-3">{r.newCount}</TableCell><TableCell className="whitespace-normal text-red-700">{r.errorMessage}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-2 font-medium">Log agent dan sistem</h2>
        <ul className="space-y-1 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex gap-2"><span className="shrink-0 text-slate-500">{fmtWib(l.createdAt)}</span>
              <span className={l.level === "error" ? "text-red-700" : l.level === "warning" ? "text-amber-700" : ""}>{l.message}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
