"use client";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/** Taruh di dalam <Link>: menampilkan putaran selama tujuan tautan sedang dimuat. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 aria-label="Memuat" className="ml-auto size-4 animate-spin" /> : null;
}
