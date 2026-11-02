import { Suspense } from "react";
import { AppShell } from "@/components/shared/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

// Suspense wajib karena proyek memakai cacheComponents: pembacaan sesi/DB terjadi saat permintaan.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="space-y-3 p-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
