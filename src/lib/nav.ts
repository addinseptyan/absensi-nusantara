import { can, type PermissionCode } from "@/lib/permissions";

export const NAV_GROUPS = ["", "Kehadiran", "Data sekolah", "Pengaturan", "Sistem"] as const;
export type NavItem = { href: string; label: string; group: (typeof NAV_GROUPS)[number]; perm: PermissionCode | PermissionCode[] };

// Urutan = prioritas halaman awal setelah login. Menu baru = tambah satu baris di sini (dan ikonnya di app-shell).
export const NAV_ITEMS: NavItem[] = [
  { href: "/beranda", label: "Beranda", group: "", perm: ["rekap.view_all", "rekap.view_own_class"] },
  { href: "/rekap", label: "Rekap siswa", group: "Kehadiran", perm: ["rekap.view_all", "rekap.view_own_class"] },
  { href: "/rekap-guru", label: "Rekap guru", group: "Kehadiran", perm: "rekap.view_all" },
  { href: "/koreksi", label: "Koreksi", group: "Kehadiran", perm: ["attendance.correct", "leave.create_own_class"] },
  { href: "/saya", label: "Kehadiran saya", group: "Kehadiran", perm: "rekap.view_self" },
  { href: "/data", label: "Data siswa & guru", group: "Data sekolah", perm: ["student.manage", "staff.manage"] },
  { href: "/kelas", label: "Kelas & wali kelas", group: "Data sekolah", perm: "class.manage" },
  { href: "/pkl", label: "PKL", group: "Data sekolah", perm: "pkl.manage" },
  { href: "/tahun-ajaran", label: "Tahun ajaran", group: "Data sekolah", perm: "academic_year.manage" },
  { href: "/kalender", label: "Kalender", group: "Data sekolah", perm: "calendar.manage" },
  { href: "/pengaturan", label: "Pengaturan sekolah", group: "Pengaturan", perm: "settings.rules" },
  { href: "/aturan", label: "Aturan jam", group: "Pengaturan", perm: "settings.rules" },
  { href: "/pengguna", label: "Pengguna", group: "Pengaturan", perm: "user.manage" },
  { href: "/hak-akses", label: "Hak akses", group: "Pengaturan", perm: "role.manage" },
  { href: "/kunci", label: "Kunci periode", group: "Pengaturan", perm: "period.lock" },
  { href: "/audit", label: "Riwayat perubahan", group: "Sistem", perm: "audit.view" },
  { href: "/kesehatan", label: "Kesehatan sistem", group: "Sistem", perm: "system.health" },
];

/** Nama menu data mengikuti apa yang benar-benar bisa dikelola pengguna. */
export function dataMenuLabel(permissions: readonly string[]) {
  const siswa = can(permissions, "student.manage"), guru = can(permissions, "staff.manage");
  return siswa && guru ? "Data siswa & guru" : siswa ? "Data siswa" : "Data guru & pegawai";
}
export const allowedNav = (permissions: readonly string[]): NavItem[] =>
  NAV_ITEMS.filter((n) => [n.perm].flat().some((p) => can(permissions, p))).map((n) => (n.href === "/data" ? { ...n, label: dataMenuLabel(permissions) } : n));
export const firstAllowedPath = (permissions: readonly string[]) => allowedNav(permissions)[0]?.href ?? null;
