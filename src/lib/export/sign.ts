import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

export const SIGN_MODES = ["auto", "wali_kepsek", "kepsek", "wali", "manual", "none"] as const;
export type SignMode = (typeof SIGN_MODES)[number];

/** Pilihan tanda tangan di dialog unduh. Opsi wali kelas hanya muncul jika laporan untuk satu kelas. */
export const signOptions = (hasWali: boolean) => [
  ...(hasWali ? [{ value: "wali_kepsek", label: "Wali kelas dan Kepala sekolah" }, { value: "wali", label: "Wali kelas saja" }] : []),
  { value: "kepsek", label: "Kepala sekolah saja" },
  { value: "manual", label: "Kosong (jabatan dan nama ditulis tangan)" },
  { value: "none", label: "Tanpa tanda tangan" },
];

export async function getPrintPlace() {
  const [r] = await db.select().from(s.settings).where(eq(s.settings.key, "print_place"));
  return String(r?.value ?? "") || "Banyuwangi";
}
