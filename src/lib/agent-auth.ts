import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema as s } from "../db";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");

/** Mengembalikan agent jika header Authorization: Bearer <token> valid. */
export async function authenticateAgent(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const [agent] = await db.select().from(s.agents).where(eq(s.agents.tokenHash, hashToken(token)));
  return agent?.isActive ? agent : null;
}

export const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });
export const badRequest = (detail?: unknown) => Response.json({ error: "bad_request", detail }, { status: 400 });
