// Target resolver for the local-database scripts (`pnpm db:*`). LOCAL-1.
//
// The root `.env.local` holds PRODUCTION values and `core/bin/db-migrate.ts` falls back to DATABASE_URL, so
// the db:* scripts never read DATABASE_URL, DATABASE_URL_UNPOOLED or any env file of the repo. They resolve a
// target here, and this module refuses the production host unless an explicit approval is given.
//
// Order: an explicit URL (flag), then LOCAL_DATABASE_URL, then the local default built from the generated
// password file (outside the repo, mode 600). Errors name the host only: never the URL, user or password.
// LOCAL-C's full guard (child/production targets, --approve <sha>) extends this; it does not replace it.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** The production compute endpoint of the Neon project (damp-queen-64719841). */
export const PRODUCTION_ENDPOINT = "ep-quiet-leaf-b4oz2a4v";
/** The production branch id; refused when it appears in a URL or host. */
export const PRODUCTION_BRANCH = "br-soft-glade-b4mkqyvd";

export const LOCAL_PORT = 54329;
export const LOCAL_OWNER = "neondb_owner";
export const LOCAL_DATABASE = "neondb";

export class TargetError extends Error {
  readonly code = "E_TARGET";
}

export interface ResolveOptions {
  /** `--url=` value. */
  url?: string;
  /** Explicit approval to use a production URL. Never set by a db:* script by default. */
  approveProduction?: boolean;
  /** Explicit approval to use a non-loopback host that is not production. */
  allowRemote?: boolean;
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
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

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
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new TargetError("the database URL is not a valid URL");
  }
  return u.hostname.toLowerCase();
}

export function isProductionHost(host: string, url = ""): boolean {
  const h = host.toLowerCase();
  return (
    h.includes(PRODUCTION_ENDPOINT) ||
    h.includes(PRODUCTION_BRANCH) ||
    url.includes(PRODUCTION_ENDPOINT) ||
    url.includes(PRODUCTION_BRANCH)
  );
}

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK.has(host.toLowerCase());
}

/** Apply the guard to a URL. Throws TargetError (host only in the message). */
export function checkUrl(url: string, opts: ResolveOptions = {}): ResolvedTarget {
  const host = hostOf(url);
  const env = opts.env ?? process.env;
  // A URL whose host equals the host of an ambient DATABASE_URL* value is production-shaped by construction:
  // the root .env.local is injected into the shell by with-root-env.mjs.
  const ambient = [env.DATABASE_URL, env.DATABASE_URL_UNPOOLED]
    .filter((v): v is string => !!v)
    .map((v) => {
      try {
        return new URL(v).hostname.toLowerCase();
      } catch {
        return "";
      }
    });
  const loopback = isLoopbackHost(host);
  const production = isProductionHost(host, url) || (!loopback && ambient.includes(host));
  if (production && !opts.approveProduction) {
    throw new TargetError(
      `refusing the production database (host ${host}). The local db:* scripts only target the local container; ` +
        `production needs an explicit approval and is not available from these scripts.`,
    );
  }
  if (!loopback && !production && !opts.allowRemote) {
    throw new TargetError(`refusing a non-loopback host (${host}); pass --allow-remote to use it`);
  }
  return { url, host, name: "explicit", loopback };
}

/** Resolve the target for a db:* command. Never reads DATABASE_URL or a repo env file. */
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
  return { url, host: "127.0.0.1", name: "local", loopback: true };
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
