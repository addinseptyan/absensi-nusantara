"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { guard } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";

const Body = z.object({
  school_name: z.string().trim().min(3, "Nama sekolah minimal 3 huruf.").max(120),
  print_place: z.string().trim().max(60),
  principal_title: z.string().trim().max(60),
  principal_name: z.string().trim().max(120),
  principal_nip: z.string().trim().max(30),
  public_overview: z.enum(["1", "0"]),
});

export async function saveSchoolSettings(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("settings.rules");
    const f = Body.parse(Object.fromEntries(form));
    const ops = Object.entries(f).map(([key, value]) => db.insert(s.settings).values({ key, value }).onConflictDoUpdate({ target: s.settings.key, set: { value } }));
    await db.batch(ops as unknown as Parameters<typeof db.batch>[0]);
    await audit(user.id, "settings.update", "settings", "sekolah", f);
    revalidatePath("/pengaturan");
    return "Pengaturan sekolah disimpan. Berlaku untuk unduhan berikutnya.";
  });
}
