"use client";
import { createContext, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ModalCtx = createContext<(() => void) | null>(null);
/** Dipakai ActionForm untuk menutup jendela setelah form di dalamnya berhasil disimpan. */
export const useCloseModal = () => useContext(ModalCtx);

export function Modal({ label, title, description, children }: { label: string; title: string; description?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>{label}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription className="sr-only">{description ?? title}</DialogDescription></DialogHeader>
        <ModalCtx.Provider value={() => setOpen(false)}>{children}</ModalCtx.Provider>
      </DialogContent>
    </Dialog>
  );
}
