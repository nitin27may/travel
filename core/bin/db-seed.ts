#!/usr/bin/env node
// db-seed: the seed engine's commands (LOCAL-2; docs/v2/features/local-database-and-seed-sync.md and local-database-usage.md).
//
//   node core/bin/db-seed.ts seed                    first load into an empty catalogue (pnpm db:seed)
//   node core/bin/db-seed.ts sync [--dry-run]        plan, then apply the difference in one transaction (pnpm db:sync)
//   node core/bin/db-seed.ts verify                  read only: row counts and table hashes against the seed (pnpm db:verify)
//
// Options: --target local|ci|child|production|<url> (default local), --url=<postgres url>, --allow-remote, --target-kind=<kind>,
// --approve=<sha>, --commit=<sha> (read the files of that commit, not the working tree), --root=<dir> (read inputs from another
// folder, for tests), --json (print the plan or drift result as JSON).
//
// Exit codes: 0 done, or no difference (dry run) / equal (verify); 3 dry run found a difference; 1 an error or a difference
// (verify); 2 the guard refused the target before any connection. Every target goes through the LOCAL-C guard; the default is the
// local Docker database. No message holds a connection string, user or password.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getClient, pgErrorCode } from "../src/db/client.ts";
import { TargetError } from "../src/db/localTarget.ts";
import { fsSource, gitSource } from "../src/catalogue/postgres/load/files.ts";
import { SeedEngineError } from "../src/catalogue/postgres/load/engine.ts";
import { SeedInputError } from "../src/catalogue/postgres/load/reference.ts";
import { buildSeed, executeSeedCommand, type SeedCommand } from "../src/catalogue/postgres/load/seed.ts";
import { resolveSeedTarget, TargetUnavailable } from "../src/catalogue/postgres/load/target.ts";
import { GuardRefusal, SeedContractError, readProductionHosts, readRehearsal, readRepoState, type GuardOperation } from "../src/seed/index.ts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const command = argv[0];
const rest = argv.slice(1);

function option(name: string): string | undefined {
  const eq = rest.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const at = rest.indexOf(`--${name}`);
  const next = rest[at + 1];
  return at >= 0 && next !== undefined && !next.startsWith("--") ? next : undefined;
}
const has = (name: string): boolean => rest.includes(`--${name}`);

const USAGE = "usage: db-seed.ts seed | sync [--dry-run] | verify  [--target t] [--url=u] [--allow-remote] [--approve=sha] [--commit=sha] [--json]";

function operationFor(cmd: string): { op: GuardOperation; run: SeedCommand } | undefined {
  if (cmd === "seed") return { op: "seed", run: "seed" };
  if (cmd === "verify") return { op: "verify", run: "verify" };
  if (cmd === "sync") return has("dry-run") ? { op: "sync_dry_run", run: "sync_dry_run" } : { op: "sync", run: "sync" };
  return undefined;
}

async function main(): Promise<number> {
  const picked = command ? operationFor(command) : undefined;
  if (!picked) {
    console.error(USAGE);
    return 2;
  }
  const repo = readRepoState(REPO);
  const commitFlag = option("commit");
  const commit = (commitFlag ?? repo.head ?? "").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new SeedEngineError("E_SEED_COMMIT", "cannot tell the commit: pass --commit <full sha> or run inside the repository");

  // 1. the guard decides, before any file or connection
  const target = resolveSeedTarget({
    name: option("target"), url: option("url"), allowRemote: has("allow-remote"), operation: picked.op,
    flags: { targetKind: option("target-kind"), approve: option("approve"), commit: commitFlag },
    repo, rehearsal: readRehearsal(REPO, commit), productionHosts: readProductionHosts(REPO),
  });

  // 2. build the seed: committed files for a non-loopback target or an explicit --commit, else the working tree
  const useGit = !target.loopback || commitFlag !== undefined;
  const root = option("root");
  if (useGit && root) throw new SeedEngineError("E_SEED_ROOT", "--root reads the working tree; it cannot be combined with --commit or a non-loopback target");
  const dataRoot = root ?? REPO;
  const src = useGit ? gitSource(REPO, commit) : fsSource(dataRoot);
  const started = Date.now();
  const built = buildSeed(src, commit, { checkRegistryAt: useGit || root ? undefined : REPO });
  if (!useGit && root) console.log("source registry check skipped (custom --root)");
  const buildMs = Date.now() - started;

  // 3. connect only now
  const client = await getClient(target.url);
  try {
    const result = await executeSeedCommand(client, picked.run, built, { commit, target: target.facts });
    if (has("json")) console.log(JSON.stringify(result.plan ?? result.drift, null, 2));
    else console.log(`${result.text}\nfiles: ${src.label}; seed built in ${buildMs} ms`);
    return result.exit;
  } finally {
    await client.end();
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    if (err instanceof GuardRefusal || err instanceof TargetError || err instanceof TargetUnavailable) {
      console.error(err.message);
      process.exit(2);
    }
    if (err instanceof SeedEngineError || err instanceof SeedInputError || err instanceof SeedContractError) {
      console.error(`${err.code}: ${err.message}`);
      process.exit(1);
    }
    // Anything else (a driver error): the SQLSTATE or the system error code only, never the message, which may echo a host or a value.
    const sys = err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string" ? (err as { code: string }).code : "";
    console.error(`seed failed (${/^[0-9A-Z]{5}$/.test(sys) ? `sqlstate ${pgErrorCode(err)}` : sys || "unexpected error"})`);
    process.exit(1);
  },
);
