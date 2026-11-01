import { changePassword } from "@/app/(app)/akun/actions";
import { Input } from "@/components/ui/input";
import { ActionForm, SubmitButton } from "./action-form";

export function PasswordForm({ forced }: { forced?: boolean }) {
  return (
    <ActionForm action={changePassword} reset className="space-y-4">
      {forced && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Demi keamanan, ganti kata sandi sementara Anda sebelum memakai aplikasi.</p>}
      <label className="block space-y-1 text-sm">Kata sandi saat ini<Input name="current" type="password" autoComplete="current-password" required /></label>
      <label className="block space-y-1 text-sm">Kata sandi baru (minimal 8 karakter)<Input name="next" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label className="block space-y-1 text-sm">Ulangi kata sandi baru<Input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
      <SubmitButton>Ganti kata sandi</SubmitButton>
    </ActionForm>
  );
}
