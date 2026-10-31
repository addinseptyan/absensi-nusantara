"use server";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth/current-user";

export async function sendCommand(type: (typeof s.commandType.enumValues)[number]) {
  const user = await requirePermission(type === "sync_now" ? "device.sync_now" : "system.health");
  await db.insert(s.agentCommands).values({ type, requestedBy: user.id });
  revalidatePath("/kesehatan");
}
