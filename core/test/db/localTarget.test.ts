import { describe, expect, it } from "vitest";
import {
  assertLoopback,
  checkUrl,
  PRODUCTION_ENDPOINT,
  resolveTarget,
  scrubbedEnv,
  TargetError,
} from "../../src/db/localTarget.ts";

const SENTINEL = "sentinel-pw-9f3a";
const prodUrl = `postgres://neondb_owner:${SENTINEL}@${PRODUCTION_ENDPOINT}.us-east-2.aws.neon.tech/neondb?sslmode=require`;
const pooledProdUrl = `postgres://neondb_owner:${SENTINEL}@${PRODUCTION_ENDPOINT}-pooler.us-east-2.aws.neon.tech/neondb`;
const fileReader = () => "LOCAL_DB_PASSWORD=abc123\nLOCAL_DB_SUPERUSER_PASSWORD=def\nLOCAL_DB_PORT=54329\n";

describe("local database target resolver", () => {
  it("refuses the production endpoint, direct or pooled, without naming the URL, user or password", () => {
    for (const u of [prodUrl, pooledProdUrl]) {
      let err: unknown;
      try {
        checkUrl(u, { env: {} });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(TargetError);
      const msg = (err as Error).message;
      expect(msg).toContain("production");
      expect(msg).not.toContain(SENTINEL);
      expect(msg).not.toContain("neondb_owner");
      expect(msg).not.toContain("postgres://");
    }
  });

  it("refuses production passed as --url or LOCAL_DATABASE_URL", () => {
    expect(() => resolveTarget({ url: prodUrl, env: {} })).toThrow(TargetError);
    expect(() => resolveTarget({ env: { LOCAL_DATABASE_URL: prodUrl } })).toThrow(TargetError);
  });

  it("refuses a host that equals the ambient DATABASE_URL host (the root .env.local value)", () => {
    const other = "postgres://u:p@some-other-host.example.com/db";
    expect(() => checkUrl(other, { env: { DATABASE_URL: other }, allowRemote: true })).toThrow(/production/);
  });

  it("refuses any other remote host unless --allow-remote", () => {
    const child = "postgres://u:p@ep-other-1234.us-east-2.aws.neon.tech/neondb";
    expect(() => checkUrl(child, { env: {} })).toThrow(/non-loopback/);
    expect(checkUrl(child, { env: {}, allowRemote: true }).loopback).toBe(false);
  });

  it("never falls back to DATABASE_URL: with no credentials file it asks for db:up", () => {
    const env = { DATABASE_URL: prodUrl, DATABASE_URL_UNPOOLED: prodUrl };
    expect(() => resolveTarget({ env, readPasswordFile: () => undefined })).toThrow(/pnpm db:up/);
  });

  it("builds the local default from the password file, on loopback", () => {
    const t = resolveTarget({ env: { DATABASE_URL: prodUrl }, readPasswordFile: fileReader });
    expect(t.name).toBe("local");
    expect(t.host).toBe("127.0.0.1");
    expect(t.url).toBe("postgres://neondb_owner:abc123@127.0.0.1:54329/neondb");
    expect(() => assertLoopback(t)).not.toThrow();
  });

  it("db:reset-style commands refuse a remote host even when remote is allowed", () => {
    const t = checkUrl("postgres://u:p@ep-other-1234.us-east-2.aws.neon.tech/neondb", { env: {}, allowRemote: true });
    expect(() => assertLoopback(t)).toThrow(/loopback/);
  });

  describe("one decision table: the LOCAL-C guard", () => {
    const child = "postgres://u:p@ep-other-1234.us-east-2.aws.neon.tech/neondb";
    const code = (fn: () => unknown): string | undefined => {
      try {
        fn();
      } catch (e) {
        return (e as TargetError).guardCode;
      }
      return undefined;
    };

    it("takes the production decision from the guard, with the guard's code", () => {
      expect(code(() => checkUrl(prodUrl, { env: {}, allowRemote: true }))).toBe("E_APPROVE_REQUIRED");
      expect(code(() => checkUrl(pooledProdUrl, { env: {}, allowRemote: true, operation: "psql" }))).toBe("E_PRODUCTION_SHELL");
      expect(code(() => checkUrl(prodUrl, { env: {}, allowRemote: true, operation: "reset" }))).toBe("E_LOOPBACK_ONLY");
    });

    it("refuses production even with an approval when the repository state is unknown or the sha is wrong", () => {
      const sha = "a".repeat(40);
      expect(code(() => checkUrl(prodUrl, { env: {}, allowRemote: true, flags: { approve: sha } }))).toBe("E_REPO_STATE");
      expect(code(() => checkUrl(prodUrl, { env: {}, allowRemote: true, flags: { approve: sha }, repo: { head: "b".repeat(40), clean: true } }))).toBe("E_APPROVE_MISMATCH");
      expect(code(() => checkUrl(prodUrl, { env: {}, allowRemote: true, flags: { approve: sha }, repo: { head: sha, clean: false } }))).toBe("E_DIRTY_TREE");
      expect(code(() => checkUrl(prodUrl, { env: {}, allowRemote: true, flags: { approve: sha }, repo: { head: sha, clean: true } }))).toBe("E_REHEARSAL_MISSING");
    });

    it("knows production by the host names it is given, not only by the constant", () => {
      const other = "postgres://u:p@some-other-host.example.com/db";
      expect(code(() => checkUrl(other, { env: {}, allowRemote: true, productionHosts: ["some-other-host.example.com"] }))).toBe("E_APPROVE_REQUIRED");
    });

    it("refuses a remote host that is not a Neon host (the guard's child rule), reset on the child, and a loopback host named as production", () => {
      expect(code(() => checkUrl("postgres://u:p@db.example.com/x", { env: {}, allowRemote: true }))).toBe("E_CHILD_NOT_NEON");
      expect(code(() => checkUrl(child, { env: {}, allowRemote: true, operation: "reset" }))).toBe("E_LOOPBACK_ONLY");
      expect(code(() => checkUrl(child, { env: {}, allowRemote: true, operation: "seed" }))).toBe("E_LOOPBACK_ONLY");
      expect(code(() => checkUrl("postgres://u:p@127.0.0.1:1/x", { env: {}, flags: { targetKind: "production" } }))).toBe("E_LOOPBACK_KIND");
    });

    it("allows the child for a migrate once remote is allowed, and every operation on loopback", () => {
      const t = checkUrl(child, { env: {}, allowRemote: true });
      expect(t.kind).toBe("child");
      expect(t.label).toBe("child ep-other-1234.us-east-2.aws.neon.tech");
      for (const operation of ["migrate", "seed", "sync", "sync_dry_run", "verify", "reset", "psql"] as const) {
        expect(checkUrl("postgres://u:p@127.0.0.1:54329/neondb", { env: {}, operation }).kind).toBe("local");
      }
    });

    it("never repeats the password in a refusal", () => {
      for (const operation of ["migrate", "sync", "reset", "psql"] as const) {
        const msg = (() => {
          try {
            checkUrl(prodUrl, { env: {}, allowRemote: true, operation });
          } catch (e) {
            return (e as Error).message;
          }
          return "";
        })();
        expect(msg).not.toContain(SENTINEL);
        expect(msg).not.toContain("postgres://");
      }
    });
  });

  it("strips every ambient database URL from a child environment", () => {
    const out = scrubbedEnv({ DATABASE_URL: "a", DATABASE_URL_UNPOOLED: "b", TEST_DATABASE_URL: "c", PGPASSWORD: "d", PATH: "/bin" });
    expect(out).toEqual({ PATH: "/bin" });
  });
});
