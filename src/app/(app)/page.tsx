import { redirect } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { firstAllowedPath } from "@/lib/nav";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const target = firstAllowedPath(user.permissions);
  if (target) redirect(target);
  return <GlassCard className="p-6 text-sm text-slate-700">Akun Anda belum memiliki akses ke fitur apa pun. Hubungi admin sekolah untuk mengatur hak akses.</GlassCard>;
}
