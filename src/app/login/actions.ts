"use server";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { createSession, destroySession } from "@/lib/auth/session";

const Form = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function login(_prev: string | undefined, form: FormData) {
  const p = Form.safeParse(Object.fromEntries(form));
  if (!p.success) return "Isi email dan kata sandi dengan benar.";
  const [u] = await db.select().from(s.users).where(eq(sql`lower(${s.users.email})`, p.data.email.toLowerCase()));
  const ok = !!u?.isActive && (await bcrypt.compare(p.data.password, u.passwordHash));
  if (!ok) return "Email atau kata sandi salah.";
  await db.update(s.users).set({ lastLoginAt: new Date() }).where(eq(s.users.id, u.id));
  await createSession(u.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
