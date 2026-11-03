import { z } from "zod";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildPdf, buildXlsx, loadDetail, loadRekap, loadStaffRekap } from "@/lib/export/rekap";
import { can } from "@/lib/permissions";
import { SIGN_MODES } from "@/lib/export/sign";

const Query = z.object({
  format: z.enum(["xlsx", "pdf"]), from: z.string().date(), to: z.string().date(),
  jenis: z.enum(["siswa", "guru", "detail"]).default("siswa"),
  kelas: z.coerce.number().int().optional(), tahun: z.coerce.number().int().optional(), personId: z.coerce.number().int().optional(),
  tempat: z.string().max(60).optional(), tanggal: z.string().optional(), ttd: z.enum(SIGN_MODES).default("auto"),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });
  if (user.mustChangePassword) return new Response("Ganti kata sandi Anda dulu.", { status: 403 });
  if (!can(user.permissions, "rekap.export")) return new Response("Anda tidak punya izin export.", { status: 403 });
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return new Response("Parameter tidak valid.", { status: 400 });

  const { jenis, from, to } = q.data;
  const data = jenis === "guru" ? await loadStaffRekap(user, from, to)
    : jenis === "detail" ? (q.data.personId ? await loadDetail(user, q.data.personId, from, to, q.data.tahun) : null)
    : await loadRekap(user, from, to, q.data.kelas, q.data.tahun);
  if (!data) return new Response("Data tidak ditemukan atau di luar akses Anda.", { status: 404 });

  if (q.data.tempat?.trim()) data.place = q.data.tempat.trim();
  if (q.data.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(q.data.tanggal)) data.date = new Date(`${q.data.tanggal}T12:00:00+07:00`);
  data.mode = q.data.ttd;

  const file = q.data.format === "pdf" ? await buildPdf(data) : await buildXlsx(data);
  await audit(user.id, "rekap.export", "rekap", data.filename, { jenis, format: q.data.format });
  return new Response(file.body, { headers: { "Content-Type": file.type, "Content-Disposition": `attachment; filename="${data.filename}.${file.ext}"`, "Cache-Control": "private, no-store" } });
}
