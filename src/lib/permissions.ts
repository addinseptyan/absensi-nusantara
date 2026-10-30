// Sumber tunggal daftar izin. Dipakai oleh seed, middleware, API, dan UI.
// Menambah fitur baru = tambah satu baris di sini, lalu jalankan `npm run db:seed`.

export const PERMISSIONS = [
  // Rekap
  { code: "rekap.view_all", group: "Rekap", description: "Lihat rekap seluruh siswa/guru" },
  { code: "rekap.view_own_class", group: "Rekap", description: "Lihat rekap kelas yang diampu (wali kelas)" },
  { code: "rekap.view_self", group: "Rekap", description: "Lihat kehadiran diri sendiri" },
  { code: "rekap.export", group: "Rekap", description: "Export Excel/PDF" },
  // Kehadiran
  { code: "attendance.correct", group: "Kehadiran", description: "Koreksi kehadiran manual" },
  { code: "leave.create", group: "Kehadiran", description: "Input izin/sakit/dispensasi/izin keluar" },
  { code: "leave.create_own_class", group: "Kehadiran", description: "Input izin untuk kelas yang diampu" },
  { code: "leave.approve", group: "Kehadiran", description: "Setujui izin" },
  { code: "pkl.manage", group: "Kehadiran", description: "Kelola penempatan PKL" },
  { code: "period.lock", group: "Kehadiran", description: "Kunci/buka periode rekap" },
  // Data master
  { code: "student.manage", group: "Data Master", description: "Kelola data siswa" },
  { code: "staff.manage", group: "Data Master", description: "Kelola data guru/pegawai" },
  { code: "class.manage", group: "Data Master", description: "Kelola kelas & kenaikan kelas" },
  { code: "academic_year.manage", group: "Data Master", description: "Kelola tahun ajaran" },
  { code: "calendar.manage", group: "Data Master", description: "Kelola kalender hari efektif" },
  // Mesin
  { code: "device.sync_now", group: "Mesin", description: "Jalankan sync sekarang" },
  { code: "device.configure", group: "Mesin", description: "Atur koneksi mesin & jadwal sync" },
  { code: "device.map_ids", group: "Mesin", description: "Petakan ID mesin ke orang" },
  // Sistem
  { code: "settings.rules", group: "Sistem", description: "Atur aturan jam & status absensi" },
  { code: "user.manage", group: "Sistem", description: "Kelola akun pengguna" },
  { code: "role.manage", group: "Sistem", description: "Kelola role & hak akses" },
  { code: "system.health", group: "Sistem", description: "Lihat Kesehatan Sistem & log" },
  { code: "audit.view", group: "Sistem", description: "Lihat audit log" },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

// Izin yang TIDAK boleh dicabut dari role Admin (mencegah admin mengunci diri sendiri)
export const LOCKED_ADMIN_PERMISSIONS: PermissionCode[] = ["role.manage", "user.manage"];

// Role bawaan. Admin bisa mengubah semuanya kecuali yang terkunci di atas.
export const DEFAULT_ROLES: {
  slug: string;
  name: string;
  description: string;
  permissions: PermissionCode[] | "ALL";
}[] = [
  { slug: "admin", name: "Admin", description: "Akses penuh", permissions: "ALL" },
  {
    slug: "kesiswaan",
    name: "Kesiswaan",
    description: "Kelola kehadiran siswa",
    permissions: [
      "rekap.view_all", "rekap.export", "attendance.correct", "leave.create",
      "leave.approve", "pkl.manage", "student.manage", "calendar.manage", "device.map_ids",
    ],
  },
  {
    slug: "wali_kelas",
    name: "Wali Kelas",
    description: "Pantau kelas yang diampu",
    permissions: ["rekap.view_own_class", "rekap.export", "leave.create_own_class", "rekap.view_self"],
  },
  { slug: "guru_umum", name: "Guru Umum", description: "Lihat kehadiran sendiri", permissions: ["rekap.view_self"] },
];

// Fungsi pusat pengecekan izin: dipakai di middleware, API, dan UI.
export function can(userPermissions: readonly string[], code: PermissionCode): boolean {
  return userPermissions.includes(code);
}
