import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { ActionForm, SubmitButton } from "@/components/shared/action-form";
import { GlassCard } from "@/components/shared/glass-card";
import { PasswordForm } from "@/components/shared/password-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { updateProfile } from "./actions";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Akun saya</h1>
      <GlassCard className="space-y-4 p-4">
        <h2 className="font-medium">Profil</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Username</dt><dd>{user.username ?? "-"}</dd></div>
          <div><dt className="text-slate-500">Role</dt><dd>{user.roles.join(", ") || "-"}</dd></div>
        </dl>
        <ActionForm action={updateProfile} className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 space-y-1 text-sm">Nama tampilan<Input name="name" defaultValue={user.name} required minLength={2} maxLength={100} /></label>
          <SubmitButton variant="outline">Simpan nama</SubmitButton>
        </ActionForm>
        <p className="text-xs text-slate-500">Username dan role diatur oleh admin sekolah.</p>
      </GlassCard>
      <GlassCard className="max-w-md space-y-3 p-4"><h2 className="font-medium">Ganti kata sandi</h2><PasswordForm /></GlassCard>
    </div>
  );
}
