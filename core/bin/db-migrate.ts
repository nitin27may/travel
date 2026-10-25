#!/usr/bin/env node
// db-migrate — apply or inspect database migrations.
//
// Usage (load secrets from the ignored env file):
//   node --env-file=.env.local core/bin/db-migrate.ts status
//   node --env-file=.env.local core/bin/db-migrate.ts up
//   node --env-file=.env.local core/bin/db-migrate.ts plan      # dry-run, no writes
//
// Connects over the DIRECT (unpooled) connection as the database owner — DDL and advisory locks want
// a stable session. Override with DATABASE_URL_UNPOOLED, or DATABASE_URL, or --url=<conn>.
// Production application is gated: the runner only ever applies additive, reviewed migrations, and
// never drops. Point it at a child branch first (see docs/v2/build/public-site/NEON-MIGRATIONS.md).

import { getClient } from "../src/db/client.ts";
import { loadMigrations } from "../src/db/loader.ts";
import { migrate, planAgainst } from "../src/db/runner.ts";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "status";
  const url = arg("url") ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("set DATABASE_URL_UNPOOLED (or DATABASE_URL), or pass --url=<conn>");
    process.exit(2);
  }
  const migrations = loadMigrations();
  const client = await getClient(url);
  try {
    if (cmd === "status" || cmd === "plan") {
      const p = await planAgainst(client, migrations);
      console.log(`applied: ${p.applied.length}`);
      for (const a of p.applied) console.log(`  ✓ ${a.version}_${a.name}`);
      console.log(`pending: ${p.pending.length}`);
      for (const m of p.pending) console.log(`  … ${m.version}_${m.name}  ${m.checksum.slice(0, 12)}`);
      if (cmd === "plan") console.log("(plan only; nothing applied)");
      return;
    }
    if (cmd === "up") {
      const res = await migrate(client, { migrations });
      if (res.applied.length === 0) console.log("up to date; nothing to apply");
      else console.log(`applied ${res.applied.length}: ${res.applied.join(", ")}`);
      return;
    }
    console.error(`unknown command: ${cmd} (use status | plan | up)`);
    process.exit(2);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
});
