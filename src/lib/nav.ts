import { can, type PermissionCode } from "@/lib/permissions";

// Urutan = prioritas halaman awal setelah login. Menu baru = tambah satu baris di sini (dan ikonnya di app-shell).
export const NAV_ITEMS: { href: string; label: string; perm: PermissionCode | PermissionCode[] }[] = [
  { href: "/rekap", label: "Rekap kehadiran", perm: ["rekap.view_all", "rekap.view_own_class"] },
  { href: "/koreksi", label: "Koreksi kehadiran", perm: ["attendance.correct", "leave.create_own_class"] },
  { href: "/data", label: "Data siswa & guru", perm: ["student.manage", "staff.manage"] },
  { href: "/kalender", label: "Kalender", perm: "calendar.manage" },
  { href: "/aturan", label: "Aturan jam", perm: "settings.rules" },
  { href: "/pengguna", label: "Pengguna", perm: "user.manage" },
  { href: "/hak-akses", label: "Hak akses", perm: "role.manage" },
  { href: "/kesehatan", label: "Kesehatan sistem", perm: "system.health" },
];
export const allowedNav = (permissions: readonly string[]) => NAV_ITEMS.filter((n) => [n.perm].flat().some((p) => can(permissions, p)));
export const firstAllowedPath = (permissions: readonly string[]) => allowedNav(permissions)[0]?.href ?? null;
