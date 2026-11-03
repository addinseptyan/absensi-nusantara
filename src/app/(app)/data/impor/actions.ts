"use server";
import ExcelJS from "exceljs";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { guard } from "@/lib/action";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/current-user";
import { normalizePhone, titleCaseName } from "@/lib/person";

const HEADERS = {
  name: ["nama", "nama siswa", "name"], cls: ["kelas", "class", "rombel"], nis: ["nis"],
  pin: ["pin", "pin mesin", "id mesin", "id"], phone: ["hp", "no hp", "no. hp", "nomor hp", "hp wali", "no hp wali", "telepon"],
} as const;
const norm = (v: string) => v.toUpperCase().replace(/[\s_-]+/g, " ").trim();

async function readTable(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) {
    const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
    const sep = (lines[0] ?? "").includes(";") ? ";" : ",";
    return lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
  }
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Format file harus .xlsx atau .csv (simpan ulang file .xls sebagai .xlsx).");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer() as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File Excel kosong.");
  const out: string[][] = [];
  ws.eachRow((row) => out.push(Array.from({ length: ws.columnCount }, (_, i) => row.getCell(i + 1).text.trim())));
  return out;
}

export async function importStudents(form: FormData) {
  return guard(async () => {
    const user = await requirePermission("student.manage");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("Pilih file .xlsx atau .csv dulu.");
    if (file.size > 1_000_000) throw new Error("File terlalu besar (maksimal 1 MB).");
    const [head, ...body] = await readTable(file);
    if (!head) throw new Error("File kosong.");
    const col = (names: readonly string[]) => head.findIndex((h) => names.includes(h.toLowerCase().trim()));
    const c = { name: col(HEADERS.name), cls: col(HEADERS.cls), nis: col(HEADERS.nis), pin: col(HEADERS.pin), phone: col(HEADERS.phone) };
    if (c.name < 0 || c.cls < 0) throw new Error('Baris judul harus memuat kolom "Nama" dan "Kelas".');

    const [ay] = await db.select().from(s.academicYears).where(eq(s.academicYears.isActive, true));
    const classes = await db.select({ id: s.classes.id, name: s.classes.name }).from(s.classes).where(eq(s.classes.academicYearId, ay.id));
    const classBy = new Map(classes.map((k) => [norm(k.name), k.id]));
    const existing = await db.select({ id: s.people.id, pin: s.people.devicePin, nis: s.people.nis }).from(s.people).where(eq(s.people.type, "student"));
    const byPin = new Map(existing.filter((p) => p.pin).map((p) => [p.pin!, p.id])), byNis = new Map(existing.filter((p) => p.nis).map((p) => [p.nis!, p.id]));

    const errors: string[] = [], adds: { name: string; nis: string | null; pin: string | null; phone: string | null; classId: number }[] = [], edits: (typeof adds[0] & { id: number })[] = [];
    const seenPin = new Set<string>();
    body.forEach((r, i) => {
      const line = i + 2, cell = (k: number) => (k >= 0 ? (r[k] ?? "").trim() : "");
      if (!cell(c.name) && !cell(c.cls)) return; // baris kosong
      const classId = classBy.get(norm(cell(c.cls)));
      if (cell(c.name).length < 2) return void errors.push(`Baris ${line}: nama kosong.`);
      if (!classId) return void errors.push(`Baris ${line}: kelas "${cell(c.cls)}" tidak ada di tahun ajaran aktif.`);
      const pin = cell(c.pin) || null, nis = cell(c.nis) || null;
      if (pin && !/^[A-Za-z0-9]{1,20}$/.test(pin)) return void errors.push(`Baris ${line}: PIN hanya huruf dan angka.`);
      if (pin && seenPin.has(pin)) return void errors.push(`Baris ${line}: PIN ${pin} dobel di file.`);
      if (pin) seenPin.add(pin);
      const row = { name: titleCaseName(cell(c.name)), nis, pin, phone: normalizePhone(cell(c.phone)), classId };
      const match = (pin && byPin.get(pin)) || (nis && byNis.get(nis)) || null;
      if (match) edits.push({ ...row, id: match }); else adds.push(row);
    });

    if (adds.length) {
      const made = await db.insert(s.people).values(adds.map((a) => ({ type: "student" as const, name: a.name, nis: a.nis, devicePin: a.pin, parentPhone: a.phone, status: "active" as const })))
        .returning({ id: s.people.id });
      await db.insert(s.classEnrollments).values(made.map((m, i) => ({ personId: m.id, classId: adds[i].classId, status: "active" as const, startDate: ay.startDate })));
    }
    for (const e of edits) {
      await db.update(s.people).set({ name: e.name, nis: e.nis, devicePin: e.pin, parentPhone: e.phone }).where(eq(s.people.id, e.id));
      const mine = await db.select({ id: s.classEnrollments.id }).from(s.classEnrollments).innerJoin(s.classes, eq(s.classes.id, s.classEnrollments.classId))
        .where(and(eq(s.classEnrollments.personId, e.id), eq(s.classes.academicYearId, ay.id)));
      if (mine[0]) await db.update(s.classEnrollments).set({ classId: e.classId }).where(inArray(s.classEnrollments.id, [mine[0].id]));
      else await db.insert(s.classEnrollments).values({ personId: e.id, classId: e.classId, status: "active", startDate: ay.startDate });
    }
    await audit(user.id, "person.create", "people", "impor", { ditambah: adds.length, diperbarui: edits.length, dilewati: errors.length });
    revalidatePath("/data");
    const tail = errors.length ? ` ${errors.length} baris dilewati: ${errors.slice(0, 4).join(" ")}${errors.length > 4 ? " ..." : ""}` : "";
    return `Impor selesai: ${adds.length} siswa ditambahkan, ${edits.length} diperbarui.${tail}`;
  });
}
