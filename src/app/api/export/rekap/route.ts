import { z } from "zod";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildPdf, buildXlsx, loadRekap } from "@/lib/export/rekap";
import { can } from "@/lib/permissions";

const Query = z.object({ format: z.enum(["xlsx", "pdf"]), from: z.string().date(), to: z.string().date(), kelas: z.coerce.number().int().optional() });

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });
  if (!can(user.permissions, "rekap.export")) return new Response("Anda tidak punya izin export.", { status: 403 });
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return new Response("Parameter tidak valid.", { status: 400 });

  const data = await loadRekap(user, q.data.from, q.data.to, q.data.kelas);
  if (!data) return new Response("Kelas tidak ditemukan atau di luar akses Anda.", { status: 404 });
  const file = q.data.format === "pdf" ? await buildPdf(data) : await buildXlsx(data);
  await audit(user.id, "rekap.export", "rekap", `${data.kelas}:${q.data.from}:${q.data.to}`, { format: q.data.format });

  const name = `Rekap-Kehadiran_${data.kelas.replace(/[^A-Za-z0-9]+/g, "-")}_${q.data.from}_${q.data.to}.${file.ext}`;
  return new Response(file.body, { headers: { "Content-Type": file.type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
}
