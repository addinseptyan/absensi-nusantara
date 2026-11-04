import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { db, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTodayOverview, required } from "@/lib/attendance/public";
import { fmtTime, fmtWib } from "@/lib/format";
import { firstAllowedPath } from "@/lib/nav";

export const metadata = { title: "Kehadiran hari ini" };

// Label umum sengaja netral: "alpa" ditulis "tidak tercatat hadir" karena datanya berasal dari scan mesin, dan izin/sakit digabung.
const PUBLIC: Record<string, [string, "ok" | "warn" | "bad" | "idle"]> = {
  hadir: ["Hadir", "ok"], dispensasi: ["Hadir", "ok"], terlambat: ["Terlambat", "warn"], izin: ["Izin/sakit", "idle"], sakit: ["Izin/sakit", "idle"],
  alpa: ["Tidak tercatat hadir", "bad"], pkl: ["PKL", "idle"], libur: ["Libur", "idle"],
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-gradient-to-br from-sky-50 via-slate-100 to-teal-50">
      <header className="border-b bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-teal-700 text-white"><Check className="size-5" strokeWidth={3} /></span>
            <div className="leading-tight"><p className="font-semibold text-slate-900">Absensi Nusantara</p><p className="text-xs text-slate-500">SMKS Nusantara Banyuwangi</p></div>
          </div>
          <Button render={<Link href="/login" />} nativeButton={false}>Masuk</Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 p-4 pb-12">{children}</main>
    </div>
  );
}

export default function Home() {
  return <Suspense fallback={<Frame><Skeleton className="h-8 w-64" /><Skeleton className="h-28 w-full" /><Skeleton className="h-56 w-full" /></Frame>}><HomeContent /></Suspense>;
}

async function HomeContent() {
  const user = await getCurrentUser();
  if (user) redirect(firstAllowedPath(user.permissions) ?? "/akun");

  const [flag] = await db.select().from(s.settings).where(eq(s.settings.key, "public_overview"));
  const mode = String(flag?.value ?? "2"); // 0 = wajib login, 1 = angka saja, 2 = angka + daftar nama disamarkan
  if (mode === "0") {
    return <Frame><GlassCard className="p-6 text-sm text-slate-700">Silakan masuk untuk melihat data kehadiran.</GlassCard></Frame>;
  }

  const o = await getTodayOverview();
  const wajib = required(o.total);
  const dateText = new Date(`${o.date}T12:00:00+07:00`).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const cards: [string, number, string][] = [
    ["Hadir", o.total.hadir + o.total.terlambat, `dari ${wajib} siswa`], ["Terlambat", o.total.terlambat, "termasuk yang hadir"], ["Izin dan sakit", o.total.izinSakit, ""],
    ["Tidak tercatat", o.total.alpa, "hadir"], ["Belum ada data", o.total.belum, "menunggu sinkronisasi"], ["PKL", o.total.pkl, ""],
  ];
  return (
    <Frame>
      <div><h1 className="text-2xl font-semibold text-slate-900">Kehadiran siswa hari ini</h1><p className="text-sm text-slate-600">{dateText}</p></div>
      {wajib === 0 && <GlassCard className="p-4 text-sm text-slate-700">Hari ini bukan hari efektif belajar, jadi tidak ada kehadiran yang dihitung.</GlassCard>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, v, hint]) => (
          <GlassCard key={label} className="p-3"><p className="text-xs text-slate-600">{label}</p><p className="text-2xl font-semibold tabular-nums">{v}</p>{hint && <p className="text-xs text-slate-500">{hint}</p>}</GlassCard>))}
      </div>
      <section className="rounded-2xl border bg-white">
        <h2 className="border-b px-4 py-2 font-medium">Per kelas</h2>
        <Table className="min-w-[560px] text-sm">
          <TableHeader><TableRow><TableHead className="px-4">Kelas</TableHead>{["Siswa", "Hadir", "Terlambat", "Izin/sakit", "Tidak tercatat", "Belum ada data", "PKL"].map((h) => <TableHead key={h} className="px-2 text-right">{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{o.perClass.map((c) => (
            <TableRow key={c.name}>
              <TableCell className="px-4 font-medium">{c.name}</TableCell>
              {[required(c), c.hadir + c.terlambat, c.terlambat, c.izinSakit, c.alpa, c.belum, c.pkl].map((v, i) => <TableCell key={i} className="px-2 text-right tabular-nums">{v}</TableCell>)}
            </TableRow>))}</TableBody>
        </Table>
      </section>
      {mode === "2" && wajib > 0 && (
        <section className="rounded-2xl border bg-white">
          <h2 className="border-b px-4 py-2 font-medium">Daftar siswa <span className="text-sm font-normal text-slate-500">(nama disamarkan)</span></h2>
          <Table className="min-w-[520px] text-sm">
            <TableHeader><TableRow><TableHead className="px-4">Nama</TableHead><TableHead>Kelas</TableHead><TableHead>Status</TableHead><TableHead>Masuk</TableHead></TableRow></TableHeader>
            <TableBody>{o.students.map((r, i) => {
              const [label, tone] = (r.status && PUBLIC[r.status]) || ["Belum ada data", "warn" as const];
              return (
                <TableRow key={i}>
                  <TableCell className="px-4 font-mono">{r.name}</TableCell><TableCell className="text-slate-600">{r.className}</TableCell>
                  <TableCell><Pill tone={tone}>{label}</Pill></TableCell><TableCell className="tabular-nums">{fmtTime(r.checkIn)}</TableCell>
                </TableRow>);
            })}</TableBody>
          </Table>
        </section>)}
      <p className="text-xs text-slate-500">Data diperbarui {o.syncedAt ? fmtWib(o.syncedAt) : "belum pernah"}. Status akhir hari (termasuk alpa) tersedia setelah sinkronisasi sore. Nama disamarkan; rincian lengkap hanya untuk pengguna yang masuk. Jika ada data yang tidak sesuai, hubungi kesiswaan.</p>
    </Frame>
  );
}
