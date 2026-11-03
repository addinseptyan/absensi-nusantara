"use client";
import { createContext, useContext, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action";
import { cn } from "@/lib/utils";
import { useCloseModal } from "./modal";

type Action = (form: FormData) => Promise<ActionResult>;
const Pending = createContext(false);

async function execute(action: Action, data: FormData): Promise<boolean> {
  try {
    const r = await action(data);
    (r.ok ? toast.success : toast.error)(r.message);
    return r.ok;
  } catch {
    toast.error("Tidak dapat menghubungi server. Periksa koneksi internet lalu coba lagi.");
    return false;
  }
}

function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, danger, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; confirmLabel: string; danger?: boolean; onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction className={cn(danger && buttonVariants({ variant: "destructive" }))} onClick={() => { onOpenChange(false); onConfirm(); }}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Form yang memberi umpan balik (toast), mengunci tombol saat diproses, dan bisa meminta konfirmasi dulu. */
export function ActionForm({ action, reset, confirm, children, ...props }: Omit<React.ComponentProps<"form">, "action" | "onSubmit"> & {
  action: Action; reset?: boolean; confirm?: { title: string; description: string; label?: string };
}) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const held = useRef<{ data: FormData; form: HTMLFormElement } | null>(null);
  const closeModal = useCloseModal();
  const run = (data: FormData, form: HTMLFormElement) => start(async () => {
    const ok = await execute(action, data);
    if (ok && reset) form.reset();
    if (ok) closeModal?.(); // form di dalam jendela (Modal) menutup jendelanya sendiri
  });

  return (
    <Pending.Provider value={pending}>
      <form {...props} onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget, data = new FormData(form);
        if (confirm) { held.current = { data, form }; setAsking(true); } else run(data, form);
      }}>{children}</form>
      {confirm && <ConfirmDialog open={asking} onOpenChange={setAsking} title={confirm.title} description={confirm.description} confirmLabel={confirm.label ?? "Ya, lanjutkan"}
        onConfirm={() => held.current && run(held.current.data, held.current.form)} />}
    </Pending.Provider>
  );
}

/** Tombol untuk tindakan berisiko (hapus, nonaktifkan): selalu muncul dialog konfirmasi. */
export function ConfirmAction({ action, fields = {}, label, title, description, confirmLabel, tone = "danger" }: {
  action: Action; fields?: Record<string, string | number>; label: string; title: string; description: string; confirmLabel?: string; tone?: "danger" | "neutral";
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const run = () => start(async () => {
    const data = new FormData();
    Object.entries(fields).forEach(([k, v]) => data.append(k, String(v)));
    await execute(action, data);
  });
  return (
    <>
      <Button type="button" size="sm" variant={tone === "danger" ? "destructive" : "outline"} disabled={pending} onClick={() => setOpen(true)}>
        {pending && <Loader2 className="size-4 animate-spin" />}{label}
      </Button>
      <ConfirmDialog open={open} onOpenChange={setOpen} title={title} description={description} confirmLabel={confirmLabel ?? label} danger={tone === "danger"} onConfirm={run} />
    </>
  );
}

/** Tombol kirim: menampilkan putaran dan teks "Menyimpan…" saat form sedang diproses. */
export function SubmitButton({ children, pendingText = "Menyimpan…", ...props }: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const pending = useContext(Pending);
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending ? <><Loader2 className="size-4 animate-spin" />{pendingText}</> : children}
    </Button>
  );
}

/** Form filter (pencarian, tanggal, kelas): berpindah lewat navigasi dalam aplikasi, tombolnya menampilkan putaran, dan bagian kosong tidak ikut dikirim. */
export function FilterForm({ children, ...props }: Omit<React.ComponentProps<"form">, "action" | "onSubmit">) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  return (
    <Pending.Provider value={pending}>
      <form {...props} onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        new FormData(e.currentTarget).forEach((v, k) => { if (typeof v === "string" && v !== "") params.set(k, v); });
        const qs = params.toString();
        start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
      }}>{children}</form>
    </Pending.Provider>
  );
}
