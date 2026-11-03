"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateField } from "./date-field";
import { SelectField } from "./select-field";

/** Tombol "Unduh" yang membuka pengaturan cetak (tempat, tanggal, penanda tangan), lalu mengunduh Excel atau PDF. */
export function ExportDialog({ params, signOptions, defaultPlace, defaultDate }: {
  params: Record<string, string>; signOptions: { value: string; label: string }[]; defaultPlace: string; defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}><Download className="size-4" />Unduh…</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Pengaturan cetak dan unduh</DialogTitle><DialogDescription>Atur tempat, tanggal, dan penanda tangan yang tercetak di laporan.</DialogDescription></DialogHeader>
        <form method="get" action="/api/export/rekap" className="space-y-4" onSubmit={() => setTimeout(() => setOpen(false), 400)}>
          {Object.entries(params).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">Tempat<Input name="tempat" defaultValue={defaultPlace} maxLength={60} /></label>
            <label className="space-y-1 text-sm">Tanggal<DateField name="tanggal" defaultValue={defaultDate} /></label>
          </div>
          <label className="block space-y-1 text-sm">Tanda tangan
            <SelectField name="ttd" defaultValue={signOptions[0]?.value}>{signOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          </label>
          <p className="text-xs text-muted-foreground">Pilih "Kosong" bila jabatan dan nama akan ditulis tangan: titik-titik dicetak sebagai gantinya. Nama pejabat dan NIP diatur di menu Pengaturan sekolah.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="format" value="xlsx">Unduh Excel</Button>
            <Button type="submit" name="format" value="pdf" variant="outline">Unduh PDF</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
