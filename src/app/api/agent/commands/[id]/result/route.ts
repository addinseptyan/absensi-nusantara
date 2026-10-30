import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { authenticateAgent, badRequest, unauthorized } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const Body = z.object({
  status: z.enum(["success", "failed"]),
  result: z.unknown().optional(),
  errorMessage: z.string().max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();
  const { id } = await params;
  const cmdId = Number(id);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(cmdId) || !parsed.success) return badRequest();

  const updated = await db.update(s.agentCommands).set({
    status: parsed.data.status,
    result: parsed.data.result ?? null,
    errorMessage: parsed.data.errorMessage ?? null,
    finishedAt: new Date(),
  }).where(and(eq(s.agentCommands.id, cmdId), eq(s.agentCommands.agentId, agent.id)))
    .returning({ id: s.agentCommands.id });

  return updated.length ? Response.json({ ok: true }) : Response.json({ error: "not_found" }, { status: 404 });
}
