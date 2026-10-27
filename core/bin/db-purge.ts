#!/usr/bin/env node
// db-purge — run migration 0013's planner_draft_purge() once, as the database owner (review-em-s B2 point 4): everyone's plan tombstones
// older than 30 days (or --days=<n>, at least 1). The scheduled run is the Vercel Cron route /api/internal/plan-purge
// (web/lib/server/plan-purge.ts); this is the manual and child-branch run.
//
//   node --env-file=<owner env file> core/bin/db-purge.ts [--days=30] [--url=<conn>]
//
// Connects over DATABASE_URL_UNPOOLED (or DATABASE_URL, or --url) as the owner; the app role cannot execute the function. Prints a
// count only. Never point it at production before 0013 is applied there: it refuses when the function does not exist.
import { getClient } from "../src/db/client.ts";
import { purgeAllTombstones } from "../src/db/plans.ts";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main(): Promise<void> {
  const url = arg("url") ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("set DATABASE_URL_UNPOOLED (or DATABASE_URL), or pass --url=<conn>");
    process.exit(2);
  }
  const days = arg("days") === undefined ? undefined : Number(arg("days"));
  const client = await getClient(url);
  try {
    const { rows } = await client.query<{ f: string | null }>("select to_regprocedure('planner_draft_purge(integer)')::text as f");
    if (!rows[0]?.f) {
      console.error("planner_draft_purge(integer) does not exist here: migration 0013 is not applied");
      process.exit(3);
    }
    console.log(`purged ${await purgeAllTombstones(client, days)} tombstones`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
});
