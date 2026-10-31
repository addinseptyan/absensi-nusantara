"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { guard } from "@/lib/action";
import { requirePermission } from "@/lib/auth/current-user";

const Type = z.enum(s.commandType.enumValues);

export async function sendCommand(form: FormData) {
  return guard(async () => {
    const type = Type.parse(form.get("type"));
    const user = await requirePermission(type === "sync_now" ? "device.sync_now" : "system.health");
    await db.insert(s.agentCommands).values({ type, requestedBy: user.id });
    revalidatePath("/kesehatan");
    return "Perintah dikirim ke agent. Hasilnya tampil dalam sekitar 30 detik.";
  });
}
