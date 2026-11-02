import { redirect } from "next/navigation";
import { Activity, Briefcase, CalendarDays, ClipboardCheck, ClipboardList, Clock, GraduationCap, LayoutDashboard, School, ShieldCheck, UserCheck, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/lib/auth/current-user";
import { allowedNav } from "@/lib/nav";
import { AppSidebar } from "./app-sidebar";
import { GlassCard } from "./glass-card";
import { PasswordForm } from "./password-form";

const ICONS: Record<string, typeof Activity> = {
  "/rekap": LayoutDashboard, "/rekap-guru": ClipboardList, "/saya": UserCheck, "/koreksi": ClipboardCheck, "/data": GraduationCap, "/kelas": School, "/pkl": Briefcase,
  "/kalender": CalendarDays, "/aturan": Clock, "/pengguna": Users, "/hak-akses": ShieldCheck, "/kesehatan": Activity,
};

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const items = (user.mustChangePassword ? [] : allowedNav(user.permissions).filter((n) => n.href !== "/saya" || user.personId)).map(({ href, label }) => {
    const Icon = ICONS[href];
    return { href, label, icon: <Icon /> };
  });

  return (
    <SidebarProvider>
      <AppSidebar items={items} user={{ name: user.name, username: user.username, roles: user.roles }} />
      <SidebarInset className="min-h-svh bg-gradient-to-br from-sky-50 via-slate-100 to-teal-50">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-white/80 px-3 backdrop-blur-xl">
          <SidebarTrigger /><Separator orientation="vertical" className="data-[orientation=vertical]:h-5" />
          <span className="text-sm font-medium text-slate-700">Absensi Nusantara</span>
        </header>
        <div className="mx-auto w-full max-w-6xl p-3 pb-10 md:p-5">
          {user.mustChangePassword
            ? <GlassCard className="max-w-md space-y-3 p-5"><h1 className="text-xl font-semibold text-slate-900">Ganti kata sandi</h1><PasswordForm forced /></GlassCard>
            : children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
