// The target guard (LOCAL-C; spec 2.3, 6.1, 6.6 item 6). Pure: no environment, no file, no network. The caller (the local target
// resolver, the seed engine's CLI, the migrate wrapper) gathers the inputs, calls guardTarget, and connects only on `allow`.
//
// It decides from a DESCRIPTION of the target (host, port, database, the name the user gave, an optional Neon branch hint), never
// from a URL with credentials: describeTarget() drops the user and the password before anything else sees the URL. No message or
// result ever holds a URL, a user or a password; the only target facts printed are its name, kind and host (spec 6.1 item 5).
//
// The decision table is in docs/v2/features/local-database-and-seed-sync.md, build notes (LOCAL-C), and in the tests.
import {
  LOOPBACK_HOSTS,
  NEON_CHILD_BRANCH_ID,
  NEON_HOST_SUFFIX,
  NEON_POOLER_SUFFIX,
  NEON_PRODUCTION_BRANCH_ID,
  NEON_PRODUCTION_ENDPOINT_ID,
  PRODUCTION_ENV_KEYS,
} from "../config/database.ts";
import { z } from "zod";
import { HOST_RE, checkRehearsal, type RehearsalCode, type RehearsalInput } from "./rehearsal.ts";

/** What a target is. `ci` is a service container on loopback; `child` is the Neon child branch; `production` is Neon production. */
export const TARGET_KINDS = ["local", "ci", "child", "production"] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];
/** The names `--target` accepts besides a URL. A name declares its kind; a URL needs `--target-kind`. */
export const TARGET_NAMES = ["local", "ci", "child", "production", "url"] as const;
export type TargetName = (typeof TARGET_NAMES)[number];

/**
 * The target facts any output (a plan, a drift result, a log line) may carry: the name, the kind and the host. The host must be a
 * bare host name, so a URL, a user or a password cannot ride along.
 */
export const targetFactsSchema = z.strictObject({
  name: z.enum(TARGET_NAMES),
  kind: z.enum(TARGET_KINDS),
  host: z.string().refine((h) => HOST_RE.test(h) || LOOPBACK_HOSTS.includes(h), "a bare host name"),
});
export type TargetFacts = z.infer<typeof targetFactsSchema>;

/** Every database command the guard decides for. */
export const GUARD_OPERATIONS = ["migrate", "seed", "sync", "sync_dry_run", "verify", "reset", "psql"] as const;
export type GuardOperation = (typeof GUARD_OPERATIONS)[number];
/** Operations that only read. On production they need the kind, not the approval. */
export const READ_ONLY_OPERATIONS: readonly GuardOperation[] = ["sync_dry_run", "verify"];
/** Operations that only ever run on loopback (spec 6.1 item 4): a reset drops the volume, a seed expects an empty catalogue. */
export const LOOPBACK_ONLY_OPERATIONS: readonly GuardOperation[] = ["reset", "seed"];

/** The target without credentials. */
export interface TargetDescription {
  /** how `--target` named it: a target name, or `url` for a full connection string */
  name: TargetName;
  /** the host name, lower case; no user, no password, no port */
  host: string;
  port?: number;
  database?: string;
  /** the Neon branch id the resolver resolved, when it knows it */
  branchId?: string;
}

export interface GuardFlags {
  /** `--target-kind` */
  targetKind?: string;
  /** `--approve <sha>` */
  approve?: string;
  /** `--commit <sha>`: the commit whose data is loaded; defaults to HEAD */
  commit?: string;
}

/** The repository as the caller read it (./repoState.ts). `null` when it could not be read (no git): production then refuses. */
export interface RepoState {
  head: string | null;
  clean: boolean | null;
}

export interface GuardInput {
  operation: GuardOperation;
  target: TargetDescription;
  flags?: GuardFlags;
  repo?: RepoState;
  /** hosts known to be production: the hosts of the root env file's DATABASE_URL values (hostsFromEnvText) */
  productionHosts?: readonly string[];
  /** the child rehearsal evidence for HEAD (./repoState.ts readRehearsal) */
  rehearsal?: RehearsalInput;
  now?: Date;
}

export type GuardCode =
  | "E_TARGET_NAME"
  | "E_TARGET_HOST"
  | "E_KIND_UNKNOWN"
  | "E_KIND_MISMATCH"
  | "E_KIND_REQUIRED"
  | "E_LOOPBACK_KIND"
  | "E_LOCAL_NOT_LOOPBACK"
  | "E_PRODUCTION_UNDECLARED"
  | "E_PRODUCTION_HOST"
  | "E_CHILD_NOT_NEON"
  | "E_CHILD_BRANCH"
  | "E_LOOPBACK_ONLY"
  | "E_PRODUCTION_SHELL"
  | "E_APPROVE_REQUIRED"
  | "E_APPROVE_FORMAT"
  | "E_REPO_STATE"
  | "E_APPROVE_MISMATCH"
  | "E_COMMIT_NOT_HEAD"
  | "E_DIRTY_TREE"
  | RehearsalCode;

/** The exit code of every refusal (spec 6.6 item 6): the command exits before it connects. */
export const GUARD_EXIT = 2;

export type GuardDecision =
  | { allow: true; kind: TargetKind; label: string; readOnly: boolean; operation: GuardOperation }
  | { allow: false; code: GuardCode; message: string; exitCode: typeof GUARD_EXIT };

export class GuardRefusal extends Error {
  readonly exitCode = GUARD_EXIT;
  readonly code: GuardCode;
  constructor(code: GuardCode, message: string) {
    super(message);
    this.code = code;
    this.name = "GuardRefusal";
  }
}

const SHA_RE = /^[0-9a-f]{40}$/;

// ---- host facts --------------------------------------------------------------------------------------------------------------------
const norm = (host: string): string => host.trim().toLowerCase();

/** True for this machine. */
export const isLoopbackHost = (host: string): boolean => LOOPBACK_HOSTS.includes(norm(host));
/** True for any Neon host. */
export const isNeonHost = (host: string): boolean => norm(host).endsWith(NEON_HOST_SUFFIX);

/** The Neon endpoint id of a host (`ep-...`), pooled or direct; undefined for a non-Neon host. */
export function endpointIdOf(host: string): string | undefined {
  if (!isNeonHost(host)) return undefined;
  const label = norm(host).split(".")[0] ?? "";
  return label.endsWith(NEON_POOLER_SUFFIX) ? label.slice(0, -NEON_POOLER_SUFFIX.length) : label;
}

/** True when the host is production: the known production endpoint, or the endpoint of a host the root env file names. */
export function isProductionHost(host: string, productionHosts: readonly string[] = []): boolean {
  const ep = endpointIdOf(host);
  if (ep === NEON_PRODUCTION_ENDPOINT_ID) return true;
  for (const p of productionHosts) {
    if (norm(p) === norm(host)) return true;
    const pe = endpointIdOf(p);
    if (pe && pe === ep) return true;
  }
  return false;
}

/** `kind host` for printing: the only target facts any output carries. */
export const targetLabel = (kind: TargetKind, host: string): string => `${kind} ${norm(host)}`;

// ---- URL to description, without credentials ---------------------------------------------------------------------------------------
/**
 * Describe a connection string without its credentials. The URL is parsed once; only host, port and database leave this function.
 * A string that does not parse is refused with a message that does not repeat it.
 */
export function describeTarget(url: string, name: TargetName = "url", branchId?: string): TargetDescription {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new GuardRefusal("E_TARGET_HOST", "the target is not a valid postgres:// URL");
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") {
    throw new GuardRefusal("E_TARGET_HOST", "the target is not a postgres:// URL");
  }
  const host = norm(u.hostname);
  if (!host) throw new GuardRefusal("E_TARGET_HOST", "the target URL has no host");
  const database = decodeURIComponent(u.pathname.replace(/^\//, "")) || undefined;
  return { name, host, ...(u.port ? { port: Number(u.port) } : {}), ...(database ? { database } : {}), ...(branchId ? { branchId } : {}) };
}

/**
 * The hosts of the given keys in an env file's text (`KEY=value`, optional `export`, optional quotes). Only host names are returned;
 * the rest of each value, the user and the password, never leave this function. A value that does not parse is skipped.
 */
export function hostsFromEnvText(text: string, keys: readonly string[] = PRODUCTION_ENV_KEYS): string[] {
  const out = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(raw);
    if (!m || !keys.includes(m[1]!)) continue;
    const value = m[2]!.trim().replace(/^(['"])(.*)\1$/, "$2");
    try {
      const host = norm(new URL(value).hostname);
      if (host && HOST_RE.test(host)) out.add(host);
    } catch {
      // not a URL: nothing to learn, and nothing is echoed
    }
  }
  return [...out].sort();
}

// ---- the decision ------------------------------------------------------------------------------------------------------------------
const refuse = (code: GuardCode, message: string): GuardDecision => ({ allow: false, code, message, exitCode: GUARD_EXIT });

const isKind = (k: string): k is TargetKind => (TARGET_KINDS as readonly string[]).includes(k);

/** The kind the user declared: the target name (unless `url`), or `--target-kind`; both given must agree. */
function declaredKind(name: TargetName, flag: string | undefined): { kind?: TargetKind; error?: GuardDecision } {
  if (flag !== undefined && !isKind(flag)) return { error: refuse("E_KIND_UNKNOWN", `--target-kind must be one of ${TARGET_KINDS.join(", ")}`) };
  const fromName = name === "url" ? undefined : name;
  if (fromName && flag && fromName !== flag) {
    return { error: refuse("E_KIND_MISMATCH", `--target ${fromName} and --target-kind ${flag} disagree`) };
  }
  return { kind: (flag as TargetKind | undefined) ?? fromName };
}

/**
 * Allow or refuse one operation on one target. Order matters and is part of the contract: the target is identified first (so a
 * production host can never pass as anything else), then the operation, then, for writes to production only, the approval, the
 * tree and the rehearsal.
 */
export function guardTarget(input: GuardInput): GuardDecision {
  const { operation, target } = input;
  const flags = input.flags ?? {};
  if (!(TARGET_NAMES as readonly string[]).includes(target.name)) return refuse("E_TARGET_NAME", `--target must be a URL or one of ${TARGET_KINDS.join(", ")}`);
  const host = norm(target.host ?? "");
  if (!host || !(HOST_RE.test(host) || isLoopbackHost(host))) return refuse("E_TARGET_HOST", "the target has no valid host name");

  const declared = declaredKind(target.name, flags.targetKind);
  if (declared.error) return declared.error;
  const kind = declared.kind;
  const production = isProductionHost(host, input.productionHosts) || target.branchId === NEON_PRODUCTION_BRANCH_ID;
  const readOnly = READ_ONLY_OPERATIONS.includes(operation);
  const allow = (k: TargetKind): GuardDecision => ({ allow: true, kind: k, label: targetLabel(k, host), readOnly, operation });

  // 1. loopback: local or ci, every operation
  if (isLoopbackHost(host)) {
    if (kind === "child" || kind === "production") return refuse("E_LOOPBACK_KIND", `a loopback host cannot be the ${kind} target`);
    return allow(kind ?? "local");
  }
  // 2. anything else must say what it is
  if (!kind) return refuse("E_KIND_REQUIRED", `${host} is not loopback: name the target (child or production) or pass --target-kind`);
  // 3. a production host is production, whatever else it is called
  if (production && kind !== "production") return refuse("E_PRODUCTION_UNDECLARED", `${host} is production; it cannot be used as ${kind}`);
  if (kind === "local" || kind === "ci") return refuse("E_LOCAL_NOT_LOOPBACK", `${kind} targets are loopback only; ${host} is not`);
  if (kind === "production" && !production) return refuse("E_PRODUCTION_HOST", `${host} is not the known production endpoint`);
  if (kind === "child") {
    if (!isNeonHost(host)) return refuse("E_CHILD_NOT_NEON", `the child target is a Neon branch; ${host} is not a Neon host`);
    if (target.branchId !== undefined && target.branchId !== NEON_CHILD_BRANCH_ID) return refuse("E_CHILD_BRANCH", "the branch is not the child branch");
  }
  if (kind === "production" && target.branchId !== undefined && target.branchId !== NEON_PRODUCTION_BRANCH_ID) {
    return refuse("E_PRODUCTION_HOST", "the branch is not the production branch");
  }
  // 4. operations that never leave loopback
  if (LOOPBACK_ONLY_OPERATIONS.includes(operation)) return refuse("E_LOOPBACK_ONLY", `${operation} runs on a loopback target only; use sync for ${kind}`);
  if (kind === "child") return allow("child");

  // 5. production
  if (operation === "psql") return refuse("E_PRODUCTION_SHELL", "no interactive shell on production");
  if (readOnly) return allow("production");
  if (!flags.approve) return refuse("E_APPROVE_REQUIRED", `${operation} on production needs --approve <sha of HEAD>`);
  const approve = flags.approve.trim().toLowerCase();
  if (!SHA_RE.test(approve)) return refuse("E_APPROVE_FORMAT", "--approve takes the full 40-character commit sha");
  const repo = input.repo;
  const head = repo?.head?.toLowerCase() ?? null;
  if (!repo || !head || !SHA_RE.test(head) || repo.clean === null || repo.clean === undefined) {
    return refuse("E_REPO_STATE", "the repository state (HEAD, working tree) could not be read");
  }
  if (approve !== head) return refuse("E_APPROVE_MISMATCH", "--approve is not HEAD; approve the commit that is checked out");
  if (flags.commit !== undefined && flags.commit.trim().toLowerCase() !== head) {
    return refuse("E_COMMIT_NOT_HEAD", "on production --commit must be HEAD; check the commit out, rehearse it, then approve it");
  }
  if (!repo.clean) return refuse("E_DIRTY_TREE", "the working tree is not clean; production loads committed files only");
  const verdict = checkRehearsal(input.rehearsal, head, input.now ?? new Date(), (h) => isProductionHost(h, input.productionHosts));
  if (!verdict.ok) return refuse(verdict.code, verdict.message);
  return allow("production");
}

/** guardTarget, throwing GuardRefusal on a refusal. */
export function assertTarget(input: GuardInput): Extract<GuardDecision, { allow: true }> {
  const d = guardTarget(input);
  if (!d.allow) throw new GuardRefusal(d.code, d.message);
  return d;
}

/**
 * Decide, then connect only on allow. The one way the engine and the scripts open a database: `connect` is never called for a
 * refused target, so a refusal is always before any connection.
 */
export async function guardedConnect<T>(input: GuardInput, connect: () => Promise<T>): Promise<{ decision: Extract<GuardDecision, { allow: true }>; connection: T }> {
  const decision = assertTarget(input);
  return { decision, connection: await connect() };
}
