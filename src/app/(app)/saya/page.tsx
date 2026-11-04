import { redirect } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import PersonDetailPage from "../rekap/[personId]/page";

// Menampilkan rincian kehadiran milik sendiri di alamat /saya, sehingga menu "Kehadiran saya" tetap menyala.
export default async function MyAttendancePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; libur?: string; tahun?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.personId) return <GlassCard className="p-6 text-sm text-slate-700">Akun Anda belum dihubungkan ke data guru, jadi kehadiran pribadi belum bisa ditampilkan. Hubungi admin sekolah.</GlassCard>;
  return PersonDetailPage({ params: Promise.resolve({ personId: String(user.personId) }), searchParams });
}
