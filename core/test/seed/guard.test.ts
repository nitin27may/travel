// The target guard: every row of the decision table, the rehearsal evidence, and the promise that no output carries a credential.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NEON_CHILD_BRANCH_ID, NEON_PRODUCTION_BRANCH_ID, REHEARSAL_EVIDENCE_DIR, REHEARSAL_MAX_AGE_HOURS } from "../../src/config/database.ts";
import { SEED_CONTRACT_VERSION } from "../../src/seed/contract.ts";
import {
  GUARD_EXIT,
  GUARD_OPERATIONS,
  GuardRefusal,
  TARGET_KINDS,
  assertTarget,
  describeTarget,
  endpointIdOf,
  guardTarget,
  guardedConnect,
  hostsFromEnvText,
  isProductionHost,
  type GuardDecision,
  type GuardInput,
  type GuardOperation,
} from "../../src/seed/guard.ts";
import { readProductionHosts, readRehearsal, readRepoState } from "../../src/seed/io.ts";
import { checkRehearsal, rehearsalEvidenceText, type RehearsalEvidence } from "../../src/seed/rehearsal.ts";

const SENTINEL = "S3ntinel-PW-9f2c";
const USER = "neondb_owner";
const PROD = "ep-quiet-leaf-b4oz2a4v.c-2.us-east-2.aws.neon.tech";
const PROD_POOLED = "ep-quiet-leaf-b4oz2a4v-pooler.c-2.us-east-2.aws.neon.tech";
const CHILD = "ep-child-sample-a1b2c3d4.c-2.us-east-2.aws.neon.tech";
const HEAD = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "fedcba9876543210fedcba9876543210fedcba98";
const NOW = new Date("2026-10-25T12:00:00Z");
const url = (host: string, port = 5432): string => `postgres://${USER}:${SENTINEL}@${host}:${port}/neondb?sslmode=require`;

function evidence(over: Partial<RehearsalEvidence> = {}): RehearsalEvidence {
  return {
    schema: "seed-rehearsal/1",
    commit: HEAD,
    contract_version: SEED_CONTRACT_VERSION,
    target: { kind: "child", branch_id: NEON_CHILD_BRANCH_ID, host: CHILD },
    started_at: "2026-10-25T10:00:00Z",
    finished_at: "2026-10-25T10:30:00Z",
    steps: ["reset", "delete_sessions", "migrate", "sync_dry_run", "sync", "verify", "db_tests"].map((name) => ({ name: name as never, exit: name === "sync_dry_run" ? 3 : 0, skipped: 0 })),
    plan_totals: { insert: 10, update: 0, retire: 0, delete: 0, unchanged: 0, retained: 0 },
    verify: { ok: true, tables: 7, differing: 0 },
    load_run_id: null,
    status: "green",
    ...over,
  };
}

/** A production write with everything in order; each test breaks one thing. */
function prodWrite(over: Partial<GuardInput> = {}, op: GuardOperation = "sync"): GuardInput {
  return {
    operation: op,
    target: describeTarget(url(PROD), "production"),
    flags: { approve: HEAD },
    repo: { head: HEAD, clean: true },
    rehearsal: { found: true, value: evidence() },
    now: NOW,
    ...over,
  };
}

const code = (d: GuardDecision): string => (d.allow ? `allow:${d.kind}` : d.code);
const decide = (op: GuardOperation, u: string, name: GuardInput["target"]["name"] = "url", flags: GuardInput["flags"] = {}, extra: Partial<GuardInput> = {}): string =>
  code(guardTarget({ operation: op, target: describeTarget(u, name), flags, now: NOW, ...extra }));

describe("describeTarget and env hosts: credentials never leave", () => {
  it("keeps host, port and database; drops user and password", () => {
    const t = describeTarget(url(PROD_POOLED), "production");
    expect(t).toEqual({ name: "production", host: PROD_POOLED, port: 5432, database: "neondb" });
    expect(JSON.stringify(t)).not.toContain(SENTINEL);
    expect(JSON.stringify(t)).not.toContain(USER);
  });

  it("refuses a string that is not a postgres URL without repeating it", () => {
    for (const bad of [`not a url ${SENTINEL}`, `https://${USER}:${SENTINEL}@example.com/x`, `postgres://${USER}:${SENTINEL}@/db`]) {
      try {
        describeTarget(bad);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(GuardRefusal);
        expect((e as GuardRefusal).code).toBe("E_TARGET_HOST");
        expect((e as Error).message).not.toContain(SENTINEL);
        expect((e as Error).message).not.toContain(USER);
      }
    }
  });

  it("reads only hosts from env text", () => {
    const text = [
      "# production values",
      `DATABASE_URL="${url(PROD_POOLED)}"`,
      `export DATABASE_URL_UNPOOLED=${url(PROD)}`,
      `NEON_AUTH_COOKIE_SECRET=${SENTINEL}`,
      "DATABASE_URL_BROKEN=nonsense",
    ].join("\n");
    const hosts = hostsFromEnvText(text);
    expect(hosts).toEqual([PROD, PROD_POOLED].sort());
    expect(JSON.stringify(hosts)).not.toContain(SENTINEL);
  });

  it("knows the production endpoint pooled or direct, and a host from the env file", () => {
    expect(endpointIdOf(PROD_POOLED)).toBe("ep-quiet-leaf-b4oz2a4v");
    expect(isProductionHost(PROD)).toBe(true);
    expect(isProductionHost(PROD_POOLED.toUpperCase())).toBe(true);
    expect(isProductionHost(CHILD)).toBe(false);
    const moved = "ep-new-prod-9z9z9z9z-pooler.c-2.us-east-2.aws.neon.tech";
    expect(isProductionHost(moved.replace("-pooler", ""), [moved])).toBe(true);
    expect(endpointIdOf("127.0.0.1")).toBeUndefined();
  });
});

describe("decision table: loopback", () => {
  it("allows every operation on loopback as local; ci when declared", () => {
    for (const op of GUARD_OPERATIONS) {
      expect(decide(op, url("127.0.0.1", 54329), "local")).toBe("allow:local");
      expect(decide(op, url("localhost", 54329))).toBe("allow:local");
      expect(decide(op, url("[::1]", 54329))).toBe("allow:local");
      expect(decide(op, url("127.0.0.1", 54329), "ci")).toBe("allow:ci");
      expect(decide(op, url("127.0.0.1", 54329), "url", { targetKind: "ci" })).toBe("allow:ci");
    }
  });

  it("refuses a loopback host named child or production", () => {
    expect(decide("sync", url("127.0.0.1"), "child")).toBe("E_LOOPBACK_KIND");
    expect(decide("sync", url("127.0.0.1"), "url", { targetKind: "production" })).toBe("E_LOOPBACK_KIND");
  });
});

describe("decision table: naming the target", () => {
  it("refuses an unknown kind or a name and kind that disagree", () => {
    expect(decide("verify", url(CHILD), "url", { targetKind: "staging" })).toBe("E_KIND_UNKNOWN");
    expect(decide("verify", url(CHILD), "child", { targetKind: "production" })).toBe("E_KIND_MISMATCH");
    expect(decide("verify", url(CHILD), "child", { targetKind: "child" })).toBe("allow:child");
  });

  it("refuses an unknown target name and a description with no usable host", () => {
    expect(code(guardTarget({ operation: "verify", target: { name: "staging" as never, host: CHILD } }))).toBe("E_TARGET_NAME");
    expect(code(guardTarget({ operation: "verify", target: { name: "url", host: "" } }))).toBe("E_TARGET_HOST");
    expect(code(guardTarget({ operation: "verify", target: { name: "url", host: `${USER}:${SENTINEL}@h` } }))).toBe("E_TARGET_HOST");
  });

  it("a non-loopback URL needs a kind; a .neon.tech URL passed as a plain URL fails", () => {
    for (const op of GUARD_OPERATIONS) {
      expect(decide(op, url(CHILD))).toBe("E_KIND_REQUIRED");
      expect(decide(op, url(PROD))).toBe("E_KIND_REQUIRED");
      expect(decide(op, url("db.example.com"))).toBe("E_KIND_REQUIRED");
    }
  });

  it("local and ci are loopback only", () => {
    expect(decide("verify", url("db.example.com"), "url", { targetKind: "local" })).toBe("E_LOCAL_NOT_LOOPBACK");
    expect(decide("verify", url(CHILD), "ci")).toBe("E_LOCAL_NOT_LOOPBACK");
  });
});

describe("decision table: a production host is refused under any kind but production", () => {
  it("for every operation and every other kind, pooled or direct, by endpoint, env host or branch hint", () => {
    const envHost = "ep-renamed-prod-0000aaaa.c-2.us-east-2.aws.neon.tech";
    for (const op of GUARD_OPERATIONS) {
      for (const kind of TARGET_KINDS.filter((k) => k !== "production")) {
        for (const host of [PROD, PROD_POOLED]) {
          expect(decide(op, url(host), "url", { targetKind: kind }), `${op} ${kind} ${host}`).toBe("E_PRODUCTION_UNDECLARED");
        }
        expect(decide(op, url(envHost), "url", { targetKind: kind }, { productionHosts: [envHost] })).toBe("E_PRODUCTION_UNDECLARED");
        const hinted = guardTarget({ operation: op, target: { ...describeTarget(url(CHILD), "url"), branchId: NEON_PRODUCTION_BRANCH_ID }, flags: { targetKind: kind } });
        expect(code(hinted)).toBe("E_PRODUCTION_UNDECLARED");
      }
    }
  });

  it("refuses production for a host that is not the known production endpoint", () => {
    expect(decide("verify", url(CHILD), "production")).toBe("E_PRODUCTION_HOST");
    expect(decide("verify", url("db.example.com"), "url", { targetKind: "production" })).toBe("E_PRODUCTION_HOST");
    const wrongBranch = guardTarget({ operation: "verify", target: { ...describeTarget(url(PROD), "production"), branchId: NEON_CHILD_BRANCH_ID } });
    expect(code(wrongBranch)).toBe("E_PRODUCTION_HOST");
  });
});

describe("decision table: child", () => {
  it("allows migrate, sync, dry run, verify and psql without approval", () => {
    for (const op of ["migrate", "sync", "sync_dry_run", "verify", "psql"] as const) expect(decide(op, url(CHILD), "child")).toBe("allow:child");
    const hinted = guardTarget({ operation: "sync", target: { ...describeTarget(url(CHILD), "child"), branchId: NEON_CHILD_BRANCH_ID } });
    expect(code(hinted)).toBe("allow:child");
  });

  it("refuses reset and seed (loopback only), a non-Neon child and another branch", () => {
    expect(decide("reset", url(CHILD), "child")).toBe("E_LOOPBACK_ONLY");
    expect(decide("seed", url(CHILD), "child")).toBe("E_LOOPBACK_ONLY");
    expect(decide("sync", url("db.example.com"), "child")).toBe("E_CHILD_NOT_NEON");
    const other = guardTarget({ operation: "sync", target: { ...describeTarget(url(CHILD), "child"), branchId: "br-some-other-branch" } });
    expect(code(other)).toBe("E_CHILD_BRANCH");
  });
});

describe("decision table: production", () => {
  it("allows the read-only dry run and verify with no approval", () => {
    expect(decide("sync_dry_run", url(PROD), "production")).toBe("allow:production");
    expect(decide("verify", url(PROD_POOLED), "url", { targetKind: "production" })).toBe("allow:production");
  });

  it("refuses psql, reset and seed outright", () => {
    expect(code(guardTarget(prodWrite({}, "psql")))).toBe("E_PRODUCTION_SHELL");
    expect(code(guardTarget(prodWrite({}, "reset")))).toBe("E_LOOPBACK_ONLY");
    expect(code(guardTarget(prodWrite({}, "seed")))).toBe("E_LOOPBACK_ONLY");
  });

  it("allows migrate and sync with approve = HEAD, a clean tree and a green child rehearsal of HEAD", () => {
    expect(code(guardTarget(prodWrite()))).toBe("allow:production");
    expect(code(guardTarget(prodWrite({}, "migrate")))).toBe("allow:production");
    expect(code(guardTarget(prodWrite({ flags: { approve: HEAD.toUpperCase(), commit: HEAD } })))).toBe("allow:production");
  });

  it("refuses each missing condition with its own code", () => {
    const cases: [Partial<GuardInput>, string][] = [
      [{ flags: {} }, "E_APPROVE_REQUIRED"],
      [{ flags: { approve: HEAD.slice(0, 12) } }, "E_APPROVE_FORMAT"],
      [{ repo: { head: null, clean: true } }, "E_REPO_STATE"],
      [{ repo: { head: HEAD, clean: null } }, "E_REPO_STATE"],
      [{ repo: undefined }, "E_REPO_STATE"],
      [{ flags: { approve: OTHER } }, "E_APPROVE_MISMATCH"],
      [{ flags: { approve: HEAD, commit: OTHER } }, "E_COMMIT_NOT_HEAD"],
      [{ repo: { head: HEAD, clean: false } }, "E_DIRTY_TREE"],
      [{ rehearsal: { found: false } }, "E_REHEARSAL_MISSING"],
      [{ rehearsal: undefined }, "E_REHEARSAL_MISSING"],
      [{ rehearsal: { found: true, value: undefined } }, "E_REHEARSAL_INVALID"],
      [{ rehearsal: { found: true, value: { ...evidence(), extra: 1 } } }, "E_REHEARSAL_INVALID"],
      [{ rehearsal: { found: true, value: evidence({ contract_version: SEED_CONTRACT_VERSION + 1 }) } }, "E_REHEARSAL_CONTRACT"],
      [{ rehearsal: { found: true, value: evidence({ commit: OTHER }) } }, "E_REHEARSAL_COMMIT"],
      [{ rehearsal: { found: true, value: evidence({ target: { kind: "child", branch_id: NEON_PRODUCTION_BRANCH_ID, host: CHILD } }) } }, "E_REHEARSAL_TARGET"],
      [{ rehearsal: { found: true, value: evidence({ target: { kind: "child", branch_id: NEON_CHILD_BRANCH_ID, host: PROD } }) } }, "E_REHEARSAL_TARGET"],
      [{ rehearsal: { found: true, value: evidence({ status: "red" }) } }, "E_REHEARSAL_FAILED"],
      [{ rehearsal: { found: true, value: evidence({ verify: { ok: false, tables: 7, differing: 1 } }) } }, "E_REHEARSAL_FAILED"],
      [{ rehearsal: { found: true, value: evidence({ steps: evidence().steps.filter((s) => s.name !== "delete_sessions") }) } }, "E_REHEARSAL_FAILED"],
      [{ rehearsal: { found: true, value: evidence({ steps: evidence().steps.map((s) => (s.name === "db_tests" ? { ...s, skipped: 3 } : s)) }) } }, "E_REHEARSAL_FAILED"],
      [{ rehearsal: { found: true, value: evidence({ steps: evidence().steps.map((s) => (s.name === "migrate" ? { ...s, exit: 1 } : s)) }) } }, "E_REHEARSAL_FAILED"],
      [{ now: new Date(Date.parse("2026-10-25T10:30:00Z") + (REHEARSAL_MAX_AGE_HOURS + 1) * 3_600_000) }, "E_REHEARSAL_STALE"],
      [{ rehearsal: { found: true, value: evidence({ finished_at: "2026-10-26T10:30:00Z" }) } }, "E_REHEARSAL_INVALID"],
      [{ rehearsal: { found: true, value: evidence({ started_at: "2026-10-25T11:00:00Z" }) } }, "E_REHEARSAL_INVALID"],
    ];
    for (const [over, want] of cases) expect(code(guardTarget(prodWrite(over))), want).toBe(want);
  });

  it("a rehearsal file cannot carry a connection string", () => {
    const withUrl = evidence({ target: { kind: "child", branch_id: NEON_CHILD_BRANCH_ID, host: `${USER}:${SENTINEL}@${CHILD}` } });
    const v = checkRehearsal({ found: true, value: withUrl }, HEAD, NOW, () => false);
    expect(v.ok).toBe(false);
    expect(JSON.stringify(v)).not.toContain(SENTINEL);
    expect(() => rehearsalEvidenceText(withUrl)).toThrow();
    expect(rehearsalEvidenceText(evidence())).toMatch(/^\{\n {2}"schema": "seed-rehearsal\/1"/);
  });
});

describe("refusals happen before any connection, and say nothing secret", () => {
  it("never calls connect for a refused target", async () => {
    let calls = 0;
    const connect = async (): Promise<string> => {
      calls++;
      throw new Error("connect must not be called");
    };
    for (const input of [
      prodWrite({ flags: {} }),
      prodWrite({ repo: { head: HEAD, clean: false } }),
      prodWrite({ flags: { approve: OTHER } }),
      prodWrite({ rehearsal: { found: false } }),
      { operation: "sync" as const, target: describeTarget(url(PROD)), now: NOW },
    ]) {
      await expect(guardedConnect(input, connect)).rejects.toMatchObject({ name: "GuardRefusal", exitCode: GUARD_EXIT });
    }
    expect(calls).toBe(0);
    const ok = await guardedConnect({ operation: "verify", target: describeTarget(url("127.0.0.1", 54329), "local") }, async () => "client");
    expect(ok).toEqual({ decision: { allow: true, kind: "local", label: "local 127.0.0.1", readOnly: true, operation: "verify" }, connection: "client" });
  });

  it("no decision, refusal message or thrown error contains the URL, the user or the password", () => {
    const outputs: string[] = [];
    const hosts = [PROD, PROD_POOLED, CHILD, "127.0.0.1", "db.example.com"];
    const flagSets: GuardInput["flags"][] = [{}, { targetKind: "child" }, { targetKind: "production", approve: HEAD }, { targetKind: "local" }];
    for (const op of GUARD_OPERATIONS) {
      for (const h of hosts) {
        for (const name of ["url", "local", "child", "production"] as const) {
          for (const flags of flagSets) {
            const input: GuardInput = { operation: op, target: describeTarget(url(h), name), flags, repo: { head: HEAD, clean: false }, now: NOW };
            outputs.push(JSON.stringify(guardTarget(input)));
            try {
              assertTarget(input);
            } catch (e) {
              outputs.push(String((e as Error).message), JSON.stringify(e));
            }
          }
        }
      }
    }
    expect(outputs.length).toBeGreaterThan(500);
    for (const o of outputs) {
      expect(o).not.toContain(SENTINEL);
      expect(o).not.toContain(USER);
      expect(o).not.toContain("postgres://");
      expect(o).not.toContain("sslmode");
    }
  });
});

describe("io: the machine reads", () => {
  it("reads the rehearsal file by commit, and only hosts from the env file", () => {
    const root = mkdtempSync(path.join(tmpdir(), "seed-guard-"));
    try {
      expect(readRehearsal(root, HEAD)).toEqual({ found: false });
      mkdirSync(path.join(root, REHEARSAL_EVIDENCE_DIR), { recursive: true });
      writeFileSync(path.join(root, REHEARSAL_EVIDENCE_DIR, `${HEAD}.json`), rehearsalEvidenceText(evidence()));
      writeFileSync(path.join(root, REHEARSAL_EVIDENCE_DIR, `${OTHER}.json`), "{ not json");
      const found = readRehearsal(root, HEAD);
      expect(checkRehearsal(found, HEAD, NOW, () => false).ok).toBe(true);
      expect(readRehearsal(root, OTHER)).toEqual({ found: true, value: undefined });
      expect(readRehearsal(root, "../../etc/passwd")).toEqual({ found: false });
      expect(readProductionHosts(root)).toEqual([]);
      writeFileSync(path.join(root, ".env.local"), `DATABASE_URL=${url(PROD_POOLED)}\nNEON_AUTH_COOKIE_SECRET=${SENTINEL}\n`);
      expect(readProductionHosts(root)).toEqual([PROD_POOLED]);
      expect(readRepoState(root)).toEqual({ head: null, clean: null });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reads HEAD and the tree state of this repository", () => {
    const s = readRepoState(fileURLToPath(new URL("../../..", import.meta.url)));
    expect(s.head).toMatch(/^[0-9a-f]{40}$/);
    expect(typeof s.clean).toBe("boolean");
  });
});
