import { redirect } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function MyAttendancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.personId) redirect(`/rekap/${user.personId}`);
  return <GlassCard className="p-6 text-sm text-slate-700">Akun Anda belum dihubungkan ke data guru, jadi kehadiran pribadi belum bisa ditampilkan. Hubungi admin sekolah.</GlassCard>;
}
