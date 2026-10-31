import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

export type ActionResult = { ok: boolean; message: string };

/** Bungkus isi server action: hasilnya selalu {ok, message} agar bisa ditampilkan sebagai notifikasi (toast). */
export async function guard(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() };
  } catch (e) {
    unstable_rethrow(e); // redirect() ke /login dan sejenisnya harus diteruskan
    console.error("[action]", e);
    return { ok: false, message: explain(e) };
  }
}

function explain(e: unknown): string {
  if (e instanceof ZodError) {
    const i = e.issues[0];
    if (i && !/^(Invalid|Required|Too |String|Expected|Number)/.test(i.message)) return i.message; // pesan buatan sendiri
    return `Isian belum lengkap atau tidak valid (kolom: ${i?.path.join(".") || "form"}).`;
  }
  const err = e as { code?: string; cause?: { code?: string } };
  const code = err?.cause?.code ?? err?.code;
  if (code === "23503") return "Data ini masih dipakai di bagian lain, jadi tidak bisa dihapus.";
  if (code === "23505") return "Data yang sama sudah ada.";
  if (e instanceof Error && !e.message.startsWith("Failed query")) return e.message;
  return "Terjadi kesalahan di server. Coba lagi, dan hubungi admin jika berulang.";
}
