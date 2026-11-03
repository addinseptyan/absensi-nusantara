import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Tampil seketika saat pindah halaman, sementara halaman baru disiapkan server.
export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />Memuat halaman…</p>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
