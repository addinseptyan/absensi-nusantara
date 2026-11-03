/** Nama lengkap dengan gelar: "Drs. Budi Santoso, M.Pd." Nama di database tetap bersih tanpa gelar. */
export const fullName = (p: { name: string; titlePrefix?: string | null; titleSuffix?: string | null }) =>
  `${[p.titlePrefix, p.name].filter(Boolean).join(" ")}${p.titleSuffix ? `, ${p.titleSuffix}` : ""}`;

/** Nomor HP ke format 62xxxxxxxx (siap dipakai WhatsApp). Kosong tetap null. */
export function normalizePhone(v?: string | null): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  if (!d) return null;
  return d.startsWith("0") ? `62${d.slice(1)}` : d.startsWith("62") ? d : `62${d}`;
}

/** Rapikan huruf nama: "BUDI SANTOSO" -> "Budi Santoso"; inisial seperti "M." tetap kapital. */
export const titleCaseName = (n: string) =>
  n.trim().split(/\s+/).map((w) => (/^[A-Za-z]\.$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(" ");
