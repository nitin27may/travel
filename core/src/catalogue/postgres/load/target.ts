// Which database a seed command talks to (LOCAL-2; spec 2.3 and 6.1). Every path ends in the LOCAL-C guard: the local resolver
// (core/src/db/localTarget.ts) for a loopback or pasted URL, and the guard directly for the names `child` and `production`, which
// have no connection source until LOCAL-5 wires `neon connection-string`. Nothing here reads DATABASE_URL or a repo env file for a
// connection, and no message holds a URL, user or password.
import { NEON_HOST_SUFFIX, NEON_PRODUCTION_ENDPOINT_ID } from "../../../config/database.ts";
import { checkUrl, resolveTarget, TargetError, type ResolveOptions } from "../../../db/localTarget.ts";
import {
  assertTarget, describeTarget, GuardRefusal, TARGET_KINDS, type GuardFlags, type GuardOperation, type RehearsalInput, type RepoState, type TargetFacts,
  type TargetKind, type TargetName,
} from "../../../seed/index.ts";

export interface SeedTarget {
  url: string;
  facts: TargetFacts;
  loopback: boolean;
}

export interface SeedTargetRequest {
  /** `--target`: local (default), ci, child, production, or a postgres:// URL */
  name?: string;
  /** `--url` */
  url?: string;
  allowRemote?: boolean;
  operation: GuardOperation;
  flags?: GuardFlags;
  repo?: RepoState;
  rehearsal?: RehearsalInput;
  productionHosts?: readonly string[];
  env?: Record<string, string | undefined>;
  readPasswordFile?: (path: string) => string | undefined;
}

export class TargetUnavailable extends Error {
  readonly code = "E_TARGET_UNAVAILABLE";
}

const isUrl = (s: string): boolean => /^postgres(ql)?:\/\//i.test(s);

export function resolveSeedTarget(req: SeedTargetRequest): SeedTarget {
  const name = req.name === "url" && req.url ? req.url : (req.name ?? "local");
  const env = req.env ?? process.env;
  const base: ResolveOptions = {
    operation: req.operation, flags: req.flags, repo: req.repo, rehearsal: req.rehearsal, productionHosts: req.productionHosts,
    allowRemote: req.allowRemote, env, readPasswordFile: req.readPasswordFile,
  };
  const done = (t: { url: string; host: string; kind: TargetKind; loopback: boolean }, as: TargetName): SeedTarget => ({
    url: t.url, loopback: t.loopback, facts: { name: as, kind: t.kind, host: t.host },
  });

  if (name === "local") {
    const t = resolveTarget({ ...base, url: req.url });
    if (!t.loopback) throw new TargetError(`the local target is loopback only; ${t.host} is not`, "E_LOCAL_NOT_LOOPBACK");
    return done(t, "local");
  }
  if (name === "ci") {
    const url = req.url ?? env.LOCAL_DATABASE_URL;
    if (!url) throw new TargetError("the ci target needs --url or LOCAL_DATABASE_URL (a service container on 127.0.0.1)");
    const t = checkUrl(url, { ...base, flags: { ...(req.flags ?? {}), targetKind: "ci" } });
    if (!t.loopback) throw new TargetError(`the ci target is loopback only; ${t.host} is not`, "E_LOCAL_NOT_LOOPBACK");
    return done(t, "ci");
  }
  if (name === "child" || name === "production") {
    if (req.url) {
      const t = checkUrl(req.url, { ...base, allowRemote: true });
      if (t.kind !== name) throw new TargetError(`--target ${name} was given a URL whose host is ${t.kind}`, "E_KIND_MISMATCH");
      return done(t, name);
    }
    // No connection source yet: the guard still decides first, so a production request fails on its approvals, not on a missing URL.
    const host = name === "production" ? `${NEON_PRODUCTION_ENDPOINT_ID}${NEON_HOST_SUFFIX}` : `child${NEON_HOST_SUFFIX}`;
    try {
      assertTarget({
        operation: req.operation, target: describeTarget(`postgres://${host}/neondb`, name), flags: req.flags, repo: req.repo,
        productionHosts: req.productionHosts, rehearsal: req.rehearsal,
      });
    } catch (err) {
      if (err instanceof GuardRefusal) throw new TargetError(`refusing ${name}: ${err.message}`, err.code);
      throw err;
    }
    throw new TargetUnavailable(`the ${name} target is allowed for this request, but its connection is wired by LOCAL-5; use --url for now`);
  }
  if (isUrl(name)) {
    const t = checkUrl(name, { ...base, flags: { ...(req.flags ?? {}) } });
    return done(t, "url");
  }
  throw new TargetError(`--target must be a URL or one of ${TARGET_KINDS.join(", ")}`, "E_TARGET_NAME");
}
