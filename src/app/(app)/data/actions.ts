"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { guard } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";
import { fullName, normalizePhone } from "@/lib/person";

const text = (max: number) => z.string().trim().max(max).optional();
const Person = z.object({
  id: z.string().optional(), type: z.enum(["student", "staff"]),
  name: z.string().trim().min(2, "Nama minimal 2 huruf.").max(100),
  titlePrefix: text(30), titleSuffix: text(30), nis: text(30), nip: text(30), parentPhone: text(20), classId: z.string().optional(),
  devicePin: z.string().trim().max(20).regex(/^[A-Za-z0-9]*$/, "PIN mesin hanya boleh huruf dan angka.").optional(),
  status: z.enum(["active", "graduated", "moved", "inactive"]),
});
const empty = (v?: string) => (v?.trim() ? v.trim() : null);

export async function savePerson(form: FormData) {
  return guard(async () => {
    const f = Person.parse(Object.fromEntries(form));
    const id = f.id ? Number(f.id) : null;
    const [existing] = id ? await db.select().from(s.people).where(eq(s.people.id, id)) : [];
    if (id && !existing) throw new Error("Data tidak ditemukan.");
    const type = existing?.type ?? f.type; // jenis tidak bisa diubah setelah dibuat
    const user = await requirePermission(type === "student" ? "student.manage" : "staff.manage");

    const pin = empty(f.devicePin);
    if (pin) {
      const [dup] = await db.select({ name: s.people.name }).from(s.people).where(and(eq(s.people.devicePin, pin), id ? ne(s.people.id, id) : undefined));
      if (dup) throw new Error(`PIN mesin ${pin} sudah dipakai oleh ${dup.name}.`);
    }
    const values = {
      name: f.name, titlePrefix: empty(f.titlePrefix), titleSuffix: empty(f.titleSuffix), devicePin: pin, status: f.status,
      nis: type === "student" ? empty(f.nis) : null, nip: type === "staff" ? empty(f.nip) : null, parentPhone: normalizePhone(f.parentPhone),
    };
    const personId = id ?? (await db.insert(s.people).values({ type, ...values }).returning({ id: s.people.id }))[0].id;
    if (id) await db.update(s.people).set(values).where(eq(s.people.id, id));

    if (type === "student" && f.classId) {
      const [ay] = await db.select().from(s.academicYears).where(eq(s.academicYears.isActive, true));
      const [mine] = await db.select({ id: s.classEnrollments.id }).from(s.classEnrollments)
        .innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
        .where(and(eq(s.classEnrollments.personId, personId), eq(s.classes.academicYearId, ay.id)));
      if (mine) await db.update(s.classEnrollments).set({ classId: Number(f.classId) }).where(eq(s.classEnrollments.id, mine.id));
      else await db.insert(s.classEnrollments).values({ personId, classId: Number(f.classId), startDate: ay.startDate });
    }
    if (type === "staff") {
      const days = [...new Set(form.getAll("wd").map(Number).filter((d) => d >= 1 && d <= 6))];
      await db.delete(s.staffWorkDays).where(eq(s.staffWorkDays.staffId, personId));
      if (days.length) await db.insert(s.staffWorkDays).values(days.map((weekday) => ({ staffId: personId, weekday })));
    }
    await audit(user.id, id ? "person.update" : "person.create", "people", String(personId), { name: f.name, status: f.status });
    revalidatePath("/data");
    return id ? `Perubahan ${fullName(values)} disimpan. Tekan Hitung ulang di halaman Rekap jika kelas atau status berubah.` : `${fullName(values)} ditambahkan.`;
  });
}
