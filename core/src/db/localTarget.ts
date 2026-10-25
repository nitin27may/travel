// Target resolver for the local-database scripts (`pnpm db:*`). LOCAL-1, on the LOCAL-C guard since LOCAL-2.
//
// The root `.env.local` holds PRODUCTION values and `core/bin/db-migrate.ts` falls back to DATABASE_URL, so
// the db:* scripts never read DATABASE_URL, DATABASE_URL_UNPOOLED or any env file of the repo for a connection. They resolve a
// target here. The DECISION (which host is local, child or production; what a production write needs) is the one table in
// core/src/seed/guard.ts (docs/v2/features/local-database-and-seed-sync.md, build notes LOCAL-C); this module only turns a name or
// a URL into a description without credentials, asks the guard, and returns the URL on `allow`.
//
// Order: an explicit URL (flag), then LOCAL_DATABASE_URL, then the local default built from the generated
// password file (outside the repo, mode 600). Errors name the host only: never the URL, user or password.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { LOCAL_DB_PORT, NEON_PRODUCTION_BRANCH_ID, NEON_PRODUCTION_ENDPOINT_ID } from "../config/database.ts";
import {
  describeTarget,
  GuardRefusal,
  hostsFromEnvText,
  isLoopbackHost,
  isProductionHost as guardIsProductionHost,
  assertTarget,
  type GuardFlags,
  type GuardOperation,
  type RehearsalInput,
  type RepoState,
  type TargetKind,
} from "../seed/index.ts";

/** The production compute endpoint of the Neon project (damp-queen-64719841). */
export const PRODUCTION_ENDPOINT = NEON_PRODUCTION_ENDPOINT_ID;
/** The production branch id; refused when it appears in a URL or host. */
export const PRODUCTION_BRANCH = NEON_PRODUCTION_BRANCH_ID;

export const LOCAL_PORT = LOCAL_DB_PORT;
export const LOCAL_OWNER = "neondb_owner";
export const LOCAL_DATABASE = "neondb";

export class TargetError extends Error {
  readonly code = "E_TARGET";
  /** the guard's code when the guard refused (E_PRODUCTION_UNDECLARED, E_APPROVE_REQUIRED, ...) */
  readonly guardCode?: string;
  constructor(message: string, guardCode?: string) {
    super(message);
    this.guardCode = guardCode;
  }
}

export interface ResolveOptions {
  /** `--url=` value. */
  url?: string;
  /** Explicit approval to use a non-loopback host that is not production (a Neon child branch). */
  allowRemote?: boolean;
  /** What the command does; the guard decides per operation (default `migrate`, the strictest read-write one). */
  operation?: GuardOperation;
  /** `--approve`, `--commit`, `--target-kind`: forwarded to the guard unchanged. */
  flags?: GuardFlags;
  /** The repository state and rehearsal evidence the guard needs for a production write. Absent: such a write is refused. */
  repo?: RepoState;
  rehearsal?: RehearsalInput;
  /** Extra production hosts (the root env file's, read by `readProductionHosts`); the ambient DATABASE_URL* hosts always count. */
  productionHosts?: readonly string[];
  env?: Record<string, string | undefined>;
  /** Injected for tests. */
  readPasswordFile?: (path: string) => string | undefined;
}

export interface ResolvedTarget {
  url: string;
  /** host only, safe to print */
  host: string;
  name: "local" | "explicit";
  loopback: boolean;
  /** what the guard decided: `local`, `ci` or `child` (production only with its full approval) */
  kind: TargetKind;
  /** `kind host`, the only target facts any output may carry */
  label: string;
}

export function passwordFilePath(env: Record<string, string | undefined> = process.env): string {
  return env.LOCAL_DB_ENV_FILE ?? join(homedir(), ".config", "travel", "local-db.env");
}

function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Read the generated credentials, or undefined when `db:up` has not created them yet. */
export function readLocalCredentials(path = passwordFilePath()): Record<string, string> | undefined {
  if (!existsSync(path)) return undefined;
  return parseEnvFile(readFileSync(path, "utf8"));
}

/** Create the credentials file on first use (mode 600, directory 700). Returns what is in it. */
export function ensureLocalCredentials(path = passwordFilePath()): Record<string, string> {
  const have = readLocalCredentials(path);
  if (have?.LOCAL_DB_PASSWORD && have.LOCAL_DB_SUPERUSER_PASSWORD) return have;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const creds = {
    LOCAL_DB_PASSWORD: randomBytes(24).toString("base64url"),
    LOCAL_DB_SUPERUSER_PASSWORD: randomBytes(24).toString("base64url"),
    LOCAL_DB_PORT: String(LOCAL_PORT),
  };
  writeFileSync(path, Object.entries(creds).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
  return creds;
}

export function hostOf(url: string): string {
  try {
    return describeTarget(url).host;
  } catch {
    throw new TargetError("the database URL is not a valid URL");
  }
}

/** The hosts of the ambient DATABASE_URL* values (the shell has the root .env.local injected by with-root-env.mjs): production-shaped. */
function ambientHosts(env: Record<string, string | undefined>): string[] {
  const text = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"].map((k) => `${k}=${env[k] ?? ""}`).join("\n");
  return hostsFromEnvText(text);
}

export { isLoopbackHost };

export function isProductionHost(host: string, productionHosts: readonly string[] = []): boolean {
  return guardIsProductionHost(host, productionHosts);
}

/**
 * Apply the guard to a URL. Throws TargetError (host only in the message). The kind is declared here, never trusted from the URL:
 * a loopback host is local, a production host is declared `production` (so the guard demands its approvals and a green child
 * rehearsal), any other remote host is declared `child` and must be a Neon host on the child branch.
 */
export function checkUrl(url: string, opts: ResolveOptions = {}, name: "local" | "explicit" = "explicit"): ResolvedTarget {
  const env = opts.env ?? process.env;
  const hosts = [...ambientHosts(env), ...(opts.productionHosts ?? [])];
  const description = describeTargetOrRefuse(url, name === "local" ? "local" : "url");
  const loopback = isLoopbackHost(description.host);
  const production = !loopback && guardIsProductionHost(description.host, hosts);
  const declared: TargetKind | undefined = loopback ? undefined : production ? "production" : "child";
  let decision;
  try {
    decision = assertTarget({
      operation: opts.operation ?? "migrate",
      target: description,
      flags: { ...(opts.flags ?? {}), ...(declared ? { targetKind: declared } : {}) },
      repo: opts.repo,
      productionHosts: hosts,
      rehearsal: opts.rehearsal,
    });
  } catch (err) {
    if (err instanceof GuardRefusal) throw new TargetError(`refusing ${description.host}: ${err.message}`, err.code);
    throw err;
  }
  if (!loopback && !opts.allowRemote) {
    throw new TargetError(`refusing a non-loopback host (${description.host}); pass --allow-remote to use it`);
  }
  return { url, host: description.host, name, loopback, kind: decision.kind, label: decision.label };
}

function describeTargetOrRefuse(url: string, name: "local" | "url") {
  try {
    return describeTarget(url, name);
  } catch (err) {
    if (err instanceof GuardRefusal) throw new TargetError(err.message, err.code);
    throw err;
  }
}

/** Resolve the target for a db:* command. Never reads DATABASE_URL or a repo env file for a connection. */
export function resolveTarget(opts: ResolveOptions = {}): ResolvedTarget {
  const env = opts.env ?? process.env;
  const explicit = opts.url ?? env.LOCAL_DATABASE_URL;
  if (explicit) return checkUrl(explicit, opts);
  const reader = opts.readPasswordFile ?? ((p: string) => (existsSync(p) ? readFileSync(p, "utf8") : undefined));
  const text = reader(passwordFilePath(env));
  const creds = text ? parseEnvFile(text) : undefined;
  if (!creds?.LOCAL_DB_PASSWORD) {
    throw new TargetError("no local database credentials yet; run `pnpm db:up` first");
  }
  const port = creds.LOCAL_DB_PORT ?? String(LOCAL_PORT);
  const url = `postgres://${LOCAL_OWNER}:${encodeURIComponent(creds.LOCAL_DB_PASSWORD)}@127.0.0.1:${port}/${LOCAL_DATABASE}`;
  return checkUrl(url, { ...opts, env }, "local");
}

/** Destructive commands (reset) run on a loopback host only, whatever else is approved. */
export function assertLoopback(t: ResolvedTarget): void {
  if (!t.loopback) throw new TargetError(`this command only runs against a loopback host (got ${t.host})`);
}

/** A copy of the environment with every ambient database URL removed, for child processes. */
export function scrubbedEnv(base: Record<string, string | undefined> = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined) continue;
    if (/^(DATABASE_URL|DATABASE_URL_UNPOOLED|TEST_DATABASE_URL|LOCAL_DATABASE_URL|PG[A-Z]+)$/.test(k)) continue;
    out[k] = v;
  }
  return out;
}
