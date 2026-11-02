import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Satu-satunya komponen "kaca". Dipakai untuk sidebar dan kartu ringkasan; tabel data tetap solid agar terbaca. */
export function GlassCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-white/60 bg-white/60 shadow-[0_8px_30px_rgba(20,50,80,0.08)] backdrop-blur-xl", className)} {...props} />;
}

const TONES = { ok: "bg-emerald-100 text-emerald-800", warn: "bg-amber-100 text-amber-800", bad: "bg-red-100 text-red-800", idle: "bg-slate-200 text-slate-700" };
export function Pill({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn("select-none gap-1.5 border-transparent font-medium", TONES[tone])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />{children}
    </Badge>
  );
}
