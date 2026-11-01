import { db, schema as s } from "@/db";

/** Catat tindakan penting. Satu fungsi dipakai semua halaman admin. */
export const audit = (userId: number, action: string, entity: string, entityId: string, after?: unknown, reason?: string, before?: unknown) =>
  db.insert(s.auditLogs).values({ userId, action, entity, entityId, before: before ?? null, after: after ?? null, reason });
