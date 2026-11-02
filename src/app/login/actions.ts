"use server";
import bcrypt from "bcryptjs";
import { eq, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { createSession, destroySession } from "@/lib/auth/session";

const ACCOUNT_MAX = 5;   // salah kata sandi berturut-turut pada satu akun sebelum akun itu ditahan
const IP_MAX = 20;       // total percobaan salah dari satu jaringan; dibuat longgar karena seluruh sekolah memakai satu IP
const LOCK_MIN = 15;     // lama ditahan (menit)
const WINDOW_MIN = 30;   // hitungan salah dilupakan jika tidak ada percobaan salah selama ini
const Form = z.object({ login: z.string().trim().min(1), password: z.string().min(1) });

async function lockedMinutes(key: string, now: Date) {
  const [t] = await db.select().from(s.loginThrottle).where(eq(s.loginThrottle.key, key));
  return t?.lockedUntil && t.lockedUntil > now ? Math.ceil((t.lockedUntil.getTime() - now.getTime()) / 60000) : null;
}

async function registerFailure(key: string, max: number, now: Date) {
  const [t] = await db.select().from(s.loginThrottle).where(eq(s.loginThrottle.key, key));
  const stale = !t || now.getTime() - t.updatedAt.getTime() > WINDOW_MIN * 60000;
  const failures = (stale ? 0 : t.failures) + 1;
  const lockedUntil = failures >= max ? new Date(now.getTime() + LOCK_MIN * 60000) : null;
  const row = { key, failures: lockedUntil ? 0 : failures, lockedUntil, updatedAt: now };
  await db.insert(s.loginThrottle).values(row).onConflictDoUpdate({ target: s.loginThrottle.key, set: row });
  return { failures, locked: !!lockedUntil };
}

export async function login(_prev: string | undefined, form: FormData) {
  const p = Form.safeParse(Object.fromEntries(form));
  if (!p.success) return "Isi username (atau email) dan kata sandi.";
  const id = p.data.login.toLowerCase();
  const now = new Date();
  const ip = ((await headers()).get("x-forwarded-for")?.split(",")[0] ?? "tidak-diketahui").trim();
  const ipKey = `ip:${ip}`;

  const ipLock = await lockedMinutes(ipKey, now);
  if (ipLock) return `Terlalu banyak percobaan yang salah dari jaringan ini. Coba lagi dalam ${ipLock} menit.`;

  const [u] = await db.select().from(s.users).where(or(eq(sql`lower(${s.users.username})`, id), eq(sql`lower(${s.users.email})`, id)));
  if (!u) {
    const r = await registerFailure(ipKey, IP_MAX, now);
    return r.locked ? `Terlalu banyak percobaan yang salah dari jaringan ini. Login ditahan ${LOCK_MIN} menit.` : "Username atau email tidak terdaftar.";
  }

  const accKey = `u:${u.id}`;
  const accLock = await lockedMinutes(accKey, now);
  if (accLock) return `Akun ini ditahan sementara karena terlalu banyak salah kata sandi. Coba lagi dalam ${accLock} menit.`;

  if (!(await bcrypt.compare(p.data.password, u.passwordHash))) {
    const acc = await registerFailure(accKey, ACCOUNT_MAX, now);
    await registerFailure(ipKey, IP_MAX, now);
    return acc.locked ? `Kata sandi salah ${ACCOUNT_MAX} kali. Akun ditahan ${LOCK_MIN} menit.` : `Kata sandi salah. Sisa percobaan: ${ACCOUNT_MAX - acc.failures}.`;
  }
  if (!u.isActive) return "Akun Anda dinonaktifkan. Hubungi admin sekolah.";

  await db.delete(s.loginThrottle).where(eq(s.loginThrottle.key, accKey));
  await db.update(s.users).set({ lastLoginAt: now }).where(eq(s.users.id, u.id));
  await createSession(u.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
