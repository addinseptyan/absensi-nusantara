"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { guard } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";
import { fullName } from "@/lib/person";

export async function setHomeroom(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("class.manage");
    const f = z.object({ classId: z.coerce.number().int(), staffId: z.string().optional() }).parse(Object.fromEntries(form));
    const [cls] = await db.select().from(s.classes).where(eq(s.classes.id, f.classId));
    if (!cls) throw new Error("Kelas tidak ditemukan.");
    let teacher = "tidak ada";
    if (f.staffId) {
      const [t] = await db.select().from(s.people).where(and(eq(s.people.id, Number(f.staffId)), eq(s.people.type, "staff")));
      if (!t) throw new Error("Guru tidak ditemukan.");
      teacher = fullName(t);
    }
    await db.update(s.classes).set({ homeroomStaffId: f.staffId ? Number(f.staffId) : null }).where(eq(s.classes.id, f.classId));
    await audit(user.id, "class.homeroom_set", "classes", String(f.classId), { teacher });
    revalidatePath("/kelas");
    return `Wali kelas ${cls.name}: ${teacher}.`;
  });
}
