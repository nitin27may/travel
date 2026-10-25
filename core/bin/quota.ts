#!/usr/bin/env node
// quota — sender monitoring for the auth guard (EML-Q; email spec "Decision 25 Oct" point 5).
//
//   node --env-file=<env file> core/bin/quota.ts stats [--days 7]
//
// Prints, per UTC day, the code sends Neon accepted, the sends Neon refused (429 or 5xx) and the codes verified, then the weekly
// deliverability signal (10 or more sends with fewer than half verified: mail may be landing in spam; Q148). Reads only the content-free
// global counters of `quota_bucket` (empty key); no address, hash or IP is read or printed. Connects with DATABASE_URL (the owner
// connection, which bypasses the table's deny-all RLS). Read only.
import { getClient } from "../src/db/client.ts";
import { DELIVERY_SIGNAL } from "../src/config/auth-limits.ts";
import { dailyCounts, formatStats, statsQuery, type StatsRow } from "../src/quota/stats.ts";

function days(argv: string[]): number {
  const i = argv.indexOf("--days");
  const n = i >= 0 ? Number(argv[i + 1]) : DELIVERY_SIGNAL.days;
  if (!Number.isInteger(n) || n < 1 || n > 35) throw new Error("--days takes a whole number from 1 to 35");
  return n;
}

async function main(): Promise<void> {
  const [cmd = "stats", ...rest] = process.argv.slice(2);
  if (cmd !== "stats") {
    console.error(`unknown command: ${cmd} (use: stats [--days N])`);
    process.exit(2);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("set DATABASE_URL (load the env file with node --env-file=...)");
    process.exit(2);
  }
  const n = days(rest);
  const today = new Date();
  const client = await getClient(url);
  try {
    const q = statsQuery(n, today);
    const { rows } = await client.query<StatsRow & Record<string, unknown>>(q.sql, q.params);
    console.log(formatStats(dailyCounts(rows, today, n)));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // Never the connection string: only the message of our own errors, or the SQLSTATE of a database one.
  const code = (err as { code?: unknown })?.code;
  console.error(typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? `quota stats failed (sqlstate=${code})` : String((err as Error)?.message ?? err));
  process.exit(1);
});
