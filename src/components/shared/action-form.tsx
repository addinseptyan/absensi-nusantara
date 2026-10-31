"use client";
import { createContext, useContext, useRef, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action";

type Action = (form: FormData) => Promise<ActionResult>;
const Pending = createContext(false);
const OFFLINE = "Tidak dapat menghubungi server. Periksa koneksi internet lalu coba lagi.";

async function execute(action: Action, data: FormData): Promise<boolean> {
  try {
    const r = await action(data);
    (r.ok ? toast.success : toast.error)(r.message);
    return r.ok;
  } catch {
    toast.error(OFFLINE);
    return false;
  }
}

function ConfirmDialog({ dialog, title, description, confirmLabel, danger, onConfirm }: {
  dialog: React.RefObject<HTMLDialogElement | null>; title: string; description: string; confirmLabel: string; danger?: boolean; onConfirm: () => void;
}) {
  return (
    <dialog ref={dialog} onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border bg-white p-0 shadow-xl backdrop:bg-slate-900/40">
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>Batal</Button>
          <Button type="button" variant={danger ? "destructive" : "default"} onClick={() => { dialog.current?.close(); onConfirm(); }}>{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}

/** Form yang memberi umpan balik (toast), mengunci tombol saat diproses, dan bisa meminta konfirmasi dulu. */
export function ActionForm({ action, reset, confirm, children, ...props }: Omit<React.ComponentProps<"form">, "action" | "onSubmit"> & {
  action: Action; reset?: boolean; confirm?: { title: string; description: string; label?: string };
}) {
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const held = useRef<{ data: FormData; form: HTMLFormElement } | null>(null);
  const run = (data: FormData, form: HTMLFormElement) => start(async () => { if ((await execute(action, data)) && reset) form.reset(); });

  return (
    <Pending.Provider value={pending}>
      <form {...props} onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget, data = new FormData(form);
        if (confirm) { held.current = { data, form }; dialog.current?.showModal(); } else run(data, form);
      }}>{children}</form>
      {confirm && <ConfirmDialog dialog={dialog} title={confirm.title} description={confirm.description} confirmLabel={confirm.label ?? "Ya, lanjutkan"}
        onConfirm={() => held.current && run(held.current.data, held.current.form)} />}
    </Pending.Provider>
  );
}

/** Tombol untuk tindakan berisiko (hapus, nonaktifkan): selalu muncul dialog konfirmasi. */
export function ConfirmAction({ action, fields = {}, label, title, description, confirmLabel, tone = "danger" }: {
  action: Action; fields?: Record<string, string | number>; label: string; title: string; description: string; confirmLabel?: string; tone?: "danger" | "neutral";
}) {
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const run = () => start(async () => {
    const data = new FormData();
    Object.entries(fields).forEach(([k, v]) => data.append(k, String(v)));
    await execute(action, data);
  });
  return (
    <>
      <Button type="button" size="sm" variant={tone === "danger" ? "destructive" : "outline"} disabled={pending} onClick={() => dialog.current?.showModal()}>
        {pending && <Loader2 className="size-4 animate-spin" />}{label}
      </Button>
      <ConfirmDialog dialog={dialog} title={title} description={description} confirmLabel={confirmLabel ?? label} danger={tone === "danger"} onConfirm={run} />
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
