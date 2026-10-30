import { and, eq, isNull, lt, max, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { authenticateAgent, badRequest, unauthorized } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const Body = z.object({
  version: z.string().max(40).optional(),
  logs: z
    .array(z.object({
      level: z.enum(["debug", "info", "warning", "error"]),
      message: z.string().max(2000),
      context: z.unknown().optional(),
    }))
    .max(50)
    .optional(),
});

const MINUTES = 60 * 1000;

export async function POST(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { version, logs } = parsed.data;

  await db.update(s.agents).set({
    lastSeenAt: new Date(),
    version: version ?? agent.version,
    lastIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  }).where(eq(s.agents.id, agent.id));

  if (logs?.length) {
    await db.insert(s.systemLogs).values(
      logs.map((l) => ({ source: "agent", level: l.level, message: l.message, context: l.context ?? null })),
    );
  }

  // Bersihkan perintah macet
  const tenMinAgo = new Date(Date.now() - 10 * MINUTES);
  await db.update(s.agentCommands).set({ status: "expired" })
    .where(and(eq(s.agentCommands.status, "pending"), lt(s.agentCommands.createdAt, tenMinAgo)));
  await db.update(s.agentCommands)
    .set({ status: "failed", errorMessage: "Agent tidak melaporkan hasil (mungkin mati atau restart).", finishedAt: new Date() })
    .where(and(eq(s.agentCommands.status, "running"), lt(s.agentCommands.startedAt, tenMinAgo)));

  // Ambil perintah baru (diklaim agent ini)
  const commands = await db.update(s.agentCommands)
    .set({ status: "running", startedAt: new Date(), agentId: agent.id })
    .where(and(
      eq(s.agentCommands.status, "pending"),
      or(isNull(s.agentCommands.agentId), eq(s.agentCommands.agentId, agent.id)),
    ))
    .returning({ id: s.agentCommands.id, type: s.agentCommands.type, payload: s.agentCommands.payload });

  const [device] = agent.deviceId
    ? await db.select().from(s.devices).where(eq(s.devices.id, agent.deviceId))
    : [];
  const schedules = await db.select().from(s.syncSchedules).where(eq(s.syncSchedules.isActive, true));
  const [{ last }] = device
    ? await db.select({ last: max(s.rawLogs.punchedAt) }).from(s.rawLogs).where(eq(s.rawLogs.deviceId, device.id))
    : [{ last: null }];

  return Response.json({
    serverTime: new Date().toISOString(),
    device: device
      ? { id: device.id, ip: device.ip, port: device.port, timeout: device.timeoutSec, commKey: 0, active: device.isActive }
      : null,
    schedules: schedules.map((x) => ({ id: x.id, runAt: x.runAt.slice(0, 5), weekdays: x.weekdays })),
    lastLogAt: last ? new Date(last).toISOString() : null,
    commands,
  });
}
