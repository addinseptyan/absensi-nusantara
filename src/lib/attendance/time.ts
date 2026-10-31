// Helper waktu murni (tanpa dependensi). Semua perhitungan absensi memakai zona waktu sekolah (WIB).
export const TZ_OFFSET_MIN = 420; // WIB = UTC+7

/** "07:00" atau "07:00:00" -> menit sejak tengah malam */
export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Pecah waktu UTC menjadi tanggal lokal (YYYY-MM-DD) dan menit lokal (dibulatkan ke bawah). */
export function localParts(d: Date | string, offsetMin = TZ_OFFSET_MIN) {
  const x = new Date(new Date(d).getTime() + offsetMin * 60000);
  return {
    date: x.toISOString().slice(0, 10),
    minutes: x.getUTCHours() * 60 + x.getUTCMinutes(), // detik diabaikan: 07:00:59 dianggap 07:00
  };
}

/** Milidetik "jam dinding lokal" untuk tanggal + menit (untuk membandingkan dengan localParts). */
export const localMs = (date: string, minutes = 0) => new Date(`${date}T00:00:00Z`).getTime() + minutes * 60000;

/** 1=Senin ... 7=Minggu */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(date: string, n: number): string {
  return new Date(localMs(date) + n * 86400000).toISOString().slice(0, 10);
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
