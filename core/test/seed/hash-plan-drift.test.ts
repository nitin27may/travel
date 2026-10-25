// Content hash, plan classification (the idempotency rule) and the db:verify drift shape.
import { describe, expect, it } from "vitest";
import { RUN_ID_RE } from "../../src/schema/rowMeta.ts";
import { SEED_TABLES, seedSpec } from "../../src/seed/contract.ts";
import { compareTable, driftExitCode, driftResult, driftResultSchema, driftSummary, formatDrift } from "../../src/seed/drift.ts";
import {
  HASH_EXCLUDED_PATHS,
  canonicalRow,
  contentHash,
  derivedId,
  formatCoord,
  geometryWkt,
  rowId,
  seedRunId,
  stampSeedMeta,
  tableHash,
} from "../../src/seed/hash.ts";
import { classifyRow, formatPlan, planExitCode, planTable, planWrites, seedPlan, type TargetRow } from "../../src/seed/plan.ts";

const SHA = "a".repeat(40);
const TARGET = { name: "local" as const, kind: "local" as const, host: "127.0.0.1" };

const town = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "ca-ab-banff", cc: "CA", name: "Banff", point: { type: "Point", coordinates: [-115.5708, 51.1784] }, pop: 7851,
  meta: { schema_version: 1, run_id: "seed-1", imported_from: { file: "data/reference/towns/ca.json", sha256: "0".repeat(64) }, imported_at: "2026-10-25T00:00:00Z" },
  ...over,
});

describe("content hash", () => {
  it("is equal for the same row built twice, whatever the key order", () => {
    const a = town();
    const b = Object.fromEntries(Object.entries(town()).reverse());
    expect(contentHash("town", a)).toBe(contentHash("town", b));
  });

  it("ignores meta.run_id, meta.imported_at, updated_at and the other stamps", () => {
    const base = contentHash("town", town());
    const restamped = town({
      updated_at: "2026-10-26T10:00:00Z",
      version: 7,
      meta: { schema_version: 1, run_id: "seed-2", first_run_id: "seed-0", imported_from: { file: "x", sha256: "1".repeat(64) }, imported_at: "2026-10-26T00:00:00Z" },
    });
    expect(contentHash("town", restamped)).toBe(base);
    for (const p of ["updated_at", "meta.run_id", "meta.imported_at"]) expect(HASH_EXCLUDED_PATHS).toContain(p);
  });

  it("moves when content moves, including a meta key that is not a stamp", () => {
    const base = contentHash("town", town());
    expect(contentHash("town", town({ name: "Banff!" }))).not.toBe(base);
    expect(contentHash("town", town({ meta: { schema_version: 1, review_state: "approved" } }))).not.toBe(base);
  });

  it("never mutates the row", () => {
    const row = town();
    const before = JSON.stringify(row);
    canonicalRow("town", row);
    expect(JSON.stringify(row)).toBe(before);
  });

  it("sorts set columns, keeps ordered arrays", () => {
    const e = (tags: string[]): Record<string, unknown> => ({ id: "r", name: "n", tags });
    expect(contentHash("entity", e(["b", "a"]))).toBe(contentHash("entity", e(["a", "b"])));
    const sorted = canonicalRow("entity", { id: "r", tags: ["b", "a"], other: ["b", "a"] });
    expect(sorted.tags).toEqual(["a", "b"]);
    expect(sorted.other).toEqual(["b", "a"]);
  });

  it("writes geometry as WKT with 7 decimals, from GeoJSON or WKT alike", () => {
    expect(geometryWkt({ type: "Point", coordinates: [-115.57080001234, 51.1784] })).toBe("POINT(-115.5708 51.1784)");
    expect(geometryWkt("SRID=4326;point(-115.570800004 51.17840)")).toBe("POINT(-115.5708 51.1784)");
    expect(geometryWkt({ type: "LineString", coordinates: [[1, 2], [3.123456789, 4]] })).toBe("LINESTRING(1 2,3.1234568 4)");
    expect(geometryWkt({ type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] })).toBe("MULTIPOLYGON(((0 0,1 0,1 1,0 0)))");
    expect(geometryWkt(null)).toBeNull();
    expect(formatCoord(-0.00000001)).toBe("0");
    expect(formatCoord(1e-7)).toBe("0.0000001");
    expect(contentHash("town", town({ point: "POINT(-115.5708 51.1784)" }))).toBe(contentHash("town", town()));
  });

  it("refuses a table outside the seed", () => {
    expect(() => contentHash("saved_place", {})).toThrow(/never touches/);
  });
});

describe("ids", () => {
  it("record ids: the key, or a canonical array for a composite key", () => {
    expect(rowId("entity", { id: "legacy/x/trails/y" })).toBe("legacy/x/trails/y");
    expect(rowId("relation", { to_id: "b", from_id: "a", kind: "reaches" })).toBe('["a","b","reaches"]');
    expect(() => rowId("town", {})).toThrow(/no id/);
  });

  it("derived ids are stable and prefixed", () => {
    const a = derivedId("lnk", ["e", "official", "https://x"]);
    expect(a).toMatch(/^lnk-[0-9a-f]{16}$/);
    expect(derivedId("lnk", ["e", "official", "https://x"])).toBe(a);
    expect(derivedId("lnk", ["e", "official", "https://y"])).not.toBe(a);
    expect(() => derivedId("BAD", [])).toThrow();
  });

  it("table hash does not depend on read order", () => {
    const e: [string, string][] = [["a", "1"], ["b", "2"], ["c", "3"]];
    expect(tableHash(e)).toBe(tableHash([...e].reverse()));
    expect(tableHash(e)).not.toBe(tableHash([["a", "1"], ["b", "2"]]));
  });

  it("run ids carry the time and the commit, and satisfy RowMeta", () => {
    const id = seedRunId("0123456789abcdef0123456789abcdef01234567", new Date("2026-10-25T18:30:05.123Z"));
    expect(id).toBe("seed-20261025T183005Z-0123456789ab");
    expect(RUN_ID_RE.test(id)).toBe(true);
    expect(() => seedRunId("abc", new Date())).toThrow();
  });

  it("stamps run_id and imported_from {file, sha256} through the normaliser's stamp, only on tables with meta", () => {
    const m = stampSeedMeta("town", { schema_version: 1, license: "CC-BY-4.0" }, "data/reference/towns/ca.json", "[]", "seed-x", new Date("2026-10-25T00:00:00Z"));
    expect(m).toMatchObject({ schema_version: 1, license: "CC-BY-4.0", run_id: "seed-x", imported_at: "2026-10-25T00:00:00.000Z" });
    expect((m.imported_from as { sha256: string }).sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(() => stampSeedMeta("place_row", {}, "f", "", "seed-x", new Date())).toThrow(/no meta column/);
  });
});

describe("plan classification", () => {
  const entity = seedSpec("entity")!;
  const town = seedSpec("town")!;
  const relation = seedSpec("relation")!;
  const evidence = seedSpec("evidence")!;

  it("covers every branch", () => {
    expect(classifyRow(relation, "h", undefined)).toBe("insert");
    expect(classifyRow(relation, "h", { hash: "h" })).toBe("unchanged");
    expect(classifyRow(relation, "h", { hash: "g" })).toBe("update");
    expect(classifyRow(relation, undefined, { hash: "g" })).toBe("delete");
    expect(classifyRow(entity, undefined, { hash: "g" })).toBe("retire");
    expect(classifyRow(entity, undefined, { hash: "g", retired: true })).toBe("retained");
    expect(classifyRow(entity, "h", { hash: "h", retired: true })).toBe("update");
    expect(classifyRow(town, undefined, { hash: "g" })).toBe("retained");
    expect(classifyRow(evidence, undefined, { hash: "g" })).toBe("retained");
    expect(classifyRow(evidence, "h", { hash: "h" })).toBe("unchanged");
    expect(() => classifyRow(evidence, "h", { hash: "g" })).toThrow(/append-only/);
    expect(() => classifyRow(relation, undefined, undefined)).toThrow();
  });

  it("never plans a delete on a retiring or kept table", () => {
    for (const spec of SEED_TABLES) {
      if (spec.onMissing === "delete") continue;
      expect(classifyRow(spec, undefined, { hash: "x" })).not.toBe("delete");
    }
  });

  it("a second sync of the same commit writes 0 rows (idempotency)", () => {
    const seed = new Map([["a", "1"], ["b", "2"]]);
    const first = planTable("tag", seed, new Map());
    expect(first.counts.insert).toBe(2);
    const after = new Map<string, TargetRow>([...seed].map(([k, h]) => [k, { hash: h }]));
    const second = seedPlan(SHA, TARGET, [planTable("tag", seed, after)]);
    expect(planWrites(second)).toBe(0);
    expect(planExitCode(second)).toBe(0);
  });

  it("lists exactly the ids that differ, capped per kind, and formats the dry run", () => {
    const seed = new Map<string, string>([["e1", "1"], ["e2", "2x"], ["e4", "4"]]);
    const target = new Map<string, TargetRow>([["e1", { hash: "1" }], ["e2", { hash: "2" }], ["e3", { hash: "3" }], ["e5", { hash: "5", retired: true }]]);
    const t = planTable("entity", seed, target);
    expect(t.counts).toEqual({ insert: 1, update: 1, retire: 1, delete: 0, unchanged: 1, retained: 1 });
    expect(t.ids).toEqual({ insert: ["e4"], update: ["e2"], retire: ["e3"], delete: [] });
    const plan = seedPlan(SHA, TARGET, [t, planTable("type_node", new Map([["x", "1"]]), new Map())]);
    expect(plan.tables.map((x) => x.table)).toEqual(["type_node", "entity"]);
    expect(planExitCode(plan)).toBe(3);
    const text = formatPlan(plan);
    expect(text).toContain("entity     +1  ~1  -1  x0  =2 (1 retained)");
    expect(text).toContain("  retire: e3");
    expect(text).toContain(`commit ${SHA}; 4 row(s) would be written`);
    const many = planTable("tag", new Map(Array.from({ length: 30 }, (_, i) => [`t${String(i).padStart(2, "0")}`, "h"])), new Map(), 20);
    expect(many.ids.insert).toHaveLength(20);
    expect(formatPlan(seedPlan(SHA, TARGET, [many]))).toContain("(+10 more)");
  });

  it("refuses a plan that names a table outside the seed", () => {
    expect(() => seedPlan(SHA, TARGET, [{ table: "saved_place", counts: { insert: 0, update: 0, retire: 0, delete: 0, unchanged: 0, retained: 0 }, ids: { insert: [], update: [], retire: [], delete: [] } }])).toThrow();
  });
});

describe("drift (db:verify shape)", () => {
  const seed = new Map([["a", "1"], ["b", "2"]]);
  const ok = (m: Map<string, string>): Map<string, TargetRow> => new Map([...m].map(([k, h]) => [k, { hash: h }]));

  it("equal tables hash equal on both sides", () => {
    const t = compareTable("town", seed, ok(seed));
    expect(t.status).toBe("equal");
    expect(t.target!.hash).toBe(t.seed.hash);
  });

  it("reports missing, changed and extra; retained rows are not drift", () => {
    const tag = compareTable("tag", seed, new Map<string, TargetRow>([["a", { hash: "9" }], ["c", { hash: "3" }]]));
    expect(tag.status).toBe("differ");
    expect(tag.sample).toEqual({ missing: ["b"], changed: ["a"], extra: ["c"] });
    const town = compareTable("town", seed, new Map<string, TargetRow>([...ok(seed), ["old", { hash: "x" }]]));
    expect(town.status).toBe("equal");
    expect(town.target!.retained).toBe(1);
    const ent = compareTable("entity", seed, new Map<string, TargetRow>([...ok(seed), ["gone", { hash: "x", retired: true }], ["live", { hash: "y" }]]));
    expect(ent.counts).toEqual({ missing: 0, changed: 0, extra: 1 });
    expect(ent.sample.extra).toEqual(["live"]);
    const unretire = compareTable("entity", seed, new Map<string, TargetRow>([["a", { hash: "1", retired: true }], ["b", { hash: "2" }]]));
    expect(unretire.sample.changed).toEqual(["a"]);
    expect(compareTable("tag", seed, null).status).toBe("missing_table");
  });

  it("the result is ok only with every table equal and every needed migration applied; exit 0 or 1", () => {
    const equal = compareTable("town", seed, ok(seed));
    const base = { commit: SHA, target: TARGET, checkedAt: new Date("2026-10-25T00:00:00Z"), tables: [equal] };
    const good = driftResult({ ...base, requiredMigrations: ["0001", "0003"], appliedMigrations: ["0003", "0001", "0002"] });
    expect(good.ok).toBe(true);
    expect(driftExitCode(good)).toBe(0);
    expect(driftSummary(good)).toEqual({ ok: true, tables: 1, differing: 0 });
    expect(driftResultSchema.parse(JSON.parse(JSON.stringify(good)))).toEqual(good);
    const noMig = driftResult({ ...base, requiredMigrations: ["0001", "0012"], appliedMigrations: ["0001"] });
    expect(noMig.ok).toBe(false);
    expect(noMig.migrations.missing).toEqual(["0012"]);
    const bad = driftResult({ ...base, tables: [equal, compareTable("tag", seed, null)], requiredMigrations: [], appliedMigrations: [] });
    expect(driftExitCode(bad)).toBe(1);
    expect(bad.tables.map((t) => t.table)).toEqual(["tag", "town"]);
    expect(formatDrift(bad)).toContain("verify: 1 table(s) differ");
  });

  it("refuses a URL in place of a target name, kind and host", () => {
    const equal = compareTable("town", seed, ok(seed));
    const run = (target: unknown) => () => driftResult({ commit: SHA, target: target as typeof TARGET, checkedAt: new Date(), requiredMigrations: [], appliedMigrations: [], tables: [equal] });
    expect(run({ ...TARGET, kind: "remote" })).toThrow();
    expect(run({ ...TARGET, host: "postgres://u:p@127.0.0.1:54329/neondb" })).toThrow();
    expect(run({ ...TARGET, name: "postgres://u:p@h/db" })).toThrow();
    expect(() => seedPlan(SHA, { ...TARGET, host: "u:p@host" }, [])).toThrow();
  });
});
