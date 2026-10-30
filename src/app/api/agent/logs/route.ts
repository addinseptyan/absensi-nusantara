import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { authenticateAgent, badRequest, unauthorized } from "@/lib/agent-auth";


const Body = z.object({
  syncRunId: z.number().int().optional(),
  trigger: z.enum(["schedule", "manual"]).default("schedule"),
  logs: z.array(z.object({
    pin: z.string().min(1).max(20),
    ts: z.string().datetime({ offset: true }),
    verify: z.number().int().nullable().optional(),
    state: z.number().int().nullable().optional(),
  })).max(5000),
  final: z.boolean().default(false),
  error: z.object({ code: z.string().max(40), message: z.string().max(1000) }).optional(),
});

export async function POST(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();
  if (!agent.deviceId) return badRequest("Agent belum dihubungkan ke mesin");

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { logs, trigger, final, error } = parsed.data;
  let runId = parsed.data.syncRunId;

  if (!runId) {
    const [run] = await db.insert(s.syncRuns).values({ deviceId: agent.deviceId, trigger }).returning({ id: s.syncRuns.id });
    runId = run.id;
  }

  // Simpan data mentah; duplikat otomatis dilewati oleh unique index
  let newCount = 0;
  for (let i = 0; i < logs.length; i += 1000) {
    const inserted = await db.insert(s.rawLogs)
      .values(logs.slice(i, i + 1000).map((l) => ({
        deviceId: agent.deviceId!,
        devicePin: l.pin,
        punchedAt: new Date(l.ts),
        verifyType: l.verify ?? null,
        punchState: l.state ?? null,
        syncRunId: runId,
      })))
      .onConflictDoNothing()
      .returning({ id: s.rawLogs.id });
    newCount += inserted.length;
  }

  const done = final || !!error;
  const [prev] = await db.select().from(s.syncRuns).where(eq(s.syncRuns.id, runId));
  const totalNew = (prev?.newCount ?? 0) + newCount;
  await db.update(s.syncRuns).set({
    fetchedCount: sql`${s.syncRuns.fetchedCount} + ${logs.length}`,
    newCount: sql`${s.syncRuns.newCount} + ${newCount}`,
    ...(done && {
      finishedAt: new Date(),
      status: error ? (totalNew > 0 ? "partial" : "failed") : "success",
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? null,
    }),
  }).where(eq(s.syncRuns.id, runId));

  if (done && !error) await db.update(s.devices).set({ lastSeenAt: new Date() }).where(eq(s.devices.id, agent.deviceId));

  return Response.json({ syncRunId: runId, received: logs.length, new: newCount });
}
