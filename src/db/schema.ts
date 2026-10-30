import { sql } from "drizzle-orm";
import {
  boolean, date, index, integer, jsonb, pgEnum, pgTable, primaryKey,
  text, time, timestamp, unique, uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Helper kolom (DRY)                                                  */
/* ------------------------------------------------------------------ */
const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Enum                                                                */
/* ------------------------------------------------------------------ */
export const personType = pgEnum("person_type", ["student", "staff"]);
export const personStatus = pgEnum("person_status", ["active", "graduated", "moved", "inactive"]);
export const gradeLevel = pgEnum("grade_level", ["X", "XI", "XII"]);
export const enrollmentStatus = pgEnum("enrollment_status", [
  "active", "promoted", "retained", "graduated", "moved",
]);
export const audience = pgEnum("audience", ["all", "student", "staff"]);
export const scopeType = pgEnum("scope_type", ["school", "grade", "class"]);
export const dayKind = pgEnum("day_kind", ["effective", "non_effective"]);
export const leaveType = pgEnum("leave_type", ["izin", "sakit", "dispensasi", "izin_keluar"]);
export const leaveStatus = pgEnum("leave_status", ["pending", "approved", "rejected"]);
export const attendanceStatus = pgEnum("attendance_status", [
  "hadir", "terlambat", "izin", "sakit", "dispensasi", "pkl", "alpa", "libur", "belum_ada_data",
]);
export const commandType = pgEnum("command_type", [
  "test_connection", "sync_now", "fetch_users", "sync_time", "diagnose",
]);
export const commandStatus = pgEnum("command_status", ["pending", "running", "success", "failed", "expired"]);
export const syncStatus = pgEnum("sync_status", ["running", "success", "partial", "failed"]);
export const logLevel = pgEnum("log_level", ["debug", "info", "warning", "error"]);

/* ------------------------------------------------------------------ */
/* Tahun ajaran, jurusan, kelas                                        */
/* ------------------------------------------------------------------ */
export const academicYears = pgTable("academic_years", {
  id: id(),
  name: text().notNull().unique(), // "2026/2027"
  startDate: date({ mode: "string" }).notNull(),
  endDate: date({ mode: "string" }).notNull(),
  isActive: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const majors = pgTable("majors", {
  id: id(),
  code: text().notNull().unique(), // AK, BD, TKR
  name: text().notNull(),
});

// Kelas dibuat PER tahun ajaran. XI Akuntansi kosong = cukup tidak dibuat.
export const classes = pgTable(
  "classes",
  {
    id: id(),
    academicYearId: integer().notNull().references(() => academicYears.id),
    grade: gradeLevel().notNull(),
    majorId: integer().notNull().references(() => majors.id),
    name: text().notNull(), // "X AK"
    homeroomStaffId: integer().references(() => people.id), // wali kelas
  },
  (t) => [unique().on(t.academicYearId, t.name)],
);

/* ------------------------------------------------------------------ */
/* Orang (siswa & guru/pegawai)                                        */
/* ------------------------------------------------------------------ */
export const people = pgTable(
  "people",
  {
    id: id(),
    type: personType().notNull(),
    name: text().notNull(),
    nisn: text(), // siswa
    nis: text(), // siswa
    nip: text(), // guru/pegawai
    gender: text(),
    phone: text(),
    parentPhone: text(),
    status: personStatus().notNull().default("active"),
    // ID/PIN di mesin ZKTeco. Kunci pencocokan scan. JANGAN cocokkan lewat nama.
    devicePin: text().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.type, t.status)],
);

// Kelas siswa per tahun ajaran (riwayat tidak rusak saat naik kelas)
export const classEnrollments = pgTable(
  "class_enrollments",
  {
    id: id(),
    personId: integer().notNull().references(() => people.id),
    classId: integer().notNull().references(() => classes.id),
    status: enrollmentStatus().notNull().default("active"),
    startDate: date({ mode: "string" }),
    endDate: date({ mode: "string" }),
  },
  (t) => [unique().on(t.personId, t.classId), index().on(t.classId)],
);

// Hari wajib hadir guru (guru tanpa jadwal di hari itu tidak dihitung alpa)
// weekday: 1=Senin ... 6=Sabtu, 7=Minggu
export const staffWorkDays = pgTable(
  "staff_work_days",
  {
    staffId: integer().notNull().references(() => people.id),
    weekday: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.weekday] })],
);

/* ------------------------------------------------------------------ */
/* Akun, role, izin                                                    */
/* (Jika memakai Better Auth, tabel session/account dibuat oleh library) */
/* ------------------------------------------------------------------ */
export const users = pgTable("users", {
  id: id(),
  personId: integer().references(() => people.id),
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text().notNull(),
  isActive: boolean().notNull().default(true),
  mustChangePassword: boolean().notNull().default(true),
  lastLoginAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});

export const roles = pgTable("roles", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  isSystem: boolean().notNull().default(false), // role bawaan tidak bisa dihapus
});

export const permissions = pgTable("permissions", {
  code: text().primaryKey(),
  group: text().notNull(),
  description: text().notNull(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer().notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionCode: text().notNull().references(() => permissions.code, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionCode] })],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: integer().notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: integer().notNull().references(() => roles.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

/* ------------------------------------------------------------------ */
/* Mesin, agent, perintah, sync                                        */
/* ------------------------------------------------------------------ */
export const devices = pgTable("devices", {
  id: id(),
  name: text().notNull(),
  ip: text().notNull(),
  port: integer().notNull().default(4370),
  commKeyEncrypted: text(), // terenkripsi; kosong/0 = tanpa Comm Key
  timeoutSec: integer().notNull().default(10),
  isActive: boolean().notNull().default(true),
  deviceTimeOffsetSec: integer(), // selisih jam mesin vs server (hasil diagnosa)
  lastSeenAt: timestamp({ withTimezone: true }),
});

export const agents = pgTable("agents", {
  id: id(),
  name: text().notNull(),
  tokenHash: text().notNull(), // token asli hanya tampil sekali saat dibuat
  deviceId: integer().references(() => devices.id),
  version: text(),
  lastSeenAt: timestamp({ withTimezone: true }),
  lastIp: text(),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
});

// Perintah dari web ke agent (whitelist via enum command_type)
export const agentCommands = pgTable(
  "agent_commands",
  {
    id: id(),
    agentId: integer().references(() => agents.id),
    type: commandType().notNull(),
    payload: jsonb(),
    status: commandStatus().notNull().default("pending"),
    result: jsonb(),
    errorMessage: text(),
    requestedBy: integer().references(() => users.id),
    createdAt: createdAt(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.status, t.createdAt)],
);

// Jadwal sync diatur dari web, dijalankan oleh agent
export const syncSchedules = pgTable("sync_schedules", {
  id: id(),
  runAt: time().notNull(), // "08:00"
  weekdays: integer().array().notNull().default(sql`'{1,2,3,4,5,6}'::int[]`),
  isActive: boolean().notNull().default(true),
});

export const syncRuns = pgTable("sync_runs", {
  id: id(),
  deviceId: integer().references(() => devices.id),
  trigger: text().notNull(), // schedule | manual
  status: syncStatus().notNull().default("running"),
  startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp({ withTimezone: true }),
  fetchedCount: integer().notNull().default(0),
  newCount: integer().notNull().default(0),
  errorCode: text(),
  errorMessage: text(),
});

// Data MENTAH dari mesin. Tidak pernah diubah.
export const rawLogs = pgTable(
  "raw_logs",
  {
    id: id(),
    deviceId: integer().notNull().references(() => devices.id),
    devicePin: text().notNull(),
    punchedAt: timestamp({ withTimezone: true }).notNull(),
    verifyType: integer(),
    punchState: integer(),
    syncRunId: integer().references(() => syncRuns.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex().on(t.deviceId, t.devicePin, t.punchedAt), // cegah duplikat
    index().on(t.devicePin, t.punchedAt),
  ],
);

export const systemLogs = pgTable(
  "system_logs",
  {
    id: id(),
    source: text().notNull(), // agent | web | rules
    level: logLevel().notNull().default("info"),
    message: text().notNull(),
    context: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.createdAt), index().on(t.level)],
);

/* ------------------------------------------------------------------ */
/* Aturan absensi (per periode: Reguler, Ramadan, dst.)                */
/* ------------------------------------------------------------------ */
export const rulePeriods = pgTable("rule_periods", {
  id: id(),
  name: text().notNull(), // "Reguler", "Ramadan 2027"
  appliesTo: audience().notNull().default("all"),
  startDate: date({ mode: "string" }), // null = berlaku terus (periode default)
  endDate: date({ mode: "string" }),
  priority: integer().notNull().default(0), // makin tinggi makin menang
  // Jendela & toleransi (menit relatif jam masuk/pulang, kecuali disebut jam)
  checkInWindowStart: time().notNull().default("05:00"), // scan masuk paling awal
  checkInWindowEnd: time().notNull().default("10:00"), // scan masuk paling akhir
  onTimeGraceMin: integer().notNull().default(0), // toleransi tepat waktu
  checkOutEarlyMin: integer().notNull().default(30), // pulang > X menit sebelum jam pulang = pulang awal
  checkOutWindowEnd: time().notNull().default("18:00"), // scan pulang paling akhir
  isActive: boolean().notNull().default(true),
});

// weekday: 1=Senin ... 7=Minggu
export const rulePeriodDays = pgTable(
  "rule_period_days",
  {
    id: id(),
    rulePeriodId: integer().notNull().references(() => rulePeriods.id, { onDelete: "cascade" }),
    weekday: integer().notNull(),
    isSchoolDay: boolean().notNull().default(true),
    checkIn: time(),
    checkOut: time(),
  },
  (t) => [unique().on(t.rulePeriodId, t.weekday)],
);

// Kalender hari efektif berlapis: class > grade > school (yang spesifik menang)
export const calendarDays = pgTable(
  "calendar_days",
  {
    id: id(),
    date: date({ mode: "string" }).notNull(),
    audience: audience().notNull().default("student"),
    scopeType: scopeType().notNull().default("school"),
    grade: gradeLevel(), // jika scope = grade
    classId: integer().references(() => classes.id), // jika scope = class
    kind: dayKind().notNull(),
    reason: text().notNull(), // "Ujian kelas XII", "Libur nasional"
    createdBy: integer().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.date, t.audience, t.scopeType, t.grade, t.classId).nullsNotDistinct(),
    index().on(t.date),
  ],
);

/* ------------------------------------------------------------------ */
/* Keterangan manual: izin/sakit/dispensasi, PKL                       */
/* ------------------------------------------------------------------ */
export const leaves = pgTable(
  "leaves",
  {
    id: id(),
    personId: integer().notNull().references(() => people.id),
    type: leaveType().notNull(),
    startDate: date({ mode: "string" }).notNull(),
    endDate: date({ mode: "string" }).notNull(),
    // izin_keluar: jam keluar sekolah
    leaveTime: time(),
    note: text(),
    attachmentUrl: text(),
    status: leaveStatus().notNull().default("approved"),
    createdBy: integer().references(() => users.id),
    approvedBy: integer().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.personId, t.startDate, t.endDate)],
);

export const pklAssignments = pgTable(
  "pkl_assignments",
  {
    id: id(),
    studentId: integer().notNull().references(() => people.id),
    placeName: text().notNull(),
    startDate: date({ mode: "string" }).notNull(),
    endDate: date({ mode: "string" }).notNull(),
    supervisorStaffId: integer().references(() => people.id),
    createdBy: integer().references(() => users.id),
  },
  (t) => [index().on(t.studentId, t.startDate, t.endDate)],
);

/* ------------------------------------------------------------------ */
/* Hasil olahan harian                                                 */
/* ------------------------------------------------------------------ */
export const attendanceDaily = pgTable(
  "attendance_daily",
  {
    id: id(),
    personId: integer().notNull().references(() => people.id),
    date: date({ mode: "string" }).notNull(),
    status: attendanceStatus().notNull(),
    checkIn: timestamp({ withTimezone: true }), // scan pertama dalam jendela masuk
    checkOut: timestamp({ withTimezone: true }), // scan terakhir dalam jendela pulang
    noCheckOut: boolean().notNull().default(false), // penanda: tidak absen pulang
    leftEarly: boolean().notNull().default(false), // penanda: pulang awal
    excusedExit: boolean().notNull().default(false), // penanda: izin keluar resmi
    isManual: boolean().notNull().default(false), // hasil koreksi manual
    note: text(),
    rulePeriodId: integer().references(() => rulePeriods.id), // aturan yang dipakai hari itu
    computedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.personId, t.date), index().on(t.date, t.status)],
);

export const periodLocks = pgTable("period_locks", {
  id: id(),
  startDate: date({ mode: "string" }).notNull(),
  endDate: date({ mode: "string" }).notNull(),
  reason: text(),
  lockedBy: integer().references(() => users.id),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Pengaturan & audit                                                  */
/* ------------------------------------------------------------------ */
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  description: text(),
  updatedAt: updatedAt(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: integer().references(() => users.id),
    action: text().notNull(), // "attendance.correct", "role.update"
    entity: text(),
    entityId: text(),
    before: jsonb(),
    after: jsonb(),
    reason: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.createdAt), index().on(t.entity, t.entityId)],
);
