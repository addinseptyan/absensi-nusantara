import "dotenv/config";
import { count, desc, notInArray, sql } from "drizzle-orm";
import { db, schema as s } from "../db";

const wib = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour12: false }) : "-";
const ago = (d: Date | string | null) => (d ? `${Math.round((Date.now() - new Date(d).getTime()) / 60000)} menit lalu` : "belum pernah");

async function main() {
  console.log("\n=== AGENT ===");
  for (const a of await db.select().from(s.agents)) {
    const online = a.lastSeenAt && Date.now() - new Date(a.lastSeenAt).getTime() < 120000;
    console.log(`#${a.id} ${a.name}  ${online ? "ONLINE" : "OFFLINE"}  terakhir: ${ago(a.lastSeenAt)}  v${a.version ?? "?"}  IP: ${a.lastIp ?? "-"}`);
  }

  console.log("\n=== PERINTAH TERAKHIR ===");
  for (const c of await db.select().from(s.agentCommands).orderBy(desc(s.agentCommands.id)).limit(5)) {
    console.log(`#${c.id} ${c.type} → ${c.status} (${wib(c.createdAt)})${c.errorMessage ? "\n   ERROR: " + c.errorMessage : ""}`);
    if (c.result) console.log("   " + JSON.stringify(c.result).slice(0, 600));
  }

  console.log("\n=== SYNC TERAKHIR ===");
  for (const r of await db.select().from(s.syncRuns).orderBy(desc(s.syncRuns.id)).limit(5)) {
    console.log(`#${r.id} ${r.trigger} ${r.status}  ${wib(r.startedAt)}  ditarik ${r.fetchedCount}, baru ${r.newCount}${r.errorMessage ? "\n   ERROR [" + r.errorCode + "]: " + r.errorMessage : ""}`);
  }

  const [{ n }] = await db.select({ n: count() }).from(s.rawLogs);
  console.log(`\nTotal log mentah di database: ${n}`);

  const known = (await db.select({ pin: s.people.devicePin }).from(s.people)).map((p) => p.pin!).filter(Boolean);
  const unknown = await db.select({ pin: s.rawLogs.devicePin, n: count() }).from(s.rawLogs)
    .where(known.length ? notInArray(s.rawLogs.devicePin, known) : sql`true`).groupBy(s.rawLogs.devicePin);
  console.log(unknown.length ? `PIN belum terpetakan: ${unknown.map((u) => `${u.pin} (${u.n}x)`).join(", ")}` : "Semua PIN di log sudah terpetakan.");

  console.log("\n=== LOG AGENT/SISTEM (10 terakhir) ===");
  for (const l of await db.select().from(s.systemLogs).orderBy(desc(s.systemLogs.id)).limit(10)) {
    console.log(`${wib(l.createdAt)} [${l.level}] ${l.source}: ${l.message}`);
  }
  console.log();
}
main().catch((e) => { console.error(e); process.exit(1); });
