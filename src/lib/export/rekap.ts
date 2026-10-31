import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { studentSummary, visibleClasses } from "@/lib/attendance/summary";

type User = { personId: number | null; permissions: string[] };
const HEAD = ["No", "Nama", "Kelas", "Hari efektif", "Hadir", "Terlambat", "Izin", "Sakit", "Dispensasi", "PKL", "Alpa", "Kehadiran"];

/** Satu sumber data untuk Excel dan PDF, memakai filter dan hak akses yang sama dengan halaman rekap. */
export async function loadRekap(user: User, from: string, to: string, kelasId?: number) {
  const classes = await visibleClasses(user);
  const selected = classes.find((c) => c.id === kelasId);
  if (kelasId && !selected) return null; // kelas di luar hak akses
  const rows = await studentSummary(from, to, selected ? [selected.id] : classes.map((c) => c.id));

  const [cfg, wali] = await Promise.all([
    db.select().from(s.settings).where(inArray(s.settings.key, ["school_name", "principal_name"])),
    selected
      ? db.select({ name: s.people.name }).from(s.classes).innerJoin(s.people, eq(s.people.id, s.classes.homeroomStaffId)).where(eq(s.classes.id, selected.id))
      : Promise.resolve([]),
  ]);
  const setting = (k: string) => String(cfg.find((c) => c.key === k)?.value ?? "");
  const table = rows.map((r, i) => [i + 1, r.name, r.className, r.effective, r.hadir + r.terlambat, r.terlambat, r.izin, r.sakit, r.dispensasi, r.pkl, r.alpa, r.pct] as (string | number | null)[]);
  const sum = (i: number) => table.reduce((a, r) => a + Number(r[i]), 0);
  const present = rows.reduce((a, r) => a + r.present, 0), effective = rows.reduce((a, r) => a + r.effective, 0);
  const total: (string | number | null)[] = ["", "Total", "", sum(3), sum(4), sum(5), sum(6), sum(7), sum(8), sum(9), sum(10), effective ? Math.round((present / effective) * 1000) / 10 : null];

  return {
    school: setting("school_name") || "SMKS Nusantara Banyuwangi", principal: setting("principal_name"), wali: wali[0]?.name ?? "",
    kelas: selected?.name ?? "Semua kelas", from, to, table, total,
  };
}
export type RekapData = NonNullable<Awaited<ReturnType<typeof loadRekap>>>;

const fmtLong = (d: Date) => d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" });
const period = (d: RekapData) => `${fmtLong(new Date(`${d.from}T00:00:00Z`))} s/d ${fmtLong(new Date(`${d.to}T00:00:00Z`))}`;

export async function buildXlsx(d: RekapData) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rekap", { views: [{ state: "frozen", ySplit: 6 }] });
  const last = HEAD.length;
  [[d.school, 14], ["REKAP KEHADIRAN SISWA", 12], [`Periode: ${period(d)}`, 11], [`Kelas: ${d.kelas}`, 11]].forEach(([text, size], i) => {
    ws.mergeCells(i + 1, 1, i + 1, last);
    const c = ws.getCell(i + 1, 1); c.value = text as string; c.font = { bold: i < 2, size: size as number }; c.alignment = { horizontal: "center" };
  });
  const head = ws.getRow(6); head.values = HEAD; head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }; c.alignment = { horizontal: "center", vertical: "middle" }; });
  const toRow = (r: (string | number | null)[]) => [...r.slice(0, 11), r[11] === null ? "-" : Number(r[11]) / 100];
  [...d.table, d.total].forEach((r, i) => {
    const row = ws.addRow(toRow(r));
    row.getCell(last).numFmt = "0.0%";
    row.eachCell((c, n) => { c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; if (n > 3) c.alignment = { horizontal: "center" }; });
    if (i === d.table.length) row.font = { bold: true };
  });
  [5, 30, 11, 12, 9, 11, 7, 7, 12, 7, 7, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const r = ws.rowCount + 3;
  ws.getCell(r, 2).value = `Banyuwangi, ${fmtLong(new Date())}`;
  ws.getCell(r + 1, 2).value = "Wali Kelas"; ws.getCell(r + 1, 9).value = "Kepala Sekolah";
  ws.getCell(r + 5, 2).value = d.wali || "(.....................)"; ws.getCell(r + 5, 9).value = d.principal || "(.....................)";
  return { body: new Uint8Array(await wb.xlsx.writeBuffer()), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" };
}

export async function buildPdf(d: RekapData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold").setFontSize(14).text(d.school, w / 2, 14, { align: "center" });
  doc.setFontSize(11).text("REKAP KEHADIRAN SISWA", w / 2, 20, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(10).text(`Periode: ${period(d)}   |   Kelas: ${d.kelas}`, w / 2, 26, { align: "center" });
  const cell = (r: (string | number | null)[]) => r.map((v, i) => (i === 11 ? (v === null ? "-" : `${v}%`) : v ?? ""));
  autoTable(doc, {
    startY: 31, head: [HEAD], body: d.table.map(cell), foot: [cell(d.total)],
    styles: { fontSize: 8, cellPadding: 1.5 }, headStyles: { fillColor: [15, 118, 110] }, footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: "bold" },
    columnStyles: Object.fromEntries(HEAD.map((_, i) => [i, { halign: i === 1 || i === 2 ? "left" : "center" }])),
    showFoot: "lastPage",
  });
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  if (y > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); y = 20; }
  doc.text(`Banyuwangi, ${fmtLong(new Date())}`, w - 25, y, { align: "right" });
  doc.text("Wali Kelas", 40, y + 6, { align: "center" }); doc.text("Kepala Sekolah", w - 50, y + 6, { align: "center" });
  doc.text(d.wali || "(.....................)", 40, y + 28, { align: "center" }); doc.text(d.principal || "(.....................)", w - 50, y + 28, { align: "center" });
  return { body: new Uint8Array(doc.output("arraybuffer")), type: "application/pdf", ext: "pdf" };
}
