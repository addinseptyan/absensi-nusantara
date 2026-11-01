"use server";
import bcrypt from "bcryptjs";
import { eq, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { createSession, destroySession } from "@/lib/auth/session";

const MAX_FAILS = 5;      // salah berturut-turut sebelum ditahan
const LOCK_MIN = 15;      // lama ditahan (menit)
const WINDOW_MIN = 30;    // hitungan salah dilupakan jika tidak ada percobaan selama ini
const Form = z.object({ login: z.string().trim().min(1), password: z.string().min(1) });

export async function login(_prev: string | undefined, form: FormData) {
  const p = Form.safeParse(Object.fromEntries(form));
  if (!p.success) return "Isi username (atau email) dan kata sandi.";
  const id = p.data.login.toLowerCase();
  const now = new Date();

  const [t] = await db.select().from(s.loginThrottle).where(eq(s.loginThrottle.key, id));
  if (t?.lockedUntil && t.lockedUntil > now) {
    const m = Math.ceil((t.lockedUntil.getTime() - now.getTime()) / 60000);
    return `Terlalu banyak percobaan yang salah. Coba lagi dalam ${m} menit.`;
  }

  const [u] = await db.select().from(s.users).where(or(eq(sql`lower(${s.users.username})`, id), eq(sql`lower(${s.users.email})`, id)));
  const ok = !!u?.isActive && (await bcrypt.compare(p.data.password, u.passwordHash));

  if (!ok) {
    const stale = !t || now.getTime() - t.updatedAt.getTime() > WINDOW_MIN * 60000;
    const failures = (stale ? 0 : t.failures) + 1;
    const lockedUntil = failures >= MAX_FAILS ? new Date(now.getTime() + LOCK_MIN * 60000) : null;
    const row = { key: id, failures: lockedUntil ? 0 : failures, lockedUntil, updatedAt: now };
    await db.insert(s.loginThrottle).values(row).onConflictDoUpdate({ target: s.loginThrottle.key, set: row });
    return lockedUntil ? `Terlalu banyak percobaan yang salah. Login ditahan ${LOCK_MIN} menit.` : `Username/email atau kata sandi salah. Sisa percobaan: ${MAX_FAILS - failures}.`;
  }

  if (t) await db.delete(s.loginThrottle).where(eq(s.loginThrottle.key, id));
  await db.update(s.users).set({ lastLoginAt: now }).where(eq(s.users.id, u.id));
  await createSession(u.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
