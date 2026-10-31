import { Suspense } from "react";
import { AppShell } from "@/components/shared/app-shell";

// Suspense wajib karena proyek memakai cacheComponents: pembacaan sesi/DB terjadi saat permintaan.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-slate-500">Memuat…</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
