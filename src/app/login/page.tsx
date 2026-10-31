"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/shared/glass-card";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, undefined);
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-sky-100 via-slate-100 to-teal-100 p-4">
      <GlassCard className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold text-slate-900">Masuk ke Absensi Nusantara</h1>
        <p className="mb-5 mt-1 text-sm text-slate-600">Gunakan akun yang diberikan admin sekolah.</p>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="username" required /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Kata sandi</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Memeriksa…" : "Masuk"}</Button>
        </form>
      </GlassCard>
    </div>
  );
}
