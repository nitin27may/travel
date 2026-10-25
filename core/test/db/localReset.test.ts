// Opt-in (it destroys and recreates the local container's volume): LOCAL_DB_RESET_TEST=1 pnpm --dir core exec vitest run test/db/localReset.test.ts
// Asserts db:reset is idempotent: two resets in a row end in the same state (ten migrations applied, same
// schema fingerprint), and a following `db:migrate` has nothing to do.
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const cli = (sub: string) =>
  spawnSync("node", [join(ROOT, "core", "bin", "db-local.ts"), sub], { cwd: ROOT, encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" } });

function fingerprint(): string {
  const r = spawnSync("docker", ["exec", "travel-localdb", "psql", "-U", "postgres", "-d", "neondb", "-Atc",
    "select md5(string_agg(table_name||'.'||column_name||':'||data_type, ',' order by table_name, column_name)) from information_schema.columns where table_schema='public'"],
    { encoding: "utf8" });
  return r.stdout.trim();
}

describe.skipIf(!process.env.LOCAL_DB_RESET_TEST)("db:reset idempotency", () => {
  it("two resets give the same state and migrate is then a no-op", () => {
    const first = cli("reset");
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain("applied 10");
    const f1 = fingerprint();
    const second = cli("reset");
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain("applied 10");
    expect(fingerprint()).toBe(f1);
    const again = cli("migrate");
    expect(again.stdout).toContain("up to date");
  }, 300000);
});
