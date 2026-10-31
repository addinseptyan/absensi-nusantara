export const fmtWib = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "-";

export function ago(d: Date | string | null): string {
  if (!d) return "belum pernah";
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? "baru saja" : m < 60 ? `${m} menit lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`;
}
