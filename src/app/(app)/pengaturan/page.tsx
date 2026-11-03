import { inArray } from "drizzle-orm";
import { Input } from "@/components/ui/input";
import { ActionForm, SubmitButton } from "@/components/shared/action-form";
import { GlassCard } from "@/components/shared/glass-card";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";
import { saveSchoolSettings } from "./actions";

const KEYS = ["school_name", "print_place", "principal_title", "principal_name", "principal_nip"];

export default async function SchoolSettingsPage() {
  await requirePermission("settings.rules");
  const rows = await db.select().from(s.settings).where(inArray(s.settings.key, KEYS));
  const v = (k: string, d = "") => String(rows.find((r) => r.key === k)?.value ?? d);
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold text-slate-900">Pengaturan sekolah</h1>
        <p className="text-sm text-slate-600">Data yang tercetak di kop dan tanda tangan laporan Excel dan PDF.</p></div>
      <GlassCard className="max-w-2xl p-4">
        <ActionForm action={saveSchoolSettings} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2">Nama sekolah (kop laporan)<Input name="school_name" defaultValue={v("school_name", "SMKS Nusantara Banyuwangi")} required maxLength={120} /></label>
          <label className="space-y-1 text-sm">Tempat penandatanganan<Input name="print_place" defaultValue={v("print_place", "Banyuwangi")} maxLength={60} /></label>
          <label className="space-y-1 text-sm">Jabatan pejabat utama<Input name="principal_title" defaultValue={v("principal_title", "Kepala Sekolah")} maxLength={60} /></label>
          <label className="space-y-1 text-sm sm:col-span-2">Nama kepala sekolah, lengkap dengan gelar<Input name="principal_name" defaultValue={v("principal_name")} placeholder="mis. Yusuf Nugroho, S.Pd., M.M." maxLength={120} /></label>
          <label className="space-y-1 text-sm sm:col-span-2">NIP kepala sekolah (opsional)<Input name="principal_nip" defaultValue={v("principal_nip")} maxLength={30} inputMode="numeric" /></label>
          <p className="text-xs text-slate-500 sm:col-span-2">Nama yang dikosongkan dicetak sebagai titik-titik. Tempat dan tanggal bisa diubah lagi setiap kali mengunduh.</p>
          <div className="sm:col-span-2"><SubmitButton>Simpan pengaturan</SubmitButton></div>
        </ActionForm>
      </GlassCard>
    </div>
  );
}
