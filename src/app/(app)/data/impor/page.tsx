import Link from "next/link";
import { Input } from "@/components/ui/input";
import { ActionForm, SubmitButton } from "@/components/shared/action-form";
import { GlassCard } from "@/components/shared/glass-card";
import { requirePermission } from "@/lib/auth/current-user";
import { importStudents } from "./actions";

const TEMPLATE = "Nama,NIS,Kelas,PIN,No HP wali\nBudi Santoso,12345,X AK,5101,081234567890\nSiti Aminah,12346,X BD,5102,081298765432\n";

export default async function ImportPage() {
  await requirePermission("student.manage");
  return (
    <div className="space-y-4">
      <Link href="/data" className="text-sm text-teal-800 underline">← Kembali ke daftar</Link>
      <h1 className="text-2xl font-semibold text-slate-900">Impor siswa dari Excel</h1>
      <GlassCard className="max-w-2xl space-y-4 p-4 text-sm">
        <ol className="list-decimal space-y-1 pl-5 text-slate-700">
          <li>Siapkan file <strong>.xlsx</strong> atau <strong>.csv</strong> dengan baris judul: <code>Nama</code>, <code>Kelas</code> (wajib), serta <code>NIS</code>, <code>PIN</code>, <code>No HP wali</code> (opsional).</li>
          <li>Kelas ditulis seperti di aplikasi, misalnya <code>X AK</code> atau <code>X-AK</code>, dan harus ada di tahun ajaran aktif.</li>
          <li>Siswa yang PIN atau NIS-nya sudah ada <strong>diperbarui</strong>, selain itu <strong>ditambahkan</strong>. Tidak ada yang dihapus.</li>
        </ol>
        <a className="inline-block text-teal-800 underline" download="templat-siswa.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}>Unduh templat contoh (.csv)</a>
        <ActionForm action={importStudents} reset className="space-y-3 border-t pt-4">
          <label className="block space-y-1">File<Input name="file" type="file" accept=".xlsx,.csv" required /></label>
          <SubmitButton pendingText="Mengimpor…">Impor</SubmitButton>
        </ActionForm>
      </GlassCard>
    </div>
  );
}
