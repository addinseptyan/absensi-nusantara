"use client";
import { Children, isValidElement, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NONE = "__kosong__"; // shadcn Select tidak menerima nilai kosong
type Opt = { value: string; label: string };

/** Membaca anak <option> agar pemakaian sama seperti <select> biasa. */
function readOptions(children: React.ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.toArray(children).forEach((c) => {
    if (!isValidElement<{ value?: string | number; children?: React.ReactNode }>(c)) return;
    const label = Children.toArray(c.props.children).join("");
    out.push({ value: String(c.props.value ?? label), label });
  });
  return out;
}

/** Pengganti <select>: shadcn Select, atau Combobox (bisa dicari) jika pilihan banyak. Tetap ikut terkirim bersama form. */
export function SelectField({ name, defaultValue, children, className, placeholder = "Pilih…", searchable, disabled }: {
  name?: string; defaultValue?: string | number | null; children: React.ReactNode; className?: string;
  placeholder?: string; searchable?: boolean; disabled?: boolean; required?: boolean;
}) {
  const opts = readOptions(children);
  const start = String(defaultValue ?? "");
  const [value, setValue] = useState(opts.some((o) => o.value === start) ? start : (opts[0]?.value ?? ""));
  const [open, setOpen] = useState(false);
  // hanya kelas lebar yang dipertahankan; tampilan lain diurus komponen shadcn
  const width = className?.split(/\s+/).filter((t) => /^((sm|md|lg):)?(w-|min-w-|max-w-|flex-1|grow)/.test(t)).join(" ");
  const items = opts.map((o) => ({ value: o.value === "" ? NONE : o.value, label: o.label })); // agar nilai terpilih tampil sebagai label
  const hidden = name ? <input type="hidden" name={name} value={value} /> : null;

  if (!(searchable ?? opts.length > 8)) {
    return (
      <>
        {hidden}
        <Select items={items} value={value === "" ? NONE : value} onValueChange={(v) => setValue(!v || v === NONE ? "" : v)} disabled={disabled}>
          <SelectTrigger className={cn("w-full", width)}><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value === "" ? NONE : o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </>
    );
  }
  const current = opts.find((o) => o.value === value);
  return (
    <>
      {hidden}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className={cn("w-full justify-between font-normal", width)} />}>
            <span className="truncate">{current?.label ?? placeholder}</span><ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) min-w-48 p-0" align="start">
          <Command>
            <CommandInput placeholder="Cari…" />
            <CommandList>
              <CommandEmpty>Tidak ditemukan.</CommandEmpty>
              <CommandGroup>{opts.map((o) => (
                <CommandItem key={o.value} value={o.label} keywords={[o.value]} onSelect={() => { setValue(o.value); setOpen(false); }}>
                  <Check className={cn("size-4", o.value === value ? "opacity-100" : "opacity-0")} />{o.label}
                </CommandItem>))}</CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
