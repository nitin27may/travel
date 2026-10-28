// The seed contract against the schema it loads into: every table classified, apply order a topological order of the foreign keys,
// retire-never-delete closed over every reference, keys and retire columns real, inputs real and clean.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_APP_TABLES, PUBLIC_READ_TABLES, RLS_EXEMPT_TABLES } from "../../src/db/inventory.ts";
import { loadMigrations } from "../../src/db/loader.ts";
import { META_TABLES } from "../../src/schema/rowMeta.ts";
import {
  DELETE_ORDER,
  FUTURE_TABLES,
  NEVER_READ_INPUTS,
  NOT_SEEDED,
  PRIVATE_CLASSES,
  SEED_TABLES,
  SeedContractError,
  assertDeletable,
  assertSeedTable,
  isPrivateTable,
  isSeedTable,
  isStampedTable,
} from "../../src/seed/contract.ts";
import { expandInputs } from "../../src/seed/io.ts";
import { inputRefusals, rowRefusals } from "../../src/seed/privacy.ts";
import { createdTables, hasColumn, renamedTables, schemaTables, tableReferences, type CreatedTable } from "../../src/seed/schemaRefs.ts";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const seedNames = SEED_TABLES.map((t) => t.table);
const notSeeded = Object.keys(NOT_SEEDED);
const created: CreatedTable[] = schemaTables(loadMigrations());
const byName = new Map(created.map((t) => [t.name, t]));
const refs = tableReferences(created);

describe("classification: seed allowlist and never-seeded list", () => {
  it("are disjoint", () => {
    expect(seedNames.filter((t) => notSeeded.includes(t))).toEqual([]);
    expect(new Set(seedNames).size).toBe(seedNames.length);
  });

  it("cover ALL_APP_TABLES plus RLS_EXEMPT_TABLES exactly (a new table must be classified)", () => {
    const inventory = [...ALL_APP_TABLES, ...RLS_EXEMPT_TABLES].sort();
    const classified = new Set([...seedNames, ...notSeeded]);
    expect(inventory.filter((t) => !classified.has(t))).toEqual([]);
    // the other way: a classified table is in the inventory, or a named future table
    expect([...classified].filter((t) => !inventory.includes(t) && !FUTURE_TABLES.includes(t)).sort()).toEqual([]);
  });

  it("follow a table rename: the migrations leave plan_draft and plan_draft_signal, never the old names", () => {
    expect(renamedTables("alter table a rename to b; -- alter table c rename to d;\nalter table b rename constraint x to y;")).toEqual([{ from: "a", to: "b" }]);
    expect(schemaTables([{ sql: "create table a (id int);" }, { sql: "alter table a rename to b;" }]).map((t) => t.name)).toEqual(["b"]);
    const names = created.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["plan_draft", "plan_draft_signal"]));
    expect(names.filter((n) => n.startsWith("planner"))).toEqual([]);
  });

  it("cover every table the migrations create (a migration cannot add an unclassified table)", () => {
    const classified = new Set([...seedNames, ...notSeeded]);
    expect(created.length).toBeGreaterThan(80);
    expect(created.map((t) => t.name).filter((n) => !classified.has(n))).toEqual([]);
  });

  it("fails for an unclassified table, as a new migration would", () => {
    const fake = createdTables("create table account_secret_thing (id text primary key);");
    const classified = new Set([...seedNames, ...notSeeded]);
    expect(fake.map((t) => t.name).filter((n) => !classified.has(n))).toEqual(["account_secret_thing"]);
  });

  it("never puts a private table, or a household table, on the allowlist", () => {
    for (const t of seedNames) expect(isPrivateTable(t)).toBe(false);
    for (const t of ["app_user", "plan_draft", "plan_draft_signal", "saved_place", "saved_source", "trip", "reservation_secret", "household", "person", "visit", "collection"]) {
      expect(isPrivateTable(t)).toBe(true);
      expect(isSeedTable(t)).toBe(false);
    }
    expect(PRIVATE_CLASSES).toEqual(["account", "plan", "household"]);
  });

  it("seeds no table that has an owner, household or trip column", () => {
    for (const t of SEED_TABLES) {
      const body = byName.get(t.table)!.body;
      for (const col of ["household_id", "user_id", "owner_id", "trip_id"]) expect(hasColumn(byName.get(t.table)!, col), `${t.table}.${col}`).toBe(false);
      expect(body).not.toMatch(/references\s+(household|trip|plan_draft)\(/);
    }
  });

  it("seeds every public-read table except condition reports and event dates, which have no JSON family yet", () => {
    const unsourced = PUBLIC_READ_TABLES.filter((t) => !isSeedTable(t));
    expect(unsourced.sort()).toEqual(["condition_report", "event_occurrence"]);
    for (const t of unsourced) expect(NOT_SEEDED[t]!.class).toBe("unsourced");
  });

  it("refuses to touch a table outside the allowlist", () => {
    expect(() => assertSeedTable("saved_place")).toThrow(/household/);
    expect(() => assertSeedTable("no_such_table")).toThrow(SeedContractError);
    expect(assertSeedTable("town").table).toBe("town");
  });
});

describe("apply order", () => {
  it("is a topological order of the foreign keys between seed tables", () => {
    const pos = new Map(seedNames.map((t, i) => [t, i]));
    const bad = refs.filter((r) => pos.has(r.from) && pos.has(r.to) && r.from !== r.to && pos.get(r.to)! > pos.get(r.from)!);
    expect(bad).toEqual([]);
    // the check has teeth: the seed tables point at each other many times
    expect(refs.filter((r) => pos.has(r.from) && pos.has(r.to) && r.from !== r.to).length).toBeGreaterThan(15);
  });

  it("starts with the vocab and ends with the revision; deletes run in reverse", () => {
    expect(seedNames.slice(0, 3)).toEqual(["type_node", "tag", "relevance_class"]);
    expect(seedNames.at(-1)).toBe("catalogue_meta");
    expect(DELETE_ORDER[0]).toBe("catalogue_meta");
    expect(DELETE_ORDER).toEqual([...seedNames].reverse());
  });
});

describe("retire, never delete", () => {
  const spec = new Map(SEED_TABLES.map((t) => [t.table, t]));

  it("never deletes a seed table that a table outside the seed points at (saved_place, trip_item, reservation, trips)", () => {
    const pointed = refs.filter((r) => !spec.has(r.from) && spec.has(r.to)).map((r) => r.to);
    expect([...new Set(pointed)].sort()).toEqual(["area", "entity", "offer", "source"]);
    for (const t of pointed) expect(spec.get(t)!.onMissing, t).not.toBe("delete");
  });

  it("never deletes a row a retained row still points at (closure over retire and keep)", () => {
    for (const r of refs) {
      const from = spec.get(r.from);
      const to = spec.get(r.to);
      if (!from || !to || r.from === r.to) continue;
      if (from.onMissing !== "delete") expect(to.onMissing, `${r.from} -> ${r.to}`).not.toBe("delete");
    }
  });

  it("retires entity and offer through a real status column, and refuses their deletion", () => {
    for (const t of ["entity", "offer"]) {
      const s = spec.get(t)!;
      expect(s.onMissing).toBe("retire");
      expect(hasColumn(byName.get(t)!, s.retire!.column)).toBe(true);
      expect(() => assertDeletable(t)).toThrow(/retired/);
    }
    expect(byName.get("entity")!.body).toMatch(/'retired'/);
    expect(() => assertDeletable("area")).toThrow(/kept/);
    expect(() => assertDeletable("evidence")).toThrow(/kept/);
    expect(assertDeletable("relation").table).toBe("relation");
  });

  it("knows saved_place cascades on entity delete (the reason for the rule)", () => {
    expect(refs).toContainEqual({ from: "saved_place", to: "entity", column: "id", cascade: true });
  });
});

describe("keys, columns, stamps", () => {
  it("every key, set and geometry column exists in the table's create statement", () => {
    for (const t of SEED_TABLES) {
      const table = byName.get(t.table);
      expect(table, t.table).toBeDefined();
      for (const c of [...t.key, ...(t.setColumns ?? []), ...(t.geometryColumns ?? [])]) expect(hasColumn(table!, c), `${t.table}.${c}`).toBe(true);
    }
  });

  it("append-only is evidence only, and it is never removed", () => {
    expect(SEED_TABLES.filter((t) => t.mode === "append_only").map((t) => t.table)).toEqual(["evidence"]);
    expect(SEED_TABLES.find((t) => t.table === "evidence")!.onMissing).toBe("keep");
  });

  it("stamps exactly the seed tables that carry RowMeta", () => {
    const stamped = seedNames.filter(isStampedTable).sort();
    const expected = (META_TABLES as readonly string[]).filter((t) => seedNames.includes(t)).sort();
    expect(stamped).toEqual(expected);
    // every RowMeta table that is not seeded is unsourced today
    for (const t of META_TABLES) if (!seedNames.includes(t)) expect(NOT_SEEDED[t]?.class, t).toBe("unsourced");
  });

  it("computed tables read no files, file-backed tables read at least one", () => {
    for (const t of SEED_TABLES) {
      if (t.mode === "derived" || t.mode === "revision") expect(t.inputs, t.table).toEqual([]);
      else expect(t.inputs.length, t.table).toBeGreaterThan(0);
    }
  });
});

describe("inputs", () => {
  it("every non-optional input resolves to files in the repository today", () => {
    for (const t of SEED_TABLES) {
      for (const input of t.inputs) {
        if (input.optional) continue;
        expect(expandInputs(ROOT, [input]).files.length, `${t.table}: ${input.glob}`).toBeGreaterThan(0);
      }
    }
  });

  it("resolves the lane files without runs, splits or changesets, and towns without the anchors", () => {
    const lanes = expandInputs(ROOT, SEED_TABLES.find((t) => t.table === "offer")!.inputs).files;
    expect(lanes.some((f) => f.endsWith("/migrated.json"))).toBe(true);
    expect(lanes.filter((f) => /\/(runs|splits|changesets)\//.test(f))).toEqual([]);
    const towns = expandInputs(ROOT, SEED_TABLES.find((t) => t.table === "town")!.inputs);
    expect(towns.files).not.toContain("data/reference/towns/anchors.json");
    expect(towns.denied).toEqual([]);
  });

  it("the deny list refuses the owner's list derivatives and repository ledgers", () => {
    expect(inputRefusals("data/reference/towns/anchors.json")[0]?.code).toBe("E_SEED_DENIED_INPUT");
    expect(inputRefusals("research/inbox/2026-10-16-batch.json")[0]?.code).toBe("E_SEED_DENIED_INPUT");
    expect(inputRefusals("data/capture/migration-ledger.json")).toHaveLength(1);
    expect(inputRefusals("data/relevance/inputs/private-origin.local.json")).toHaveLength(1);
    expect(inputRefusals("data/vocab/tags.json")).toEqual([]);
    // a glob that would reach a denied file reports it instead of returning it
    const r = expandInputs(ROOT, [{ glob: "data/reference/towns/*.json" }]);
    expect(r.denied).toEqual(["data/reference/towns/anchors.json"]);
    expect(NEVER_READ_INPUTS.length).toBeGreaterThan(3);
  });

  it("the locations store is read for its public area chain only", () => {
    const area = SEED_TABLES.find((t) => t.table === "area")!;
    const store = area.inputs.find((i) => i.glob === "data/locations/locations.json")!;
    expect(store.sections).toEqual(["countries", "regions", "areas"]);
    for (const t of SEED_TABLES) for (const i of t.inputs) if (t.table !== "area") expect(i.glob).not.toContain("locations.json");
  });

  it("no seed input file today carries a private-list origin or a forbidden key", () => {
    const files = expandInputs(ROOT, SEED_TABLES.flatMap((t) => t.inputs.filter((i) => !i.sections))).files;
    expect(files.length).toBeGreaterThan(100);
    const hits = files.flatMap((f) => rowRefusals(f, JSON.parse(readFileSync(path.join(ROOT, f), "utf8")), 3));
    expect(hits).toEqual([]);
  });
});

describe("row refusals", () => {
  it("refuses an origin ref and the owner's list keys, naming the path, never the value", () => {
    const r = rowRefusals("entity", { id: "x", attrs: { from: "loc:abc-123" }, deep: [{ location_status: "planned" }] });
    expect(r.map((x) => x.code)).toEqual(["E_SEED_ORIGIN", "E_SEED_PRIVATE_KEY"]);
    expect(r.map((x) => x.where)).toEqual(["entity.attrs.from", "entity.deep[0].location_status"]);
    expect(JSON.stringify(r)).not.toContain("abc-123");
    expect(JSON.stringify(r)).not.toContain("planned");
  });
});
