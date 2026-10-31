"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const active = usePathname().startsWith(href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-teal-700 text-white shadow-sm" : "text-slate-700 hover:bg-white/80")}>
      {icon}{label}
    </Link>
  );
}

/** Menu geser untuk layar kecil. Menutup sendiri setelah pindah halaman. */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <button type="button" aria-expanded={open} aria-label={open ? "Tutup menu" : "Buka menu"} onClick={() => setOpen(!open)}
        className="grid size-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-800 shadow-sm active:bg-slate-100">
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && <div className="absolute inset-x-0 top-full max-h-[calc(100vh-4rem)] space-y-1 overflow-y-auto border-b bg-white/95 p-3 shadow-lg backdrop-blur-xl">{children}</div>}
    </>
  );
}
