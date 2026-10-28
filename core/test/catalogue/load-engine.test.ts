// LOCAL-2: the engine's plan, apply and verify against an in-memory target (no database). The Postgres run is
// core/test/db/seed.integration.test.ts.
import { describe, expect, it } from "vitest";
import {
  applySeed, nonEmptyTables, planSeed, readOnly, requiredMigrations, run, verifySeed, SeedEngineError, BATCH_ROWS,
} from "../../src/catalogue/postgres/load/engine.ts";
import { executeSeedCommand, buildSeed } from "../../src/catalogue/postgres/load/seed.ts";
import { DELETE_ORDER, NOT_SEEDED, SEED_TABLES, SeedContractError, planWrites, planExitCode, formatPlan } from "../../src/seed/index.ts";
import { COMMIT, FACTS, MemoryDb, editJson, overlay } from "./load-helpers.ts";

const base = buildSeed(overlay(), COMMIT);
const total = base.reduce((n, t) => n + t.rows.length, 0);

async function seeded(): Promise<MemoryDb> {
  const db = new MemoryDb();
  await applySeed(db, base, FACTS);
  return db;
}

describe("engine: seed from empty", () => {
  it("inserts every row of every table in the contract's apply order, in one transaction", async () => {
    const db = new MemoryDb();
    const r = await applySeed(db, base, FACTS);
    expect(r.plan.totals).toMatchObject({ insert: total, update: 0, retire: 0, delete: 0 });
    expect(Object.values(r.written).reduce((a, b) => a + b, 0)).toBe(total);
    expect(db.writeOrder("insert")).toEqual(SEED_TABLES.filter((t) => base.some((b) => b.spec.table === t.table)).map((t) => t.table).filter((t) => t !== "catalogue_meta").concat(["catalogue_meta"]));
    expect(db.log[0]).toBe("begin");
    expect(db.log.at(-1)).toBe("commit");
    expect(db.log.filter((s) => s === "begin" || s === "commit")).toHaveLength(2);
    expect(db.rows("catalogue_meta")).toEqual([{ key: "seed_commit", value: COMMIT }]);
  });

  it("batches large tables and never sends a batch over BATCH_ROWS", async () => {
    const db = new MemoryDb();
    await applySeed(db, base, FACTS);
    const townInserts = db.statements.filter((s) => s.startsWith('insert into "town"')).length;
    expect(townInserts).toBe(Math.ceil(base.find((t) => t.spec.table === "town")!.rows.length / BATCH_ROWS));
  });

  it("db:seed refuses a target that already holds rows", async () => {
    const db = await seeded();
    await expect(executeSeedCommand(db, "seed", base, FACTS)).rejects.toMatchObject({ code: "E_SEED_NOT_EMPTY" });
    expect(await readOnly(db, () => nonEmptyTables(db, base))).toContain("town");
    const empty = new MemoryDb();
    expect((await executeSeedCommand(empty, "seed", base, FACTS)).exit).toBe(0);
  });
});

describe("engine: idempotency", () => {
  it("plans 0 writes for a second run of the same data, and exits 0", async () => {
    const db = await seeded();
    const r = await executeSeedCommand(db, "sync_dry_run", base, FACTS);
    expect(planWrites(r.plan!)).toBe(0);
    expect(r.exit).toBe(0);
    expect(r.plan!.totals.unchanged).toBe(total);
    const before = db.statements.length;
    const second = await applySeed(db, base, FACTS);
    expect(Object.values(second.written).every((n) => n === 0)).toBe(true);
    expect(db.statements.slice(before).every((s) => s.startsWith("insert into catalogue_meta"))).toBe(true);
  });

  it("a new commit with the same data is still 0 writes; the stamp follows the commit", async () => {
    const db = await seeded();
    const other = { ...FACTS, commit: "b".repeat(40) };
    const rebuilt = buildSeed(overlay(), other.commit);
    expect(planWrites((await planSeed(db, rebuilt, other)).plan)).toBe(0);
    await applySeed(db, rebuilt, other);
    expect(db.rows("catalogue_meta")).toEqual([{ key: "seed_commit", value: other.commit }]);
  });

  it("a dry run is read only: it opens a read only transaction and writes nothing", async () => {
    const db = new MemoryDb();
    const r = await executeSeedCommand(db, "sync_dry_run", base, FACTS);
    expect(r.exit).toBe(3);
    expect(db.statements).toEqual([]);
    expect(db.log[0]).toBe("begin read only");
    expect(db.log.at(-1)).toBe("rollback");
    expect(formatPlan(r.plan!)).toContain(`+${total}`);
  });
});

describe("engine: a changed input row", () => {
  it("one edited town name is exactly one update, and the apply writes exactly that row", async () => {
    const db = await seeded();
    const edited = buildSeed(overlay({ "data/reference/towns/ca.json": editJson((d) => { d.rows[2][1] = "Bearspaw (renamed)"; }) }), COMMIT);
    const { plan } = await planSeed(db, edited, FACTS);
    expect(plan.totals).toMatchObject({ insert: 0, update: 1, retire: 0, delete: 0 });
    const town = plan.tables.find((t) => t.table === "town")!;
    expect(town.counts.update).toBe(1);
    expect(town.ids.update).toEqual(["ca-ab-bearspaw"]);
    expect(planExitCode(plan)).toBe(3);
    const r = await applySeed(db, edited, FACTS);
    expect(r.written).toMatchObject({ town: 1 });
    expect(db.rows("town").find((t) => t.id === "ca-ab-bearspaw")!.name).toBe("Bearspaw (renamed)");
    expect(planWrites((await planSeed(db, edited, FACTS)).plan)).toBe(0);
  });

  it("reordering a set column (type_node.records) is not a change", async () => {
    const db = await seeded();
    const target = db.rows("type_node").find((r) => Array.isArray(r.records) && (r.records as string[]).length > 1);
    if (target) (target.records as string[]).reverse();
    expect(planWrites((await planSeed(db, base, FACTS)).plan)).toBe(0);
  });
});

describe("engine: a removed input row (retire, never delete)", () => {
  const without = (file: string, drop: (d: any) => void) => buildSeed(overlay({ [file]: editJson(drop) }), COMMIT);

  it("keeps a town, area, operator, source and type node the seed no longer has, and reports them retained", async () => {
    const db = await seeded();
    const smaller = buildSeed(overlay({
      "data/reference/towns/ca.json": editJson((d) => { d.rows.splice(0, 1); }),
      "data/capture/operators.json": editJson((d) => { d.operators.pop(); }),
      "data/sources/registry.json": editJson((d) => { d.entries.pop(); }),
    }), COMMIT);
    const { plan } = await planSeed(db, smaller, FACTS);
    expect(plan.totals).toMatchObject({ insert: 0, update: 0, delete: 0, retire: 0, retained: 3 });
    for (const t of ["town", "operator", "source"]) expect(plan.tables.find((x) => x.table === t)!.counts.retained).toBe(1);
    expect(planExitCode(plan)).toBe(0);
    const before = db.rows("town").length;
    await applySeed(db, smaller, FACTS);
    expect(db.rows("town")).toHaveLength(before);
    expect(db.statements.some((s) => s.startsWith("delete"))).toBe(false);
    const typeless = without("data/vocab/types.json", (d) => { d.nodes = d.nodes.filter((n: any) => !String(n.id).startsWith("access.pass.timed")); });
    expect((await planSeed(db, typeless, FACTS)).plan.tables.find((t) => t.table === "type_node")!.counts.retained).toBeGreaterThan(0);
  });

  it("deletes a tag and a relevance class, in the reverse of the apply order, after the inserts and updates", async () => {
    const db = await seeded();
    const smaller = buildSeed(overlay({
      "data/vocab/tags.json": editJson((d) => { d.tags.pop(); }),
      "data/vocab/relevance-classes.json": editJson((d) => { d.classes.pop(); }),
      "data/reference/towns/ca.json": editJson((d) => { d.rows[0][1] = "Airdrie 2"; }),
    }), COMMIT);
    const { plan } = await planSeed(db, smaller, FACTS);
    expect(plan.totals).toMatchObject({ update: 1, delete: 2 });
    await applySeed(db, smaller, FACTS);
    expect(db.writeOrder("delete")).toEqual(DELETE_ORDER.filter((t) => t === "relevance_class" || t === "tag"));
    expect(db.writeOrder("delete")).toEqual(["relevance_class", "tag"]);
    const lastUpdate = db.statements.map((s, i) => (s.startsWith("update") ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
    const firstDelete = db.statements.findIndex((s) => s.startsWith("delete"));
    expect(firstDelete).toBeGreaterThan(lastUpdate);
    expect(db.rows("tag")).toHaveLength(base.find((t) => t.spec.table === "tag")!.rows.length - 1);
  });
});

describe("engine: what it refuses", () => {
  it("never sends a statement for a private, unclassified or foreign table", async () => {
    const db = new MemoryDb();
    for (const t of ["plan_draft", "saved_place", "app_user", "household", "trip", "neon_auth.user", "schema_migrations", "nope"]) {
      await expect(run(db, t, `select * from ${t}`)).rejects.toBeInstanceOf(SeedContractError);
    }
    expect(Object.keys(NOT_SEEDED)).toContain("plan_draft");
    expect(db.log).toEqual([]);
  });

  it("fails closed when the seed lock is held, and writes nothing", async () => {
    const db = new MemoryDb();
    db.lockFree = false;
    await expect(applySeed(db, base, FACTS)).rejects.toMatchObject({ code: "E_SEED_LOCKED" });
    expect(db.statements).toEqual([]);
    expect(db.log.at(-1)).toBe("rollback");
  });

  it("rolls the whole run back when a statement fails midway", async () => {
    const db = new MemoryDb();
    db.failOn = (sql) => sql.startsWith('insert into "operator"');
    await expect(applySeed(db, base, FACTS)).rejects.toThrow("injected failure");
    expect(db.rows("town")).toEqual([]);
    expect(db.rows("type_node")).toEqual([]);
  });

  it("asks for the migrations when a table is missing, and verify reports the table missing", async () => {
    const db = await seeded();
    db.missing.add("town");
    await expect(planSeed(db, base, FACTS)).rejects.toMatchObject({ code: "E_SEED_NO_TABLE" });
    const d = await verifySeed(db, base, FACTS);
    expect(d.ok).toBe(false);
    expect(d.tables.find((t) => t.table === "town")!.status).toBe("missing_table");
  });

  it("an engine error is a SeedEngineError with a code", () => {
    expect(new SeedEngineError("E_X", "m").code).toBe("E_X");
  });
});

describe("engine: verify", () => {
  it("is equal after a seed and differs after a manual edit, a missing row and an extra row", async () => {
    const db = await seeded();
    const ok = await verifySeed(db, base, FACTS);
    expect(ok.ok).toBe(true);
    expect(ok.tables.every((t) => t.status === "equal")).toBe(true);
    db.rows("town")[0]!.name = "edited by hand";
    db.rows("tag").pop();
    db.rows("relevance_class").push({ key: "extra/class", doc: {} });
    const bad = await verifySeed(db, base, FACTS);
    expect(bad.ok).toBe(false);
    expect(bad.tables.find((t) => t.table === "town")).toMatchObject({ status: "differ", counts: { changed: 1 } });
    expect(bad.tables.find((t) => t.table === "tag")).toMatchObject({ counts: { missing: 1 } });
    expect(bad.tables.find((t) => t.table === "relevance_class")).toMatchObject({ counts: { extra: 1 } });
    const r = await executeSeedCommand(db, "verify", base, FACTS);
    expect(r.exit).toBe(1);
  });

  it("needs the migration that creates the tables", () => {
    expect(requiredMigrations(base)).toContain("0003");
  });
});
