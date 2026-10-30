import "dotenv/config";
import { db, schema as s } from "../db";
import { hashToken, newToken } from "../lib/agent-auth";

// Pakai: npm run agent:create -- "PC Sekolah"
async function main() {
  const name = process.argv[2] ?? "PC Sekolah";
  const [device] = await db.select().from(s.devices).limit(1);
  if (!device) throw new Error("Belum ada mesin. Jalankan npm run db:seed dulu.");
  const token = newToken();
  const [agent] = await db.insert(s.agents).values({ name, tokenHash: hashToken(token), deviceId: device.id }).returning();
  console.log(`\nAgent #${agent.id} "${name}" dibuat untuk mesin "${device.name}" (${device.ip}:${device.port}).`);
  console.log("\nTOKEN (hanya tampil sekali, simpan di agent/.env PC sekolah):\n");
  console.log(token + "\n");
}
main().catch((e) => { console.error(e); process.exit(1); });
