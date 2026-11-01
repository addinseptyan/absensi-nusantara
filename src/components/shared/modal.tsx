"use client";
import { useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Tombol yang membuka jendela berisi form. Jendela menutup sendiri saat form di dalamnya berhasil disimpan. */
export function Modal({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.showModal()}>{label}</Button>
      <dialog ref={ref} onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border bg-white p-0 shadow-xl backdrop:bg-slate-900/40">
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <button type="button" aria-label="Tutup" onClick={() => ref.current?.close()} className="grid size-9 place-items-center text-slate-500 hover:bg-slate-100"><X className="size-5" /></button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
