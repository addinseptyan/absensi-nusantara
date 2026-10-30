import "dotenv/config";
import { db, schema as s } from "../db";

// Pakai: npm run cmd -- test_connection | diagnose | sync_now | fetch_users | sync_time
const TYPES = s.commandType.enumValues;
async function main() {
  const type = process.argv[2] as (typeof TYPES)[number];
  if (!TYPES.includes(type)) throw new Error(`Perintah harus salah satu dari: ${TYPES.join(", ")}`);
  const [c] = await db.insert(s.agentCommands).values({ type }).returning({ id: s.agentCommands.id });
  console.log(`Perintah #${c.id} (${type}) dikirim. Agent mengambilnya dalam ±30 detik. Cek hasil: npm run status`);
}
main().catch((e) => { console.error(e); process.exit(1); });
