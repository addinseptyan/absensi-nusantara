import { db, schema as s } from "@/db";

/** Catat tindakan penting. Satu fungsi dipakai semua halaman admin. */
export const audit = (userId: number, action: string, entity: string, entityId: string, after?: unknown, reason?: string) =>
  db.insert(s.auditLogs).values({ userId, action, entity, entityId, after: after ?? null, reason });
