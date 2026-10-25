#!/usr/bin/env node
// db-local: the `pnpm db:*` commands for the local Postgres (docs/v2/features/local-database-usage.md).
//
//   up | down | reset | migrate | status | psql | test | url | wait
//
// Every command resolves its target through core/src/db/localTarget.ts, which never reads DATABASE_URL or a
// repo env file and refuses the production host. Output never contains a connection string, except `url`,
// which exists to feed TEST_DATABASE_URL on the owner's own machine.

import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertLoopback,
  ensureLocalCredentials,
  passwordFilePath,
  resolveTarget,
  scrubbedEnv,
  TargetError,
  type ResolveOptions,
} from "../src/db/localTarget.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMPOSE = join(ROOT, "tools", "db", "compose.yml");

const args = process.argv.slice(2);
const cmd = args[0] ?? "status";
const rest = args.slice(1);
const flag = (n: string): string | undefined => rest.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const has = (n: string): boolean => rest.includes(`--${n}`);

function run(command: string, argv: string[], opts: SpawnSyncOptions = {}): number {
  const r = spawnSync(command, argv, { stdio: "inherit", cwd: ROOT, ...opts });
  if (r.error) {
    if ((r.error as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`${command} not found; install Docker Desktop (see docs/v2/features/local-database-usage.md)`);
      return 127;
    }
    throw r.error;
  }
  return r.status ?? 1;
}

function dockerRunning(): boolean {
  const r = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { stdio: "ignore" });
  return r.status === 0;
}

function requireDocker(): void {
  if (!dockerRunning()) {
    console.error("Docker is not running. Open Docker Desktop (`open -a Docker`), wait for \"Engine running\", then retry.");
    process.exit(3);
  }
}

function composeArgs(sub: string[]): string[] {
  return ["compose", "--env-file", passwordFilePath(), "-f", COMPOSE, ...sub];
}

function resolveOpts(): ResolveOptions {
  const url = flag("url");
  return { url, allowRemote: has("allow-remote") };
}

function target() {
  return resolveTarget(resolveOpts());
}

/** Env for a child that needs a URL: the explicit one only, everything ambient removed. */
function childEnv(url: string, extra: Record<string, string> = {}): Record<string, string> {
  return { ...scrubbedEnv(), ...extra, DATABASE_URL_UNPOOLED: url };
}

function up(): number {
  requireDocker();
  ensureLocalCredentials();
  const code = run("docker", composeArgs(["up", "-d", "--build", "--wait"]));
  if (code === 0) console.log("local database is up on 127.0.0.1 (credentials in " + passwordFilePath() + ")");
  return code;
}

function migrate(sub: "up" | "status" | "plan"): number {
  const t = target();
  console.log(`target: ${t.name} (${t.host})`);
  return run("node", [join(ROOT, "core", "bin", "db-migrate.ts"), sub], { env: childEnv(t.url) });
}

function main(): number {
  switch (cmd) {
    case "up":
      return up();
    case "down":
      requireDocker();
      ensureLocalCredentials();
      return run("docker", composeArgs(["down"]));
    case "reset": {
      // Destructive: loopback only, whatever else is passed.
      assertLoopback(target());
      requireDocker();
      ensureLocalCredentials();
      let code = run("docker", composeArgs(["down", "--volumes", "--remove-orphans"]));
      if (code !== 0) return code;
      code = up();
      if (code !== 0) return code;
      return migrate("up");
    }
    case "migrate":
      return migrate("up");
    case "status":
      return migrate("status");
    case "plan":
      return migrate("plan");
    case "url": {
      const t = target();
      process.stdout.write(t.url + "\n");
      return 0;
    }
    case "psql": {
      const t = target();
      requireDocker();
      const c = new URL(t.url);
      return run(
        "docker",
        ["exec", "-it", "-e", `PGPASSWORD=${decodeURIComponent(c.password)}`, "travel-localdb",
          "psql", "-U", decodeURIComponent(c.username), "-d", c.pathname.slice(1), ...rest.filter((a) => !a.startsWith("--url=") && a !== "--allow-remote")],
      );
    }
    case "test": {
      const t = target();
      console.log(`target: ${t.name} (${t.host})`);
      return run("pnpm", ["--dir", "core", "exec", "vitest", "run", "test/db", ...rest.filter((a) => !a.startsWith("--url=") && a !== "--allow-remote")], {
        env: childEnv(t.url, { TEST_DATABASE_URL: t.url }),
      });
    }
    default:
      console.error(`unknown command: ${cmd} (up | down | reset | migrate | status | plan | psql | test | url)`);
      return 2;
  }
}

try {
  // `reset` and `up` may run before the credentials file exists; resolve lazily after creating it.
  if (cmd === "reset" || cmd === "up" || cmd === "down") ensureLocalCredentials();
  process.exit(main());
} catch (err) {
  console.error(err instanceof TargetError ? err.message : String(err instanceof Error ? err.message : err));
  process.exit(err instanceof TargetError ? 2 : 1);
}
