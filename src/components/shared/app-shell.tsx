import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can, type PermissionCode } from "@/lib/permissions";
import { GlassCard } from "./glass-card";

// Menu baru = tambah satu baris di sini. Menu otomatis disembunyikan jika izinnya tidak ada.
const NAV: { href: string; label: string; icon: typeof Activity; perm: PermissionCode | PermissionCode[] }[] = [
  { href: "/kesehatan", label: "Kesehatan sistem", icon: Activity, perm: "system.health" },
  { href: "/rekap", label: "Rekap kehadiran", icon: LayoutDashboard, perm: ["rekap.view_all", "rekap.view_own_class"] },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const items = NAV.filter((n) => [n.perm].flat().some((p) => can(user.permissions, p)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-100 to-teal-50 p-3 md:p-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row">
        <GlassCard className="flex shrink-0 flex-col gap-1 p-3 md:sticky md:top-5 md:h-[calc(100vh-2.5rem)] md:w-60">
          <div className="px-2 pb-3 pt-1">
            <p className="font-semibold text-slate-900">Absensi Nusantara</p>
            <p className="text-xs text-slate-500">SMKS Nusantara Banyuwangi</p>
          </div>
          <nav className="flex gap-1 md:flex-col">
            {items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-teal-600">
                <Icon className="size-4" /> {label}
              </Link>
            ))}
          </nav>
          <form action={logout} className="mt-auto hidden border-t border-white/60 pt-3 md:block">
            <p className="truncate px-2 text-sm font-medium text-slate-800">{user.name}</p>
            <p className="mb-2 truncate px-2 text-xs text-slate-500">{user.email}</p>
            <Button variant="ghost" size="sm" className="w-full justify-start"><LogOut className="size-4" /> Keluar</Button>
          </form>
        </GlassCard>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
