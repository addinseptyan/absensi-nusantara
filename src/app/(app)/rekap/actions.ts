"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/current-user";
import { recompute } from "@/lib/attendance/recompute";
import { eachDate } from "@/lib/attendance/time";

const Range = z.object({ from: z.string().date(), to: z.string().date() });

export async function recomputeRange(form: FormData) {
  await requirePermission("settings.rules");
  const r = Range.parse(Object.fromEntries(form));
  if (r.from > r.to || eachDate(r.from, r.to).length > 62) throw new Error("Rentang maksimal 62 hari.");
  await recompute(r.from, r.to);
  revalidatePath("/rekap");
}
