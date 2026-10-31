/**
 * Mesin aturan absensi: FUNGSI MURNI (tanpa database), mudah diuji.
 * Input: scan hari itu + aturan + keterangan  ->  Output: status harian.
 */
import { TZ_OFFSET_MIN, isoWeekday, localMs, localParts, toMinutes } from "./time";

export type PersonType = "student" | "staff";
export type Status = "hadir" | "terlambat" | "izin" | "sakit" | "dispensasi" | "pkl" | "alpa" | "libur" | "belum_ada_data";

export type RulePeriod = {
  id: number;
  appliesTo: "all" | PersonType;
  startDate: string | null;
  endDate: string | null;
  priority: number;
  checkInWindowStart: string;
  checkInWindowEnd: string;
  onTimeGraceMin: number;
  checkOutEarlyMin: number;
  checkOutWindowEnd: string;
  minGapBetweenScansMin: number;
  isActive?: boolean;
};
export type RuleDay = { rulePeriodId: number; weekday: number; isSchoolDay: boolean; checkIn: string | null; checkOut: string | null };

export type ResolvedRule = {
  periodId: number;
  isSchoolDay: boolean;
  checkIn: number; // menit
  checkOut: number;
  inStart: number;
  inEnd: number;
  graceMin: number;
  earlyMin: number;
  outEnd: number;
  minGap: number;
};

/** Pilih aturan jam yang berlaku pada tanggal itu. Yang paling spesifik menang. */
export function resolveRule(periods: RulePeriod[], days: RuleDay[], date: string, type: PersonType): ResolvedRule | null {
  const weekday = isoWeekday(date);
  const candidates = periods
    .filter((p) => p.isActive !== false && (p.appliesTo === "all" || p.appliesTo === type))
    .filter((p) => (!p.startDate || p.startDate <= date) && (!p.endDate || p.endDate >= date))
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        Number(b.appliesTo === type) - Number(a.appliesTo === type) ||
        (b.startDate ?? "").localeCompare(a.startDate ?? ""),
    );
  for (const p of candidates) {
    const day = days.find((d) => d.rulePeriodId === p.id && d.weekday === weekday);
    if (!day) continue; // periode ini tidak mengatur hari tsb, coba periode berikutnya
    return {
      periodId: p.id,
      isSchoolDay: day.isSchoolDay && !!day.checkIn && !!day.checkOut,
      checkIn: day.checkIn ? toMinutes(day.checkIn) : 0,
      checkOut: day.checkOut ? toMinutes(day.checkOut) : 0,
      inStart: toMinutes(p.checkInWindowStart),
      inEnd: toMinutes(p.checkInWindowEnd),
      graceMin: p.onTimeGraceMin,
      earlyMin: p.checkOutEarlyMin,
      outEnd: toMinutes(p.checkOutWindowEnd),
      minGap: p.minGapBetweenScansMin,
    };
  }
  return null;
}

export type CalendarEntry = {
  date: string;
  audience: "all" | PersonType;
  scopeType: "school" | "grade" | "class";
  grade: string | null;
  classId: number | null;
  kind: "effective" | "non_effective";
};

/** Kalender berlapis: kelas > tingkat > sekolah; audiens spesifik mengalahkan "all". null = tidak ada aturan khusus. */
export function resolveCalendar(
  entries: CalendarEntry[], date: string, type: PersonType, grade?: string | null, classId?: number | null,
): "effective" | "non_effective" | null {
  let best: { score: number; kind: CalendarEntry["kind"] } | null = null;
  for (const e of entries) {
    if (e.date !== date || !(e.audience === "all" || e.audience === type)) continue;
    const applies = e.scopeType === "school" || (e.scopeType === "grade" && !!grade && e.grade === grade) || (e.scopeType === "class" && classId != null && e.classId === classId);
    if (!applies) continue;
    const score = ({ school: 1, grade: 2, class: 3 }[e.scopeType]) * 10 + (e.audience === type ? 1 : 0);
    if (!best || score > best.score) best = { score, kind: e.kind };
  }
  return best?.kind ?? null;
}

export type DayInput = {
  date: string;
  scans: (Date | string)[]; // semua scan orang ini pada tanggal lokal tsb
  rule: ResolvedRule | null;
  isEffective: boolean; // sudah menggabungkan kalender + hari wajib hadir
  leave: "izin" | "sakit" | "dispensasi" | null; // keterangan seharian
  exitLeave: boolean; // izin keluar resmi
  pkl: boolean;
  syncedAt: Date | null; // waktu sync sukses terakhir
};

export type DayResult = {
  status: Status;
  checkIn: Date | null;
  checkOut: Date | null;
  noCheckOut: boolean;
  leftEarly: boolean;
  excusedExit: boolean;
};

const BLANK = { checkIn: null, checkOut: null, noCheckOut: false, leftEarly: false, excusedExit: false };

export function computeDay(i: DayInput): DayResult {
  const scans = i.scans
    .map((s) => new Date(s))
    .sort((a, b) => a.getTime() - b.getTime())
    .map((d) => ({ d, ...localParts(d) }))
    .filter((s) => s.date === i.date);

  // Hari bukan hari efektif/libur: scan tetap dicatat, tidak mengubah penyebut
  if (!i.rule || !i.rule.isSchoolDay || !i.isEffective) {
    return { ...BLANK, status: "libur", checkIn: scans[0]?.d ?? null, checkOut: scans.length > 1 ? scans[scans.length - 1].d : null };
  }
  const r = i.rule;

  const inScan = scans.find((s) => s.minutes >= r.inStart && s.minutes <= r.inEnd) ?? null;
  const outScan = inScan
    ? [...scans].reverse().find((s) => s.d.getTime() >= inScan.d.getTime() + r.minGap * 60000 && s.minutes <= r.outEnd) ?? null
    : null;

  if (i.pkl) return { ...BLANK, status: "pkl", checkIn: inScan?.d ?? null, checkOut: outScan?.d ?? null };

  // Hari dianggap selesai bila sync sukses terakhir terjadi setelah jam pulang hari itu
  const closed = !!i.syncedAt && i.syncedAt.getTime() + TZ_OFFSET_MIN * 60000 >= localMs(i.date, r.checkOut);

  const base = { checkIn: inScan?.d ?? null, checkOut: outScan?.d ?? null };
  if (!inScan) {
    if (i.leave) return { ...BLANK, ...base, status: i.leave };
    return { ...BLANK, ...base, status: closed ? "alpa" : "belum_ada_data" };
  }

  // Ada scan masuk valid: izin/sakit kalah oleh bukti kehadiran; dispensasi tetap dispensasi
  const status: Status = i.leave === "dispensasi" ? "dispensasi" : inScan.minutes <= r.checkIn + r.graceMin ? "hadir" : "terlambat";
  const excusedExit = i.exitLeave;
  const leftEarly = !!outScan && !excusedExit && outScan.minutes < r.checkOut - r.earlyMin;
  const noCheckOut = !outScan && closed && !excusedExit;
  return { status, ...base, noCheckOut, leftEarly, excusedExit };
}
