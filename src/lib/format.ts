export const fmtWib = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "-";

export function ago(d: Date | string | null): string {
  if (!d) return "belum pernah";
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? "baru saja" : m < 60 ? `${m} menit lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`;
}

export const fmtTime = (d: Date | string | null) =>
  d ? new Date(d).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).replace(".", ":") : "-";

export const STATUS_LABEL = { hadir: "Hadir", terlambat: "Terlambat", izin: "Izin", sakit: "Sakit", dispensasi: "Dispensasi", pkl: "PKL", alpa: "Alpa", libur: "Libur", belum_ada_data: "Belum ada data" } as const;
export const STATUS_TONE = { hadir: "ok", terlambat: "warn", izin: "idle", sakit: "idle", dispensasi: "ok", pkl: "idle", alpa: "bad", libur: "idle", belum_ada_data: "warn" } as const;

const UTC = { timeZone: "UTC" } as const;
export const fmtDay = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("id-ID", { ...UTC, weekday: "long", day: "numeric", month: "short" });
export const fmtShort = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("id-ID", { ...UTC, day: "numeric", month: "short" });
