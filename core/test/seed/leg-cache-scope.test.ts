// SEEDC: `leg_cache` is shared by two writers. The seed owns the rows of the legs files (origin 'seed'); the server leg service (TB-L)
// owns the routed rows (origin 'server', migration 0014). The contract scopes the table to origin = 'seed', so a sync reads, updates,
// deletes and counts only the seed's own rows: a server-written row survives every seed run, a second run writes nothing, and a stored
// leg removed from the files is deleted (onMissing 'delete', inside the scope). No database: the engine runs against MemoryDb.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applySeed, assertScoped, nonEmptyTables, planSeed, readOnly, verifySeed, SeedEngineError } from "../../src/catalogue/postgres/load/engine.ts";
import type { TableData } from "../../src/catalogue/postgres/load/reference.ts";
import { loadMigrations } from "../../src/db/loader.ts";
import { SEED_TABLES, addedColumns, assertDeletable, assertSeedTable, planWrites, schemaTables, hasColumn, seedScope } from "../../src/seed/index.ts";
import { FACTS, MemoryDb, REPO } from "../catalogue/load-helpers.ts";

type Row = Record<string, unknown>;
const spec = assertSeedTable("leg_cache");

/** The leg_cache seed rows the way a STY-L family would build them from a legs file: stop ids, never the server's key grammar. */
function legData(rows: Row[], columns = ["from_cell", "to_cell", "mode", "seconds", "metres", "provider", "origin"]): TableData {
  const types: Record<string, string> = { seconds: "int", metres: "int" };
  return {
    spec,
    columns: columns.map((name) => ({ name, type: types[name] ?? "text" })),
    key: ["from_cell", "to_cell", "mode"],
    rows,
    files: ["data/schedules/legs/dolomites-2027.json"],
  };
}
const seedLeg = (from: string, to: string, minutes: number, mode = "drive"): Row => ({
  from_cell: from, to_cell: to, mode, seconds: minutes * 60, metres: minutes * 1000, provider: "ors", origin: "seed",
});
const SEED_ROWS = [seedLeg("bolzano", "vce", 160), seedLeg("antorno", "monte-piana", 25, "walk"), seedLeg("cortina", "bolzano", 95)];

/** Rows as the leg service writes them: grammar keys on both ends, origin 'server', with the 0014 columns the seed never writes. */
const serverLeg = (from: string, to: string, seconds: number): Row => ({
  from_cell: from, to_cell: to, mode: "drive", seconds, metres: seconds * 20, provider: "ors", origin: "server",
  profile: "driving-car", engine: "ors", engine_version: null, flags: [], hits: 3, last_used: "2026-10-27T10:00:00Z", computed_at: "2026-10-20T10:00:00Z",
});
const SERVER_ROWS = [serverLeg("t:3169070", "g:u0qj3d", 3600), serverLeg("r:dolomites/tre-cime", "t:3178796", 5400)];

const target = (): MemoryDb => new MemoryDb({ leg_cache: [...SERVER_ROWS] });
const serverRowsOf = (db: MemoryDb): Row[] => db.rows("leg_cache").filter((r) => r.origin === "server");

describe("the contract scopes leg_cache to the seed's own rows", () => {
  it("leg_cache is the one scoped table: origin = 'seed', onMissing delete inside the scope", () => {
    expect(SEED_TABLES.filter((t) => t.scope).map((t) => t.table)).toEqual(["leg_cache"]);
    expect(seedScope("leg_cache")).toMatchObject({ column: "origin", value: "seed" });
    expect(spec.onMissing).toBe("delete");
    expect(assertDeletable("leg_cache").table).toBe("leg_cache");
  });

  it("every scope column exists in the schema: in the create statement or added by a later migration", () => {
    const ms = loadMigrations();
    const tables = new Map(schemaTables(ms).map((t) => [t.name, t]));
    const added = ms.flatMap((m) => addedColumns(m.sql));
    for (const t of SEED_TABLES.filter((x) => x.scope)) {
      const col = t.scope!.column;
      expect(hasColumn(tables.get(t.table)!, col) || added.some((a) => a.table === t.table && a.column === col), `${t.table}.${col}`).toBe(true);
    }
    expect(addedColumns("alter table a add column if not exists b text, add column c int; -- alter table x add column y text;")).toEqual([
      { table: "a", column: "b" }, { table: "a", column: "c" },
    ]);
  });
});

describe("a seed run and server-written legs coexist", () => {
  it("a sync over a target holding server rows inserts the seed rows and plans nothing for the server rows", async () => {
    const db = target();
    const r = await applySeed(db, [legData(SEED_ROWS)], FACTS);
    const plan = r.plan.tables.find((t) => t.table === "leg_cache")!;
    expect(plan.counts).toMatchObject({ insert: 3, update: 0, delete: 0, retained: 0 });
    expect(serverRowsOf(db)).toEqual(SERVER_ROWS);
    expect(db.rows("leg_cache")).toHaveLength(5);
  });

  it("seeding twice is a no-op, also after the server wrote more rows in between", async () => {
    const db = target();
    await applySeed(db, [legData(SEED_ROWS)], FACTS);
    db.rows("leg_cache").push(serverLeg("g:u0qj3e", "t:3169070", 1200));
    const before = db.statements.length;
    const second = await applySeed(db, [legData(SEED_ROWS)], FACTS);
    expect(planWrites(second.plan)).toBe(0);
    expect(second.written.leg_cache).toBe(0);
    expect(db.statements.slice(before).filter((s) => s.includes('"leg_cache"'))).toEqual([]);
    expect(serverRowsOf(db)).toHaveLength(3);
  });

  it("a stored leg removed from the files is deleted, and only that seed row: the delete is bounded to origin = 'seed'", async () => {
    const db = target();
    await applySeed(db, [legData(SEED_ROWS)], FACTS);
    const r = await applySeed(db, [legData(SEED_ROWS.slice(1))], FACTS);
    expect(r.plan.tables[0]!.counts).toMatchObject({ delete: 1, insert: 0, update: 0 });
    expect(r.plan.tables[0]!.ids.delete).toEqual([JSON.stringify(["bolzano", "vce", "drive"])]);
    const del = db.statements.filter((s) => s.startsWith('delete from "leg_cache"'));
    expect(del).toHaveLength(1);
    expect(del[0]).toMatch(/ and t\."origin" = \$2$/);
    expect(db.rows("leg_cache").map((x) => x.from_cell).sort()).toEqual(["antorno", "cortina", "r:dolomites/tre-cime", "t:3169070"]);
    expect(serverRowsOf(db)).toEqual(SERVER_ROWS);
  });

  it("an empty legs family deletes every seed row and still leaves every server row", async () => {
    const db = target();
    await applySeed(db, [legData(SEED_ROWS)], FACTS);
    await applySeed(db, [legData([])], FACTS);
    expect(db.rows("leg_cache")).toEqual(SERVER_ROWS);
  });

  it("a changed stored leg updates the seed row only (the update is bounded to the scope too)", async () => {
    const db = target();
    await applySeed(db, [legData(SEED_ROWS)], FACTS);
    const changed = [seedLeg("bolzano", "vce", 150), ...SEED_ROWS.slice(1)];
    const r = await applySeed(db, [legData(changed)], FACTS);
    expect(r.plan.tables[0]!.counts).toMatchObject({ update: 1, insert: 0, delete: 0 });
    expect(db.statements.filter((s) => s.startsWith('update "leg_cache"')).every((s) => / and t\."origin" = \$2$/.test(s))).toBe(true);
    expect(db.rows("leg_cache").find((x) => x.from_cell === "bolzano")!.seconds).toBe(9000);
    expect(serverRowsOf(db)).toEqual(SERVER_ROWS);
  });

  it("reads only the seed's rows: the dry run, verify and db:seed's emptiness check never see a server row", async () => {
    const db = target();
    const reads: string[] = [];
    const planned = await readOnly(db, () => planSeed(db, [legData(SEED_ROWS)], FACTS));
    expect(planned.plan.totals).toMatchObject({ insert: 3, delete: 0 });
    reads.push(...db.log.filter((s) => s.startsWith("select") && s.includes('"leg_cache"')));
    expect(reads.every((s) => s.endsWith(' where "origin" = $1'))).toBe(true);
    // routed legs alone do not make the catalogue non-empty
    expect(await readOnly(db, () => nonEmptyTables(db, [legData(SEED_ROWS)]))).toEqual([]);
    await applySeed(db, [legData(SEED_ROWS)], FACTS);
    expect(await readOnly(db, () => nonEmptyTables(db, [legData(SEED_ROWS)]))).toEqual(["leg_cache"]);
    const drift = await readOnly(db, () => verifySeed(db, [legData(SEED_ROWS)], FACTS));
    const leg = drift.tables.find((t) => t.table === "leg_cache")!;
    expect(leg.seed.rows).toBe(3);
    expect(leg.target!.rows).toBe(3);
    expect(leg.counts).toEqual({ missing: 0, changed: 0, extra: 0 });
  });
});

describe("the seed may only create rows it will own", () => {
  it("refuses a scoped family that does not write the scope column", () => {
    const noOrigin = SEED_ROWS.map(({ origin: _o, ...r }) => r);
    expect(() => assertScoped(legData(noOrigin, ["from_cell", "to_cell", "mode", "seconds", "metres", "provider"]))).toThrow(SeedEngineError);
    expect(() => assertScoped(legData(noOrigin, ["from_cell", "to_cell", "mode", "seconds", "metres", "provider"]))).toThrow(/must write origin/);
  });

  it("refuses a seed row with another origin, before any statement", async () => {
    const db = target();
    const bad = [...SEED_ROWS, { ...seedLeg("x", "y", 1), origin: "server" }];
    await expect(applySeed(db, [legData(bad)], FACTS)).rejects.toMatchObject({ code: "E_SEED_SCOPE" });
    expect(db.statements).toEqual([]);
    expect(db.rows("leg_cache")).toEqual(SERVER_ROWS);
  });
});

describe("the two key spaces are disjoint (0014 leg_cache_origin_keys)", () => {
  const sql = loadMigrations().find((m) => m.name === "leg_cache_server_write")!.sql;
  const grammar = new RegExp(/k ~ '([^']+)'/.exec(sql)![1]!);

  it("the server rows of these tests are of the grammar on both ends, the seed rows are not", () => {
    for (const r of SERVER_ROWS) expect(grammar.test(String(r.from_cell)) && grammar.test(String(r.to_cell))).toBe(true);
    for (const r of SEED_ROWS) expect(grammar.test(String(r.from_cell)) && grammar.test(String(r.to_cell))).toBe(false);
  });

  it("every stored leg in data/schedules/legs has an end outside the server grammar, so seeding it verbatim meets the constraint", () => {
    const dir = path.join(REPO, "data", "schedules", "legs");
    const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".unrouted.json"));
    expect(files.length).toBeGreaterThan(0);
    let n = 0;
    for (const f of files) {
      const doc = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { legs: { from: string; to: string }[] };
      for (const l of doc.legs) {
        n++;
        expect(grammar.test(l.from) && grammar.test(l.to), `${f}: ${l.from} -> ${l.to}`).toBe(false);
      }
    }
    expect(n).toBeGreaterThan(10);
  });
});
