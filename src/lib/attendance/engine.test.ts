// Jalankan: npm run test:rules
import assert from "node:assert/strict";
import { test } from "node:test";
import { computeDay, resolveCalendar, resolveRule, type DayInput, type RuleDay, type RulePeriod } from "./engine";

/** Buat waktu UTC dari jam dinding WIB */
const wib = (date: string, hhmm: string, sec = "00") => new Date(`${date}T${hhmm}:${sec}+07:00`);

const base = { checkInWindowStart: "05:00", checkInWindowEnd: "10:00", onTimeGraceMin: 0, checkOutEarlyMin: 30, checkOutWindowEnd: "18:00", minGapBetweenScansMin: 30 };
const periods: RulePeriod[] = [
  { id: 1, appliesTo: "all", startDate: null, endDate: null, priority: 0, ...base },
  { id: 2, appliesTo: "all", startDate: "2027-02-18", endDate: "2027-03-19", priority: 10, ...base },
];
const reg = (weekday: number, out = "13:00") => ({ rulePeriodId: 1, weekday, isSchoolDay: true, checkIn: "07:00:00", checkOut: out });
const days: RuleDay[] = [
  reg(1), reg(2), reg(3), reg(4), reg(5, "11:00:00"), reg(6),
  { rulePeriodId: 1, weekday: 7, isSchoolDay: false, checkIn: null, checkOut: null },
  { rulePeriodId: 2, weekday: 1, isSchoolDay: true, checkIn: "07:30:00", checkOut: "12:00:00" },
];

const MON = "2026-10-26"; // Senin
const FRI = "2026-10-30"; // Jumat
const day = (date: string, scans: Date[], over: Partial<DayInput> = {}): DayInput => ({
  date, scans, rule: resolveRule(periods, days, date, "student"), isEffective: true,
  leave: null, exitLeave: false, pkl: false, syncedAt: wib(date, "15:00"), ...over,
});

test("tepat waktu: masuk 06:55, pulang 13:05 => hadir", () => {
  const r = computeDay(day(MON, [wib(MON, "06:55"), wib(MON, "13:05")]));
  assert.equal(r.status, "hadir"); assert.equal(r.noCheckOut, false); assert.equal(r.leftEarly, false);
});
test("batas: 07:00:59 masih hadir, 07:01 terlambat", () => {
  assert.equal(computeDay(day(MON, [wib(MON, "07:00", "59"), wib(MON, "13:00")])).status, "hadir");
  assert.equal(computeDay(day(MON, [wib(MON, "07:01"), wib(MON, "13:00")])).status, "terlambat");
});
test("toleransi dari pengaturan: grace 5 menit", () => {
  const p = [{ ...periods[0], onTimeGraceMin: 5 }];
  const rule = resolveRule(p, days, MON, "student");
  assert.equal(computeDay(day(MON, [wib(MON, "07:05"), wib(MON, "13:00")], { rule })).status, "hadir");
  assert.equal(computeDay(day(MON, [wib(MON, "07:06"), wib(MON, "13:00")], { rule })).status, "terlambat");
});
test("scan ganda pagi tidak dianggap scan pulang", () => {
  const r = computeDay(day(MON, [wib(MON, "06:50"), wib(MON, "06:51")]));
  assert.equal(r.status, "hadir"); assert.equal(r.checkOut, null); assert.equal(r.noCheckOut, true);
});
test("ambil scan masuk PERTAMA dan scan pulang TERAKHIR", () => {
  const r = computeDay(day(MON, [wib(MON, "06:50"), wib(MON, "06:55"), wib(MON, "12:50"), wib(MON, "13:10")]));
  assert.equal(r.checkIn?.getTime(), wib(MON, "06:50").getTime());
  assert.equal(r.checkOut?.getTime(), wib(MON, "13:10").getTime());
});
test("pulang awal: 11:30 pada hari Senin (jam pulang 13:00)", () => {
  const r = computeDay(day(MON, [wib(MON, "06:55"), wib(MON, "11:30")]));
  assert.equal(r.status, "hadir"); assert.equal(r.leftEarly, true);
});
test("izin keluar resmi: tidak ditandai pulang awal / tidak absen pulang", () => {
  assert.equal(computeDay(day(MON, [wib(MON, "06:55"), wib(MON, "11:30")], { exitLeave: true })).leftEarly, false);
  assert.equal(computeDay(day(MON, [wib(MON, "06:55")], { exitLeave: true })).noCheckOut, false);
});
test("Jumat jam pulang 11:00: pulang 10:45 bukan pulang awal", () => {
  const r = computeDay(day(FRI, [wib(FRI, "06:58"), wib(FRI, "10:45")]));
  assert.equal(r.leftEarly, false); assert.equal(r.status, "hadir");
});
test("tidak absen pulang hanya ditandai setelah hari selesai (sync setelah jam pulang)", () => {
  assert.equal(computeDay(day(MON, [wib(MON, "06:55")], { syncedAt: wib(MON, "08:00") })).noCheckOut, false);
  assert.equal(computeDay(day(MON, [wib(MON, "06:55")])).noCheckOut, true);
});
test("tanpa scan: alpa jika hari sudah selesai, belum_ada_data jika belum", () => {
  assert.equal(computeDay(day(MON, [])).status, "alpa");
  assert.equal(computeDay(day(MON, [], { syncedAt: wib(MON, "08:00") })).status, "belum_ada_data");
  assert.equal(computeDay(day(MON, [], { syncedAt: null })).status, "belum_ada_data");
});
test("scan sebelum jendela masuk (04:30) diabaikan, scan lewat batas (10:30) tidak dihitung masuk", () => {
  assert.equal(computeDay(day(MON, [wib(MON, "04:30")])).status, "alpa");
  assert.equal(computeDay(day(MON, [wib(MON, "10:30")])).status, "alpa");
});
test("izin/sakit tanpa scan => sesuai keterangan; dengan scan => scan menang", () => {
  assert.equal(computeDay(day(MON, [], { leave: "sakit" })).status, "sakit");
  assert.equal(computeDay(day(MON, [], { leave: "izin" })).status, "izin");
  assert.equal(computeDay(day(MON, [wib(MON, "07:20"), wib(MON, "13:00")], { leave: "izin" })).status, "terlambat");
});
test("dispensasi tetap dispensasi walau ada scan, dan terlambat tidak berlaku", () => {
  assert.equal(computeDay(day(MON, [wib(MON, "07:40"), wib(MON, "13:00")], { leave: "dispensasi" })).status, "dispensasi");
  assert.equal(computeDay(day(MON, [], { leave: "dispensasi" })).status, "dispensasi");
});
test("PKL: bukan alpa", () => assert.equal(computeDay(day(MON, [], { pkl: true })).status, "pkl"));
test("hari tidak efektif: libur, scan tetap tercatat", () => {
  const r = computeDay(day(MON, [wib(MON, "08:00"), wib(MON, "12:00")], { isEffective: false }));
  assert.equal(r.status, "libur"); assert.notEqual(r.checkIn, null);
});
test("Minggu bukan hari sekolah => libur", () => assert.equal(computeDay(day("2026-10-25", [])).status, "libur"));

test("periode Ramadan menimpa Reguler, setelahnya kembali ke Reguler", () => {
  assert.equal(resolveRule(periods, days, "2027-03-01", "student")?.checkIn, 7 * 60 + 30); // Senin dalam Ramadan
  assert.equal(resolveRule(periods, days, "2027-03-02", "student")?.checkIn, 7 * 60); // Selasa: Ramadan tak mengatur hari ini, jatuh ke Reguler
  assert.equal(resolveRule(periods, days, "2027-03-22", "student")?.checkIn, 7 * 60); // Senin setelah Ramadan
});

const cal = [
  { date: "2027-03-10", audience: "student" as const, scopeType: "grade" as const, grade: "X", classId: null, kind: "non_effective" as const },
  { date: "2027-03-10", audience: "student" as const, scopeType: "grade" as const, grade: "XI", classId: null, kind: "non_effective" as const },
  { date: "2027-03-11", audience: "all" as const, scopeType: "school" as const, grade: null, classId: null, kind: "non_effective" as const },
  { date: "2027-03-11", audience: "student" as const, scopeType: "class" as const, grade: null, classId: 7, kind: "effective" as const },
];
test("kalender: ujian kelas XII, kelas X dan XI belajar di rumah", () => {
  assert.equal(resolveCalendar(cal, "2027-03-10", "student", "X"), "non_effective");
  assert.equal(resolveCalendar(cal, "2027-03-10", "student", "XI"), "non_effective");
  assert.equal(resolveCalendar(cal, "2027-03-10", "student", "XII"), null);
  assert.equal(resolveCalendar(cal, "2027-03-10", "staff", "X"), null);
});
test("kalender: kelas mengalahkan sekolah", () => {
  assert.equal(resolveCalendar(cal, "2027-03-11", "student", "XII", 7), "effective");
  assert.equal(resolveCalendar(cal, "2027-03-11", "student", "XII", 8), "non_effective");
});
