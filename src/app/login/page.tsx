"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/shared/glass-card";
import { PasswordInput } from "@/components/shared/password-input";
import { login } from "./actions";

export default function LoginPage() {
   const [error, formAction, pending] = useActionState(login, undefined);
   return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-br from-sky-100 via-slate-100 to-teal-100 p-4">
         <GlassCard className="w-full max-w-sm p-6">
            {/* Link kembali ke Homepage */}
            <Link
               href="/"
               className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-sky-700"
            >
               <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
               >
                  <path d="m15 18-6-6 6-6" />
                  <path d="M9 12h12" />
               </svg>
               Kembali ke halaman depan
            </Link>
            <h1 className="text-xl font-semibold text-slate-900">Masuk ke Absensi Nusantara</h1>
            <p className="mb-5 mt-1 text-sm text-slate-600">Gunakan akun yang diberikan admin sekolah.</p>
            <form action={formAction} className="space-y-4">
               <div className="space-y-1.5"><Label htmlFor="login">Username atau email</Label><Input id="login" name="login" type="text" autoComplete="username" autoCapitalize="none" required /></div>
               <div className="space-y-1.5"><Label htmlFor="password">Kata sandi</Label><PasswordInput id="password" name="password" autoComplete="current-password" required /></div>
               {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
               <Button type="submit" className="w-full" disabled={pending}>{pending ? "Memeriksa…" : "Masuk"}</Button>
            </form>
         </GlassCard>
      </div>
   );
}
