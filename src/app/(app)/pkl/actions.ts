"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { guard } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";
import { recomputeCapped } from "@/lib/attendance/recompute";

const Body = z.object({ place: z.string().trim().min(2, "Tempat PKL minimal 2 huruf.").max(120), from: z.string().date(), to: z.string().date() });
const Key = z.object({ oPlace: z.string(), oFrom: z.string().date(), oTo: z.string().date() });
const keyWhere = (k: z.infer<typeof Key>) => and(eq(s.pklAssignments.placeName, k.oPlace), eq(s.pklAssignments.startDate, k.oFrom), eq(s.pklAssignments.endDate, k.oTo));

// Rentang PKL panjang; hitung ulang otomatis bila memungkinkan, jika gagal data tetap tersimpan.
async function refresh(from: string, to: string) {
  try { return await recomputeCapped(from, to, 130); } catch { return false; }
}
const note = (ok: boolean) => (ok ? "Rekap sudah dihitung ulang." : "Tekan Hitung ulang di halaman Rekap agar rekap ikut berubah.");

export async function addPkl(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("pkl.manage");
    const f = Body.parse(Object.fromEntries(form));
    if (f.from > f.to) throw new Error("Tanggal selesai harus setelah tanggal mulai.");
    const classIds = form.getAll("class").map(Number).filter(Boolean);
    const picked = form.getAll("student").map(Number).filter(Boolean);
    const fromClasses = classIds.length
      ? await db.select({ id: s.people.id }).from(s.classEnrollments).innerJoin(s.people, eq(s.people.id, s.classEnrollments.personId))
          .where(and(inArray(s.classEnrollments.classId, classIds), eq(s.people.status, "active")))
      : [];
    const ids = [...new Set([...picked, ...fromClasses.map((x) => x.id)])];
    if (!ids.length) throw new Error("Pilih minimal satu kelas atau satu siswa.");
    await db.batch([
      db.delete(s.pklAssignments).where(and(inArray(s.pklAssignments.studentId, ids), eq(s.pklAssignments.startDate, f.from))),
      db.insert(s.pklAssignments).values(ids.map((studentId) => ({ studentId, placeName: f.place, startDate: f.from, endDate: f.to, createdBy: user.id }))),
    ]);
    await audit(user.id, "pkl.add", "pkl_assignments", `${f.from}..${f.to}`, { place: f.place, students: ids.length });
    const ok = await refresh(f.from, f.to);
    revalidatePath("/pkl");
    return `PKL dicatat untuk ${ids.length} siswa. ${note(ok)}`;
  });
}

export async function updatePkl(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("pkl.manage");
    const raw = Object.fromEntries(form);
    const k = Key.parse(raw), f = Body.parse(raw);
    if (f.from > f.to) throw new Error("Tanggal selesai harus setelah tanggal mulai.");
    await db.update(s.pklAssignments).set({ placeName: f.place, startDate: f.from, endDate: f.to }).where(keyWhere(k));
    await audit(user.id, "pkl.update", "pkl_assignments", `${k.oFrom}..${k.oTo}`, f);
    const ok = await refresh(k.oFrom < f.from ? k.oFrom : f.from, k.oTo > f.to ? k.oTo : f.to);
    revalidatePath("/pkl");
    return `PKL diubah. ${note(ok)}`;
  });
}

export async function deletePkl(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("pkl.manage");
    const k = Key.parse(Object.fromEntries(form));
    await db.delete(s.pklAssignments).where(keyWhere(k));
    await audit(user.id, "pkl.delete", "pkl_assignments", `${k.oFrom}..${k.oTo}`, { place: k.oPlace });
    const ok = await refresh(k.oFrom, k.oTo);
    revalidatePath("/pkl");
    return `Data PKL dihapus. ${note(ok)}`;
  });
}
