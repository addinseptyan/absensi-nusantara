import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getPersonDetail, rowNotes } from "@/lib/attendance/detail";
import { staffSummary, studentSummary, visibleClasses } from "@/lib/attendance/summary";
import { STATUS_LABEL, fmtDay, fmtTime } from "@/lib/format";
import { fullName } from "@/lib/person";
import { can } from "@/lib/permissions";

type User = { personId: number | null; permissions: string[] };
type Cell = string | number | null;

/** Satu bentuk data untuk semua jenis laporan; pembuat Excel dan PDF hanya membaca bentuk ini. */
export type RekapData = {
  school: string; principal: string; wali: string; leftSign: string | null;
  title: string; subtitle: string; summary?: string;
  head: string[]; widths: number[]; leftCols: number[]; pctCol: number | null;
  table: Cell[][]; total: Cell[] | null; filename: string;
};

const fmtLong = (d: Date) => d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" });
const period = (from: string, to: string) => `${fmtLong(new Date(`${from}T00:00:00Z`))} s/d ${fmtLong(new Date(`${to}T00:00:00Z`))}`;
const safe = (v: string) => v.replace(/[^A-Za-z0-9]+/g, "-");

async function school() {
  const cfg = await db.select().from(s.settings).where(inArray(s.settings.key, ["school_name", "principal_name"]));
  const get = (k: string) => String(cfg.find((c) => c.key === k)?.value ?? "");
  return { school: get("school_name") || "SMKS Nusantara Banyuwangi", principal: get("principal_name") };
}
async function homeroom(classId: number) {
  const [w] = await db.select({ name: s.people.name, titlePrefix: s.people.titlePrefix, titleSuffix: s.people.titleSuffix }).from(s.classes)
    .innerJoin(s.people, eq(s.people.id, s.classes.homeroomStaffId)).where(eq(s.classes.id, classId));
  return w ? fullName(w) : "";
}
const sum = (rows: Cell[][], i: number) => rows.reduce((a, r) => a + Number(r[i]), 0);
const pctOf = (present: number, effective: number) => (effective ? Math.round((present / effective) * 1000) / 10 : null);

/** Rekap siswa per kelas atau semua kelas. */
export async function loadRekap(user: User, from: string, to: string, kelasId?: number): Promise<RekapData | null> {
  const classes = await visibleClasses(user);
  const selected = classes.find((c) => c.id === kelasId);
  if (kelasId && !selected) return null;
  const rows = await studentSummary(from, to, selected ? [selected.id] : classes.map((c) => c.id));
  const table: Cell[][] = rows.map((r, i) => [i + 1, r.name, r.className, r.effective, r.hadir + r.terlambat, r.terlambat, r.izin, r.sakit, r.dispensasi, r.pkl, r.alpa, r.pct]);
  const present = rows.reduce((a, r) => a + r.present, 0), effective = rows.reduce((a, r) => a + r.effective, 0);
  const kelas = selected?.name ?? "Semua kelas";
  return {
    ...(await school()), wali: selected ? await homeroom(selected.id) : "", leftSign: "Wali Kelas",
    title: "REKAP KEHADIRAN SISWA", subtitle: `Periode: ${period(from, to)}   |   Kelas: ${kelas}`,
    head: ["No", "Nama", "Kelas", "Hari efektif", "Hadir", "Terlambat", "Izin", "Sakit", "Dispensasi", "PKL", "Alpa", "Kehadiran"],
    widths: [5, 30, 11, 12, 9, 11, 7, 7, 12, 7, 7, 12], leftCols: [1, 2], pctCol: 11,
    table, total: ["", "Total", "", sum(table, 3), sum(table, 4), sum(table, 5), sum(table, 6), sum(table, 7), sum(table, 8), sum(table, 9), sum(table, 10), pctOf(present, effective)],
    filename: `Rekap-Kehadiran_${safe(kelas)}_${from}_${to}`,
  };
}

/** Rekap guru dan pegawai. */
export async function loadStaffRekap(user: User, from: string, to: string): Promise<RekapData | null> {
  if (!can(user.permissions, "rekap.view_all")) return null;
  const rows = await staffSummary(from, to);
  const table: Cell[][] = rows.map((r, i) => [i + 1, fullName(r), r.effective, r.hadir + r.terlambat, r.terlambat, r.izin, r.sakit, r.dispensasi, r.alpa, r.extra, r.pct]);
  const present = rows.reduce((a, r) => a + r.present, 0), effective = rows.reduce((a, r) => a + r.effective, 0);
  return {
    ...(await school()), wali: "", leftSign: null,
    title: "REKAP KEHADIRAN GURU DAN PEGAWAI", subtitle: `Periode: ${period(from, to)}`,
    head: ["No", "Nama", "Hari wajib", "Hadir", "Terlambat", "Izin", "Sakit", "Dispensasi", "Alpa", "Scan tambahan", "Kehadiran"],
    widths: [5, 36, 11, 9, 11, 7, 7, 12, 7, 15, 12], leftCols: [1], pctCol: 10,
    table, total: ["", "Total", sum(table, 2), sum(table, 3), sum(table, 4), sum(table, 5), sum(table, 6), sum(table, 7), sum(table, 8), sum(table, 9), pctOf(present, effective)],
    filename: `Rekap-Kehadiran-Guru_${from}_${to}`,
  };
}

/** Rincian harian satu siswa atau guru (hari libur tanpa scan tidak dicetak). */
export async function loadDetail(user: User, personId: number, from: string, to: string): Promise<RekapData | null> {
  const d = await getPersonDetail(user, personId, from, to);
  if (!d) return null;
  const shown = d.rows.filter((r) => r.status !== "libur" || r.checkIn);
  const n = (st: string) => d.rows.filter((r) => r.status === st).length;
  const present = n("hadir") + n("terlambat") + n("dispensasi"), effective = present + n("izin") + n("sakit") + n("alpa");
  const p = pctOf(present, effective);
  return {
    ...(await school()), wali: d.person.classId ? await homeroom(d.person.classId) : "", leftSign: d.person.classId ? "Wali Kelas" : null,
    title: "RINCIAN KEHADIRAN", subtitle: `${fullName(d.person)}   |   ${d.person.className ? `Kelas ${d.person.className}` : "Guru dan pegawai"}   |   ${period(from, to)}`,
    summary: `Hari efektif ${effective}: hadir ${n("hadir") + n("terlambat")} (terlambat ${n("terlambat")}), izin ${n("izin")}, sakit ${n("sakit")}, dispensasi ${n("dispensasi")}, alpa ${n("alpa")}. Kehadiran ${p === null ? "-" : `${p}%`}.`,
    head: ["No", "Tanggal", "Status", "Masuk", "Pulang", "Keterangan"], widths: [5, 26, 14, 9, 9, 48], leftCols: [1, 5], pctCol: null,
    table: shown.map((r, i) => [i + 1, `${fmtDay(r.date)} ${r.date.slice(0, 4)}`, STATUS_LABEL[r.status], fmtTime(r.checkIn), fmtTime(r.checkOut), rowNotes(r).join("; ")]), total: null,
    filename: `Rincian-Kehadiran_${safe(d.person.name)}_${from}_${to}`,
  };
}

export async function buildXlsx(d: RekapData) {
  const lines: [string, number][] = [[d.school, 14], [d.title, 12], [d.subtitle, 11], ...(d.summary ? [[d.summary, 10] as [string, number]] : [])];
  const hr = lines.length + 2, last = d.head.length;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rekap", { views: [{ state: "frozen", ySplit: hr }] });
  lines.forEach(([text, size], i) => {
    ws.mergeCells(i + 1, 1, i + 1, last);
    const c = ws.getCell(i + 1, 1); c.value = text; c.font = { bold: i < 2, size }; c.alignment = { horizontal: "center", wrapText: true };
  });
  const head = ws.getRow(hr); head.values = d.head; head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }; c.alignment = { horizontal: "center", vertical: "middle" }; });
  const all = d.total ? [...d.table, d.total] : d.table;
  all.forEach((r, i) => {
    const row = ws.addRow(r.map((v, c) => (c === d.pctCol ? (v === null ? "-" : Number(v) / 100) : v)));
    if (d.pctCol !== null) row.getCell(d.pctCol + 1).numFmt = "0.0%";
    row.eachCell({ includeEmpty: true }, (c, n) => {
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      c.alignment = { horizontal: d.leftCols.includes(n - 1) ? "left" : "center", vertical: "top", wrapText: true };
    });
    if (d.total && i === all.length - 1) row.font = { bold: true };
  });
  d.widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const r = ws.rowCount + 3, rightCol = Math.max(3, last - 2);
  ws.getCell(r, rightCol).value = `Banyuwangi, ${fmtLong(new Date())}`; // di atas Kepala Sekolah
  if (d.leftSign) { ws.getCell(r + 1, 2).value = d.leftSign; ws.getCell(r + 5, 2).value = d.wali || "(.....................)"; }
  ws.getCell(r + 1, rightCol).value = "Kepala Sekolah"; ws.getCell(r + 5, rightCol).value = d.principal || "(.....................)";
  return { body: new Uint8Array(await wb.xlsx.writeBuffer()), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" };
}

export async function buildPdf(d: RekapData) {
  const doc = new jsPDF({ orientation: d.head.length > 8 ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold").setFontSize(14).text(d.school, w / 2, 14, { align: "center" });
  doc.setFontSize(11).text(d.title, w / 2, 20, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(10).text(d.subtitle, w / 2, 26, { align: "center", maxWidth: w - 20 });
  let y0 = 31;
  if (d.summary) { doc.setFontSize(9).text(d.summary, w / 2, 31, { align: "center", maxWidth: w - 20 }); y0 = 38; }
  const cell = (r: Cell[]) => r.map((v, i) => (i === d.pctCol ? (v === null ? "-" : `${v}%`) : v ?? ""));
  autoTable(doc, {
    startY: y0, head: [d.head], body: d.table.map(cell), foot: d.total ? [cell(d.total)] : undefined, showFoot: "lastPage",
    styles: { fontSize: 8, cellPadding: 1.5 }, headStyles: { fillColor: [15, 118, 110] }, footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: "bold" },
    // Rata untuk semua bagian (judul, isi, total) agar baris total sejajar dengan kolomnya
    didParseCell: (c) => { c.cell.styles.halign = d.leftCols.includes(c.column.index) ? "left" : "center"; },
  });
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  if (y > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); y = 20; }
  doc.setFontSize(10).text(`Banyuwangi, ${fmtLong(new Date())}`, w - 50, y, { align: "center" });
  if (d.leftSign) { doc.text(d.leftSign, 40, y + 6, { align: "center" }); doc.text(d.wali || "(.....................)", 40, y + 28, { align: "center" }); }
  doc.text("Kepala Sekolah", w - 50, y + 6, { align: "center" }); doc.text(d.principal || "(.....................)", w - 50, y + 28, { align: "center" });
  return { body: new Uint8Array(doc.output("arraybuffer")), type: "application/pdf", ext: "pdf" };
}
