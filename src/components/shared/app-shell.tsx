import { redirect } from "next/navigation";
import { Activity, CalendarDays, Check, ClipboardCheck, Clock, GraduationCap, LayoutDashboard, LogOut, ShieldCheck, Users } from "lucide-react";
import { logout } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can, type PermissionCode } from "@/lib/permissions";
import { GlassCard } from "./glass-card";
import { MobileMenu, NavLink } from "./nav";

// Menu baru = tambah satu baris di sini. Menu otomatis disembunyikan jika izinnya tidak ada.
const NAV: { href: string; label: string; icon: typeof Activity; perm: PermissionCode | PermissionCode[] }[] = [
  { href: "/rekap", label: "Rekap kehadiran", icon: LayoutDashboard, perm: ["rekap.view_all", "rekap.view_own_class"] },
  { href: "/koreksi", label: "Koreksi kehadiran", icon: ClipboardCheck, perm: ["attendance.correct", "leave.create_own_class"] },
  { href: "/data", label: "Data siswa & guru", icon: GraduationCap, perm: ["student.manage", "staff.manage"] },
  { href: "/kalender", label: "Kalender", icon: CalendarDays, perm: "calendar.manage" },
  { href: "/aturan", label: "Aturan jam", icon: Clock, perm: "settings.rules" },
  { href: "/pengguna", label: "Pengguna", icon: Users, perm: "user.manage" },
  { href: "/hak-akses", label: "Hak akses", icon: ShieldCheck, perm: "role.manage" },
  { href: "/kesehatan", label: "Kesehatan sistem", icon: Activity, perm: "system.health" },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const items = NAV.filter((n) => [n.perm].flat().some((p) => can(user.permissions, p)));

  const links = items.map(({ href, label, icon: Icon }) => <NavLink key={href} href={href} label={label} icon={<Icon className="size-4" />} />);
  const account = (
    <form action={logout} className="mt-2 space-y-2 border-t border-slate-200/70 pt-3">
      <div className="px-1"><p className="truncate text-sm font-medium text-slate-800">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
      <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100">
        <LogOut className="size-4" /> Keluar
      </button>
    </form>
  );
  const brand = (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-teal-700 text-white shadow-sm"><Check className="size-5" strokeWidth={3} /></span>
      <div className="leading-tight"><p className="font-semibold text-slate-900">Absensi Nusantara</p><p className="text-xs text-slate-500">SMKS Nusantara Banyuwangi</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-100 to-teal-50">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/60 bg-white/80 px-4 py-2.5 backdrop-blur-xl md:hidden">
        {brand}
        <MobileMenu>{links}{account}</MobileMenu>
      </header>
      <div className="mx-auto flex max-w-6xl gap-4 p-3 md:p-5">
        <GlassCard className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-60 shrink-0 flex-col gap-1 p-3 md:flex">
          <div className="px-1 pb-3 pt-1">{brand}</div>
          <nav className="flex flex-col gap-1">{links}</nav>
          <div className="mt-auto">{account}</div>
        </GlassCard>
        <main className="min-w-0 flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}
