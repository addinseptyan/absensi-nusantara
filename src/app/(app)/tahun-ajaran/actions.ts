"use server";
import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { guard } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";

const Body = z.object({ name: z.string().trim().regex(/^\d{4}\/\d{4}$/, "Nama tahun ajaran berformat 2027/2028."), from: z.string().date(), to: z.string().date() });
const STATUS = { naik: "promoted", tinggal: "retained", lulus: "graduated", keluar: "moved" } as const;
type Decision = keyof typeof STATUS;
type Grade = "X" | "XI" | "XII";
const NEXT: Record<string, Grade> = { X: "XI", XI: "XII" };

/** Tutup tahun ajaran berjalan: buat tahun dan kelas baru, pindahkan siswa, aktifkan tahun baru. Data kehadiran lama tidak disentuh. */
export async function processYearEnd(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("academic_year.manage");
    const f = Body.parse(Object.fromEntries(form));
    const [cur] = await db.select().from(s.academicYears).where(eq(s.academicYears.isActive, true));
    if (!cur) throw new Error("Belum ada tahun ajaran aktif.");
    if (f.from <= cur.startDate || f.to < f.from) throw new Error("Tanggal tahun ajaran baru tidak valid: harus setelah tahun yang berjalan.");
    const [dup] = await db.select({ id: s.academicYears.id }).from(s.academicYears).where(eq(s.academicYears.name, f.name));
    if (dup) throw new Error(`Tahun ajaran ${f.name} sudah ada.`);

    const students = await db.select({ enrollmentId: s.classEnrollments.id, personId: s.people.id, grade: s.classes.grade, majorId: s.classes.majorId })
      .from(s.classEnrollments).innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId)).innerJoin(s.people, eq(s.people.id, s.classEnrollments.personId))
      .where(and(eq(s.classes.academicYearId, cur.id), eq(s.people.status, "active"), eq(s.people.type, "student")));
    if (!students.length) throw new Error("Tidak ada siswa aktif untuk diproses.");
    const majors = await db.select().from(s.majors);
    const code = new Map(majors.map((m) => [m.id, m.code]));

    const plans = students.map((st) => {
      const d = String(form.get(`d:${st.personId}`) ?? (st.grade === "XII" ? "lulus" : "naik")) as Decision;
      if (!(d in STATUS)) throw new Error("Ada pilihan siswa yang tidak valid.");
      if (d === "naik" && st.grade === "XII") throw new Error("Siswa kelas XII tidak bisa naik kelas. Pilih Lulus atau Tinggal kelas.");
      if (d === "lulus" && st.grade !== "XII") throw new Error("Hanya siswa kelas XII yang bisa lulus.");
      const target = d === "naik" ? { grade: NEXT[st.grade], majorId: st.majorId } : d === "tinggal" ? { grade: st.grade as Grade, majorId: st.majorId } : null;
      return { ...st, d, target };
    });

    const [year] = await db.insert(s.academicYears).values({ name: f.name, startDate: f.from, endDate: f.to, isActive: false }).returning();
    try {
      const need = new Map<string, { grade: Grade; majorId: number }>();
      plans.forEach((p) => p.target && need.set(`${p.target.grade}|${p.target.majorId}`, p.target));
      majors.forEach((m) => need.set(`X|${m.id}`, { grade: "X", majorId: m.id })); // kelas X baru untuk penerimaan siswa baru
      const created = await db.insert(s.classes).values([...need.values()].map((n) => ({ academicYearId: year.id, grade: n.grade, majorId: n.majorId, name: `${n.grade} ${code.get(n.majorId)}` })))
        .returning({ id: s.classes.id, grade: s.classes.grade, majorId: s.classes.majorId });
      const classOf = (g: Grade, m: number) => created.find((c) => c.grade === g && c.majorId === m)!.id;

      const enroll = plans.filter((p) => p.target).map((p) => ({ personId: p.personId, classId: classOf(p.target!.grade, p.target!.majorId), status: "active" as const, startDate: f.from }));
      const ids = (d: Decision) => plans.filter((p) => p.d === d).map((p) => p.enrollmentId);
      const pids = (d: Decision) => plans.filter((p) => p.d === d).map((p) => p.personId);
      const ops = [
        ...(enroll.length ? [db.insert(s.classEnrollments).values(enroll)] : []),
        ...(Object.keys(STATUS) as Decision[]).flatMap((d) => (ids(d).length ? [db.update(s.classEnrollments).set({ status: STATUS[d], endDate: cur.endDate }).where(inArray(s.classEnrollments.id, ids(d)))] : [])),
        ...(pids("lulus").length ? [db.update(s.people).set({ status: "graduated" }).where(inArray(s.people.id, pids("lulus")))] : []),
        ...(pids("keluar").length ? [db.update(s.people).set({ status: "moved" }).where(inArray(s.people.id, pids("keluar")))] : []),
        db.update(s.academicYears).set({ isActive: false }).where(eq(s.academicYears.id, cur.id)),
        db.update(s.academicYears).set({ isActive: true }).where(eq(s.academicYears.id, year.id)),
      ];
      await db.batch(ops as unknown as Parameters<typeof db.batch>[0]); // satu transaksi: semua berhasil atau tidak sama sekali
    } catch (e) {
      const cls = await db.select({ id: s.classes.id }).from(s.classes).where(eq(s.classes.academicYearId, year.id));
      if (cls.length) { await db.delete(s.classEnrollments).where(inArray(s.classEnrollments.classId, cls.map((c) => c.id))); await db.delete(s.classes).where(eq(s.classes.academicYearId, year.id)); }
      await db.delete(s.academicYears).where(eq(s.academicYears.id, year.id));
      throw e;
    }
    const n = (d: Decision) => plans.filter((p) => p.d === d).length;
    await audit(user.id, "year.rollover", "academic_years", f.name, { naik: n("naik"), tinggal: n("tinggal"), lulus: n("lulus"), keluar: n("keluar") });
    revalidatePath("/", "layout");
    return `Tahun ajaran ${f.name} aktif: ${n("naik")} naik, ${n("tinggal")} tinggal, ${n("lulus")} lulus, ${n("keluar")} keluar. Atur wali kelas baru di menu Kelas.`;
  });
}

/** Perbaiki nama atau tanggal sebuah tahun ajaran (termasuk yang aktif). */
export async function updateYear(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("academic_year.manage");
    const f = Body.extend({ id: z.coerce.number().int() }).parse(Object.fromEntries(form));
    if (f.from > f.to) throw new Error("Tanggal selesai harus setelah tanggal mulai.");
    const others = await db.select().from(s.academicYears).where(ne(s.academicYears.id, f.id));
    if (others.some((o) => o.name === f.name)) throw new Error(`Nama ${f.name} sudah dipakai tahun ajaran lain.`);
    if (others.some((o) => !(f.to < o.startDate || f.from > o.endDate))) throw new Error("Rentang tanggal bertabrakan dengan tahun ajaran lain.");
    await db.update(s.academicYears).set({ name: f.name, startDate: f.from, endDate: f.to }).where(eq(s.academicYears.id, f.id));
    await audit(user.id, "year.update", "academic_years", String(f.id), f);
    revalidatePath("/", "layout");
    return "Tahun ajaran diperbarui. Jika tanggal mulai berubah, tekan Hitung ulang di halaman Rekap agar rekap ikut menyesuaikan.";
  });
}
