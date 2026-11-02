"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-white p-6">
      <h1 className="text-lg font-semibold text-slate-900">Halaman ini tidak bisa dibuka</h1>
      <p className="text-sm text-slate-600">Kemungkinan akun Anda belum punya izin untuk halaman ini, atau ada gangguan sementara. Jika Anda yakin seharusnya punya akses, hubungi admin sekolah.</p>
      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/" />} nativeButton={false}>Kembali ke beranda</Button>
        <Button variant="outline" onClick={reset}>Coba lagi</Button>
      </div>
    </div>
  );
}
