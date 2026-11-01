"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-3 rounded-2xl border bg-white p-6">
      <h1 className="text-lg font-semibold text-slate-900">Halaman ini tidak bisa dibuka</h1>
      <p className="text-sm text-slate-600">Kemungkinan akun Anda belum punya izin untuk halaman ini, atau ada gangguan sementara. Jika Anda yakin seharusnya punya akses, hubungi admin sekolah.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">Kembali ke beranda</Link>
        <button type="button" onClick={reset} className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">Coba lagi</button>
      </div>
    </div>
  );
}
