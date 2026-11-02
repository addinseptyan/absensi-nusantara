"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Kolom kata sandi dengan tombol mata untuk menampilkan atau menyembunyikan isinya. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={cn("pr-11", className)} />
      <Tooltip>
        <TooltipTrigger type="button" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-500 hover:text-slate-900">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </TooltipTrigger>
        <TooltipContent>{show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}</TooltipContent>
      </Tooltip>
    </div>
  );
}
