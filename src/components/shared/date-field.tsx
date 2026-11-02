"use client";
import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const parse = (v: string) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Pengganti <input type="date">: shadcn Calendar di dalam Popover. Nilai dikirim sebagai YYYY-MM-DD. */
export function DateField({ name, defaultValue, className, placeholder = "Pilih tanggal" }: {
  name?: string; defaultValue?: string | null; className?: string; placeholder?: string; required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const date = value ? parse(value) : undefined;
  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button type="button" variant="outline" className={cn("w-full justify-start font-normal", !date && "text-muted-foreground", className)} />}>
          <CalendarIcon className="size-4" />
            {date ? date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} defaultMonth={date} locale={localeId} weekStartsOn={1} captionLayout="dropdown"
            startMonth={new Date(2020, 0)} endMonth={new Date(2035, 11)}
            onSelect={(d) => { setValue(d ? iso(d) : ""); setOpen(false); }} />
        </PopoverContent>
      </Popover>
    </>
  );
}
