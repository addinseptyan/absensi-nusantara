import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { SubmitButton, ActionForm } from "@/components/shared/action-form";
import { GlassCard, Pill } from "@/components/shared/glass-card";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";
import { fullName } from "@/lib/person";
import { setHomeroom } from "./actions";
import { SelectField } from "@/components/shared/select-field";

export default async function ClassesPage() {
  await requirePermission("class.manage");
  const [classes, staff] = await Promise.all([
    db.select({
      id: s.classes.id, name: s.classes.name, homeroom: s.classes.homeroomStaffId,
      students: sql<number>`count(distinct ${s.classEnrollments.personId}) filter (where ${s.people.status} = 'active')`.mapWith(Number),
    }).from(s.classes)
      .innerJoin(s.academicYears, and(eq(s.academicYears.id, s.classes.academicYearId), eq(s.academicYears.isActive, true)))
      .leftJoin(s.classEnrollments, eq(s.classEnrollments.classId, s.classes.id)).leftJoin(s.people, eq(s.people.id, s.classEnrollments.personId))
      .groupBy(s.classes.id).orderBy(asc(s.classes.name)),
    db.select({ id: s.people.id, name: s.people.name, titlePrefix: s.people.titlePrefix, titleSuffix: s.people.titleSuffix, userId: s.users.id }).from(s.people)
      .leftJoin(s.users, eq(s.users.personId, s.people.id)).where(and(eq(s.people.type, "staff"), eq(s.people.status, "active"))).orderBy(asc(s.people.name)),
  ]);
  const byId = new Map(staff.map((t) => [t.id, t]));

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">Kelas dan wali kelas</h1>
        <p className="text-sm text-slate-600">Wali kelas hanya melihat kelasnya jika akunnya dihubungkan ke data gurunya (menu <Link className="underline" href="/pengguna">Pengguna</Link> → Ubah → Data guru) dan memiliki role Wali Kelas.</p></div>
      <section className="rounded-2xl border bg-white">
        <ul className="divide-y">{classes.map((c) => {
          const t = c.homeroom ? byId.get(c.homeroom) : undefined;
          return (
            <li key={c.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
              <div className="md:w-48"><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-slate-500">{c.students} siswa aktif</p></div>
              <div className="md:w-44">{!t ? <Pill tone="idle">Belum ada wali kelas</Pill> : t.userId ? <Pill tone="ok">Akun siap</Pill> : <Pill tone="warn">Wali kelas belum punya akun</Pill>}</div>
              <ActionForm action={setHomeroom} className="flex flex-1 flex-wrap gap-2">
                <input type="hidden" name="classId" value={c.id} />
                <SelectField name="staffId" defaultValue={c.homeroom ?? ""} className="block h-9 min-w-56 flex-1 border bg-white px-2 text-sm">
                  <option value="">Belum ada wali kelas</option>{staff.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
                </SelectField>
                <SubmitButton size="sm" variant="outline">Simpan</SubmitButton>
              </ActionForm>
            </li>);
        })}</ul>
      </section>
    </div>
  );
}
