// LOCAL-2 integration: the seed engine and its CLI against a THROWAWAY database on the local Docker server (created from
// travel_template, migrated, dropped afterwards, so the developer's own seeded database is never touched).
// Runs when TEST_DATABASE_URL names a loopback server:
//   TEST_DATABASE_URL=$(pnpm db:url | tail -1) pnpm --dir core exec vitest run test/db/seed.integration.test.ts
// (`pnpm db:test` sets it.) A skip is not a pass: with the local database up, nothing here may skip.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_ADVISORY_LOCK_KEY } from "../../src/config/database.ts";
import { applySeed, run } from "../../src/catalogue/postgres/load/engine.ts";
import { fsSource } from "../../src/catalogue/postgres/load/files.ts";
import { buildSeed } from "../../src/catalogue/postgres/load/seed.ts";
import { migrate } from "../../src/db/runner.ts";
import { SeedContractError } from "../../src/seed/index.ts";
import { COMMIT, FACTS, REPO } from "../catalogue/load-helpers.ts";

const url = process.env.TEST_DATABASE_URL;
const loopback = (() => {
  try {
    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(new URL(url ?? "").hostname);
  } catch {
    return false;
  }
})();
const suite = describe.skipIf(!url || !loopback);

const CLI = path.join(REPO, "core", "bin", "db-seed.ts");
const SENTINEL = "sentinel-pw-7c1e";

suite("seed engine on the local database", () => {
  let Client: any;
  let admin: any;
  let db: any;
  let dbName = "";
  let dbUrl = "";
  let tmp = "";

  const sql = async (text: string, params: unknown[] = []) => (await db.query(text, params)).rows as any[];
  const count = async (table: string) => Number((await sql(`select count(*)::int as n from ${table}`))[0].n);
  const cli = (...args: string[]) => {
    const r = spawnSync("node", [CLI, ...args, "--url", dbUrl], { cwd: REPO, encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" } });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const cliRoot = (...args: string[]) => cli(...args, "--root", tmp);
  const dataPath = (rel: string) => path.join(tmp, rel);
  const editData = (rel: string, fn: (doc: any) => void) => {
    const doc = JSON.parse(readFileSync(dataPath(rel), "utf8"));
    fn(doc);
    writeFileSync(dataPath(rel), JSON.stringify(doc));
  };

  beforeAll(async () => {
    ({ Client } = (await import("pg" as string)) as any);
    admin = new Client({ connectionString: url });
    await admin.connect();
    dbName = `seed_test_${process.pid}_${Date.now() % 100000}`;
    await admin.query(`create database ${dbName} template travel_template`);
    const u = new URL(url!);
    u.pathname = `/${dbName}`;
    dbUrl = u.toString();
    db = new Client({ connectionString: dbUrl });
    await db.connect();
    await migrate(db);

    // A scratch copy of the reference inputs (only the public sections of the locations store), so a test can edit one row.
    tmp = mkdtempSync(path.join(tmpdir(), "seed-inputs-"));
    for (const f of ["data/vocab/types.json", "data/vocab/tags.json", "data/vocab/relevance-classes.json", "data/reference/countries.json", "data/capture/operators.json", "data/sources/registry.json"]) {
      mkdirSync(path.dirname(dataPath(f)), { recursive: true });
      cpSync(path.join(REPO, f), dataPath(f));
    }
    mkdirSync(dataPath("data/reference/towns"), { recursive: true });
    for (const f of readdirSync(path.join(REPO, "data/reference/towns")).filter((x) => x !== "anchors.json")) cpSync(path.join(REPO, "data/reference/towns", f), dataPath(`data/reference/towns/${f}`));
    const loc = JSON.parse(readFileSync(path.join(REPO, "data/locations/locations.json"), "utf8"));
    mkdirSync(dataPath("data/locations"), { recursive: true });
    writeFileSync(dataPath("data/locations/locations.json"), JSON.stringify({ countries: loc.countries, regions: loc.regions, areas: loc.areas }));
  }, 180000);

  afterAll(async () => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    if (db) await db.end();
    if (admin) {
      await admin.query(`drop database if exists ${dbName} with (force)`).catch(() => undefined);
      await admin.end();
    }
  });

  it("seeds an empty database and writes every row (db:seed, exit 0)", async () => {
    const r = cliRoot("seed");
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/wrote 5542 row\(s\) in \d+ ms/);
    const loc = JSON.parse(readFileSync(dataPath("data/locations/locations.json"), "utf8"));
    expect(await count("type_node")).toBe(398);
    expect(await count("tag")).toBe(81);
    expect(await count("relevance_class")).toBe(57);
    expect(await count("area")).toBe(249 + loc.regions.length + loc.areas.length);
    expect(await count("town")).toBe(4223);
    expect(await count("operator")).toBe(23);
    expect(await count("source")).toBe(423);
    expect((await sql(`select value from catalogue_meta where key = 'seed_commit'`))[0].value).toMatch(/^[0-9a-f]{40}$/);
  }, 120000);

  it("stores the shapes the schema expects (ltree path, geography point, dates, arrays, doc)", async () => {
    expect((await sql(`select path::text as p, level from area where id = 'CA/AB/banff-national-park'`))[0]).toEqual({ p: "CA.AB.banff_national_park", level: "area" });
    expect((await sql(`select ST_AsText(point, 5) as p, region_id, licence from town where id = 'ca-ab-banff'`))[0]).toEqual({ p: "POINT(-115.56982 51.17622)", region_id: "CA/AB", licence: "CC BY 4.0" });
    expect((await sql(`select records, profile from type_node where id = 'nature.summit'`))[0]).toEqual({ records: ["place"], profile: "viewpoint" });
    expect((await sql(`select first_read::text as d, automated from source order by id limit 1`))[0].d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("a second db:sync --dry-run plans 0 writes and exits 0; db:verify is equal", () => {
    const r = cliRoot("sync", "--dry-run");
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain("0 row(s) would be written");
    const v = cliRoot("verify");
    expect(v.code, v.out).toBe(0);
    expect(v.out).toContain("verify: equal");
  }, 60000);

  it("db:seed refuses a database that already holds rows (exit 1, use db:sync)", () => {
    const r = cliRoot("seed");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/E_SEED_NOT_EMPTY/);
  });

  it("a read-only dry run and a verify cannot write", async () => {
    const before = await count("town");
    cliRoot("sync", "--dry-run");
    cliRoot("verify");
    expect(await count("town")).toBe(before);
  });

  it("travel_app can read the seeded reference rows and still cannot read trip", async () => {
    await db.query("begin");
    try {
      await db.query(`set local role travel_app`);
      expect(Number((await db.query(`select count(*)::int as n from town`)).rows[0].n)).toBe(4223);
      expect(Number((await db.query(`select count(*)::int as n from source`)).rows[0].n)).toBe(423);
      await db.query("savepoint s");
      await expect(db.query(`select 1 from trip limit 1`)).rejects.toThrow();
      await db.query("rollback to savepoint s");
    } finally {
      await db.query("rollback");
    }
  });

  it("one edited input row is exactly one update in the dry run (exit 3), then applied, then 0 writes", async () => {
    editData("data/reference/towns/ca.json", (d) => { d.rows[2][1] = "Bearspaw Renamed"; });
    const dry = cliRoot("sync", "--dry-run");
    expect(dry.code, dry.out).toBe(3);
    expect(dry.out).toMatch(/town\s+\+0\s+~1\s+-0\s+x0\s+=4222/);
    expect(dry.out).toContain("update: ca-ab-bearspaw");
    expect(dry.out).toContain("1 row(s) would be written");
    const sync = cliRoot("sync");
    expect(sync.code, sync.out).toBe(0);
    expect(sync.out).toContain("wrote 1 row(s)");
    expect((await sql(`select name from town where id = 'ca-ab-bearspaw'`))[0].name).toBe("Bearspaw Renamed");
    expect(cliRoot("sync", "--dry-run").code).toBe(0);
  }, 120000);

  it("a removed row: kept tables report retained and keep the row; deletable tables delete", async () => {
    const towns = await count("town");
    editData("data/reference/towns/ca.json", (d) => { d.rows.splice(0, 1); });
    editData("data/vocab/tags.json", (d) => { d.tags.pop(); });
    editData("data/vocab/relevance-classes.json", (d) => { d.classes.pop(); });
    const dry = cliRoot("sync", "--dry-run");
    expect(dry.code, dry.out).toBe(3);
    expect(dry.out).toMatch(/town\s+\+0\s+~0\s+-0\s+x0\s+=4223 \(1 retained\)/);
    expect(dry.out).toMatch(/tag\s+\+0\s+~0\s+-0\s+x1/);
    expect(dry.out).toMatch(/relevance_class\s+\+0\s+~0\s+-0\s+x1/);
    expect(cliRoot("sync").code).toBe(0);
    expect(await count("town")).toBe(towns);
    expect(await count("tag")).toBe(80);
    expect(await count("relevance_class")).toBe(56);
    const after = cliRoot("sync", "--dry-run");
    expect(after.code, after.out).toBe(0);
    expect(cliRoot("verify").code).toBe(0);
  }, 120000);

  it("db:verify differs after a manual edit of a row (exit 1) and a sync repairs it", async () => {
    await db.query(`update town set name = 'edited by hand' where id = 'ca-ab-banff'`);
    const v = cliRoot("verify");
    expect(v.code, v.out).toBe(1);
    expect(v.out).toMatch(/town\s+differ/);
    expect(v.out).toContain("verify: 1 table(s) differ");
    expect(cliRoot("sync").code).toBe(0);
    expect(cliRoot("verify").code).toBe(0);
  }, 120000);

  it("leaves private tables alone, and the engine refuses to touch one", async () => {
    await db.query(`insert into planner_draft (user_id, title) values ('itest-seed', 'mine')`);
    const before = await count("planner_draft");
    cliRoot("sync");
    expect(await count("planner_draft")).toBe(before);
    for (const t of ["planner_draft", "saved_place", "app_user", "household", "trip"]) {
      await expect(run(db, t, `delete from ${t}`)).rejects.toBeInstanceOf(SeedContractError);
    }
    expect(await count("planner_draft")).toBe(before);
    await db.query(`delete from planner_draft where user_id = 'itest-seed'`);
  });

  it("fails closed while another session holds the seed lock", async () => {
    const other = new Client({ connectionString: dbUrl });
    await other.connect();
    try {
      await other.query(`select pg_advisory_lock($1::bigint)`, [SEED_ADVISORY_LOCK_KEY.toString()]);
      const built = buildSeed(fsSource(REPO), COMMIT);
      await expect(applySeed(db, built, FACTS)).rejects.toMatchObject({ code: "E_SEED_LOCKED" });
      await other.query(`select pg_advisory_unlock($1::bigint)`, [SEED_ADVISORY_LOCK_KEY.toString()]);
    } finally {
      await other.end();
    }
  });

  it("refuses production and the child before any connection, with the guard's exit 2 and no secret in the output", () => {
    // Read-only operations on production are allowed by the guard (spec 12.2 row 17), so none is tried here: it would open a connection.
    const prodUrl = `postgres://neondb_owner:${SENTINEL}@ep-quiet-leaf-b4oz2a4v.us-east-2.aws.neon.tech/neondb?sslmode=require`;
    const run1 = (args: string[]) => {
      const r = spawnSync("node", [CLI, ...args], { cwd: REPO, encoding: "utf8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" } });
      return { code: r.status, out: `${r.stdout}${r.stderr}` };
    };
    const cases: string[][] = [
      ["sync", "--target", "production"],
      ["sync", "--target", "production", "--url", prodUrl],
      ["sync", "--target", prodUrl, "--allow-remote"],
      ["seed", "--target", "production"],
      ["seed", "--target", "child"],
      ["sync", "--target", "production", "--approve", "f".repeat(40)],
      ["sync", "--target", "production", "--url", prodUrl, "--approve", "f".repeat(40)],
      ["verify", "--target", "production"],
    ];
    for (const args of cases) {
      const r = run1(args);
      expect(r.code, args.join(" ")).toBe(2);
      expect(r.out).not.toContain(SENTINEL);
      expect(r.out).not.toContain("postgres://");
      expect(r.out).not.toContain("neondb_owner");
    }
    expect(run1(["sync", "--target", "production"]).out).toMatch(/needs --approve/);
    expect(run1(["seed", "--target", "child"]).out).toMatch(/loopback target only/);
  });

  it("db:sync on the default target uses the local credentials file, never DATABASE_URL", () => {
    const r = spawnSync("node", [CLI, "sync", "--dry-run"], {
      cwd: REPO, encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", HOME: "/nonexistent-home", DATABASE_URL: `postgres://u:${SENTINEL}@ep-quiet-leaf-b4oz2a4v.us-east-2.aws.neon.tech/x`, LOCAL_DB_ENV_FILE: "/nonexistent/local-db.env" },
    });
    expect(r.status).toBe(2);
    expect(`${r.stdout}${r.stderr}`).toMatch(/pnpm db:up/);
    expect(`${r.stdout}${r.stderr}`).not.toContain(SENTINEL);
  });
});
