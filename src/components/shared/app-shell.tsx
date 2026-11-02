import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, CalendarDays, Check, ClipboardCheck, Clock, Briefcase, GraduationCap, LayoutDashboard, LogOut, School, ShieldCheck, Users } from "lucide-react";
import { logout } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { allowedNav } from "@/lib/nav";
import { GlassCard } from "./glass-card";
import { MobileMenu, NavLink } from "./nav";
import { PasswordForm } from "./password-form";

const ICONS: Record<string, typeof Activity> = {
  "/rekap": LayoutDashboard, "/koreksi": ClipboardCheck, "/data": GraduationCap, "/kelas": School, "/pkl": Briefcase, "/kalender": CalendarDays,
  "/aturan": Clock, "/pengguna": Users, "/hak-akses": ShieldCheck, "/kesehatan": Activity,
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const items = user.mustChangePassword ? [] : allowedNav(user.permissions);

  const links = items.map(({ href, label }) => { const Icon = ICONS[href]; return <NavLink key={href} href={href} label={label} icon={<Icon className="size-4" />} />; });
  const account = (
    <div className="mt-2 flex items-center gap-1.5 border-t border-slate-200/70 pt-3">
      <Link href="/akun" title={user.username ? `Akun saya (@${user.username})` : "Akun saya"}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/80">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800">{initials(user.name)}</span>
        <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{user.name}</span>
          <span className="block truncate text-xs text-slate-500">{user.roles.join(", ") || "Tanpa role"}</span></span>
      </Link>
      <form action={logout}>
        <button type="submit" title="Keluar" aria-label="Keluar" className="grid size-10 place-items-center border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-red-50 hover:text-red-700">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
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
        <GlassCard className="sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-60 shrink-0 flex-col gap-1 overflow-hidden p-3 md:flex">
          <div className="shrink-0 px-1 pb-3 pt-1">{brand}</div>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5">{links}</nav>
          <div className="shrink-0">{account}</div>
        </GlassCard>
        <main className="min-w-0 flex-1 pb-10">
          {user.mustChangePassword ? <GlassCard className="max-w-md space-y-3 p-5"><h1 className="text-xl font-semibold text-slate-900">Ganti kata sandi</h1><PasswordForm forced /></GlassCard> : children}
        </main>
      </div>
    </div>
  );
}
