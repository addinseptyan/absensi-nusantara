import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import * as s from "./schema";
import { DEFAULT_ROLES, PERMISSIONS } from "../lib/permissions";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema: s });

async function main() {
  console.log("Seeding...");

  // 1. Izin (sumber: src/lib/permissions.ts)
  await db.insert(s.permissions).values([...PERMISSIONS]).onConflictDoNothing();

  // 2. Role bawaan + izinnya (hanya dibuat jika belum ada, agar edit admin tidak tertimpa)
  for (const r of DEFAULT_ROLES) {
    const existing = await db.select().from(s.roles).where(eq(s.roles.slug, r.slug));
    if (existing.length) continue;
    const [role] = await db
      .insert(s.roles)
      .values({ slug: r.slug, name: r.name, description: r.description, isSystem: true })
      .returning();
    const codes = r.permissions === "ALL" ? PERMISSIONS.map((p) => p.code) : r.permissions;
    await db.insert(s.rolePermissions).values(codes.map((c) => ({ roleId: role.id, permissionCode: c })));
  }

  // 3. Jurusan
  await db
    .insert(s.majors)
    .values([
      { code: "AK", name: "Akuntansi" },
      { code: "BD", name: "Bisnis Digital" },
      { code: "TKR", name: "Teknik Kendaraan Ringan" },
    ])
    .onConflictDoNothing();

  // 4. Mesin
  const hasDevice = await db.select().from(s.devices).limit(1);
  if (!hasDevice.length) {
    await db.insert(s.devices).values({ name: "ZKTeco K20", ip: "192.168.1.168", port: 4370 });
  }

  // 5. Jadwal sync 08:00 dan 15:00, Senin-Sabtu
  const hasSched = await db.select().from(s.syncSchedules).limit(1);
  if (!hasSched.length) {
    await db.insert(s.syncSchedules).values([{ runAt: "08:00" }, { runAt: "15:00" }]);
  }

  // 6. Aturan jam Reguler: Senin-Sabtu 07:00-13:00, Jumat pulang 11:00
  const hasRule = await db.select().from(s.rulePeriods).limit(1);
  if (!hasRule.length) {
    const [p] = await db
      .insert(s.rulePeriods)
      .values({ name: "Reguler", appliesTo: "all", priority: 0 })
      .returning();
    const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      rulePeriodId: p.id,
      weekday,
      isSchoolDay: weekday !== 7,
      checkIn: weekday === 7 ? null : "07:00",
      checkOut: weekday === 7 ? null : weekday === 5 ? "11:00" : "13:00",
    }));
    await db.insert(s.rulePeriodDays).values(days);
  }

  // 7. Pengaturan kebijakan
  await db
    .insert(s.settings)
    .values([
      { key: "dispensasi_counts_as_present", value: true, description: "Dispensasi dihitung hadir di persentase" },
      { key: "pkl_excluded_from_effective_days", value: true, description: "Hari PKL dikeluarkan dari hari efektif" },
      { key: "school_name", value: "SMKS Nusantara Banyuwangi", description: "Nama sekolah (kop export)" },
      { key: "timezone", value: "Asia/Jakarta", description: "Zona waktu" },
      { key: "auto_alpa_after_close", value: true, description: "Tandai alpa otomatis saat hari ditutup" },
    ])
    .onConflictDoNothing();

  // 8. Akun admin pertama (dari .env)
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const has = await db.select().from(s.users).where(eq(s.users.email, email));
    if (!has.length) {
      const [u] = await db
        .insert(s.users)
        .values({ email, name: "Administrator", passwordHash: await bcrypt.hash(password, 12) })
        .returning();
      const [adminRole] = await db.select().from(s.roles).where(eq(s.roles.slug, "admin"));
      await db.insert(s.userRoles).values({ userId: u.id, roleId: adminRole.id });
      console.log(`Admin dibuat: ${email} (wajib ganti password saat login pertama)`);
    }
  } else {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD belum diisi, akun admin dilewati.");
  }

  console.log("Selesai.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
