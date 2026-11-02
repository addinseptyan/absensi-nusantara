import ExcelJS from "exceljs";
import { db, schema as s } from "@/db";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { localParts } from "@/lib/attendance/time";
import { can } from "@/lib/permissions";

type Rows = Record<string, unknown>[];
const val = (v: unknown) => (v instanceof Date ? v.toISOString() : v !== null && typeof v === "object" ? JSON.stringify(v) : v);

/** Salinan seluruh data penting dalam satu file Excel (satu lembar per tabel). Sandi, token agent, dan kunci mesin TIDAK disertakan. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });
  if (user.mustChangePassword) return new Response("Ganti kata sandi Anda dulu.", { status: 403 });
  if (!can(user.permissions, "system.health")) return new Response("Anda tidak punya izin.", { status: 403 });

  const sets: [string, PromiseLike<Rows>][] = [
    ["tahun_ajaran", db.select().from(s.academicYears)], ["jurusan", db.select().from(s.majors)], ["kelas", db.select().from(s.classes)],
    ["orang", db.select().from(s.people)], ["keanggotaan_kelas", db.select().from(s.classEnrollments)], ["hari_wajib_guru", db.select().from(s.staffWorkDays)],
    ["izin", db.select().from(s.leaves)], ["pkl", db.select().from(s.pklAssignments)], ["kalender", db.select().from(s.calendarDays)],
    ["aturan_jam", db.select().from(s.rulePeriods)], ["aturan_jam_hari", db.select().from(s.rulePeriodDays)],
    ["kehadiran_harian", db.select().from(s.attendanceDaily)], ["scan_mentah", db.select().from(s.rawLogs)], ["kunci_periode", db.select().from(s.periodLocks)],
    ["pengaturan", db.select().from(s.settings)], ["role", db.select().from(s.roles)], ["role_izin", db.select().from(s.rolePermissions)], ["pengguna_role", db.select().from(s.userRoles)],
    ["pengguna", db.select({ id: s.users.id, name: s.users.name, username: s.users.username, email: s.users.email, isActive: s.users.isActive, personId: s.users.personId, lastLoginAt: s.users.lastLoginAt, createdAt: s.users.createdAt }).from(s.users)],
    ["riwayat_perubahan", db.select().from(s.auditLogs)],
  ];
  const results = await Promise.all(sets.map(([, q]) => q));

  const wb = new ExcelJS.Workbook();
  const today = localParts(new Date()).date;
  const readme = wb.addWorksheet("BACA_SAYA");
  readme.addRows([
    ["Cadangan data Absensi SMKS Nusantara"], [`Dibuat: ${today}, oleh ${user.name}`], [],
    ["Isi: satu lembar per tabel. Tidak disertakan: kata sandi, token agent, dan kunci mesin absen."],
    ["Fungsi: arsip yang bisa dibaca manusia. Pemulihan otomatis seluruh sistem tersedia di Neon (fitur restore); cek lama penyimpanannya di dashboard Neon."],
    ["Simpan file ini di tempat yang aman karena memuat data pribadi siswa dan guru."], [], ["Lembar", "Jumlah baris"],
  ]);
  readme.getRow(1).font = { bold: true, size: 14 };
  sets.forEach(([name], i) => readme.addRow([name, results[i].length]));
  readme.getColumn(1).width = 28;

  sets.forEach(([name], i) => {
    const rows = results[i];
    const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    if (!rows.length) { ws.addRow(["(kosong)"]); return; }
    const keys = Object.keys(rows[0]);
    ws.addRow(keys).font = { bold: true };
    rows.forEach((r) => ws.addRow(keys.map((k) => val(r[k]))));
    keys.forEach((_, c) => (ws.getColumn(c + 1).width = 18));
  });

  await audit(user.id, "backup.download", "backup", today);
  const body = new Uint8Array(await wb.xlsx.writeBuffer());
  return new Response(body, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="Cadangan-Absensi_${today}.xlsx"`, "Cache-Control": "private, no-store",
  } });
}
