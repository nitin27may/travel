// LOCAL-2: the reference families build from the real data and refuse what they must (no database).
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { areaPath, buildReferenceSeed, SeedInputError } from "../../src/catalogue/postgres/load/reference.ts";
import { fsSource, gitSource } from "../../src/catalogue/postgres/load/files.ts";
import { buildSeed } from "../../src/catalogue/postgres/load/seed.ts";
import { seedMap } from "../../src/catalogue/postgres/load/engine.ts";
import { NEVER_READ_INPUTS, SEED_FORBIDDEN_KEYS, SEED_TABLES, rowRefusals } from "../../src/seed/index.ts";
import { COMMIT, REPO, editJson, overlay } from "./load-helpers.ts";

const json = (rel: string): any => JSON.parse(readFileSync(path.join(REPO, rel), "utf8"));
const built = buildReferenceSeed(fsSource(REPO), COMMIT);
const rows = (t: string) => built.tables.find((x) => x.spec.table === t)!.rows;

describe("reference seed: what it builds", () => {
  it("builds exactly the tables the contract gives LOCAL-2, in the contract's apply order", () => {
    const owned = SEED_TABLES.filter((t) => t.owner === "LOCAL-2").map((t) => t.table);
    expect(built.tables.map((t) => t.spec.table)).toEqual(owned);
    expect(built.refusals).toEqual([]);
  });

  it("has one row per input record", () => {
    const manifest = json("data/reference/towns/manifest.json");
    const loc = json("data/locations/locations.json");
    const countries = new Set(Object.values<any>(json("data/reference/countries.json")).map((c) => c.a2));
    for (const c of loc.countries) countries.add(c.code);
    expect(rows("type_node")).toHaveLength(json("data/vocab/types.json").nodes.length);
    expect(rows("tag")).toHaveLength(json("data/vocab/tags.json").tags.length);
    expect(rows("relevance_class")).toHaveLength(json("data/vocab/relevance-classes.json").classes.length);
    expect(rows("area")).toHaveLength(countries.size + loc.regions.length + loc.areas.length);
    expect(rows("town")).toHaveLength(manifest.totals.rows);
    expect(rows("operator")).toHaveLength(json("data/capture/operators.json").operators.length);
    expect(rows("source")).toHaveLength(json("data/sources/registry.json").entries.length);
    expect(rows("catalogue_meta")).toEqual([{ key: "seed_commit", value: COMMIT }]);
  });

  it("gives every row exactly the columns the table is written with (so the read-back hashes the same)", () => {
    for (const t of built.tables) {
      const names = t.columns.map((c) => c.name).sort();
      for (const r of t.rows) expect(Object.keys(r).sort(), t.spec.table).toEqual(names);
      expect(t.key.every((k) => names.includes(k))).toBe(true);
    }
  });

  it("is deterministic: two builds give the same record ids and hashes", () => {
    const again = buildReferenceSeed(fsSource(REPO), COMMIT);
    for (const t of built.tables) {
      expect([...seedMap(again.tables.find((x) => x.spec.table === t.spec.table)!)]).toEqual([...seedMap(t)]);
    }
  });

  it("puts a parent before its children (type nodes, areas)", () => {
    for (const t of ["type_node", "area"]) {
      const seen = new Set<string>();
      for (const r of rows(t)) {
        if (r.parent_id) expect(seen.has(r.parent_id as string), `${t} ${r.id} before its parent`).toBe(true);
        seen.add(r.id as string);
      }
    }
  });

  it("builds ltree paths and the country, region and area chain", () => {
    expect(areaPath("CA/AB/banff-national-park")).toBe("CA.AB.banff_national_park");
    const area = new Map(rows("area").map((r) => [r.id, r]));
    expect(area.get("CA")).toMatchObject({ level: "country", parent_id: null, path: "CA", iso_code: "CA", iso_a3: "CAN" });
    expect(area.get("CA/AB")).toMatchObject({ level: "region", parent_id: "CA", path: "CA.AB", iso_code: "CA-AB" });
    expect(area.get("CA/AB/banff-national-park")).toMatchObject({ level: "area", parent_id: "CA/AB", slug: "banff-national-park" });
    for (const r of rows("area")) expect(r.path as string).toMatch(/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/);
  });

  it("links a town to its region area when the chain has it, else to nothing", () => {
    const towns = new Map(rows("town").map((r) => [r.id, r]));
    expect(towns.get("ca-ab-banff")).toMatchObject({ cc: "CA", admin1: "ab", region_id: "CA/AB", licence: "CC BY 4.0", is_base: false });
    const ids = new Set(rows("area").map((r) => r.id));
    for (const t of towns.values()) if (t.region_id) expect(ids.has(t.region_id as string)).toBe(true);
    expect(towns.get("ca-ab-banff")!.point).toBe("SRID=4326;POINT(-115.56982 51.17622)");
  });
});

describe("reference seed: privacy and inputs", () => {
  it("reads no file of the deny list and not the towns anchors", () => {
    for (const t of built.tables) for (const f of t.files) {
      expect(f).not.toBe("data/reference/towns/anchors.json");
      expect(NEVER_READ_INPUTS.some((p) => new RegExp(`^${p.replace(/[.]/g, "\\.").replace(/\*/g, "[^/]*")}$`).test(f)), f).toBe(false);
    }
    expect(built.tables.find((t) => t.spec.table === "town")!.files).toContain("data/reference/towns/manifest.json");
  });

  it("carries no origin ref and no owner list key in any row", () => {
    for (const t of built.tables) for (const r of t.rows) expect(rowRefusals(t.spec.table, r)).toEqual([]);
    expect(SEED_FORBIDDEN_KEYS.length).toBeGreaterThan(0);
  });

  it("reads only the countries, regions and areas of the locations store", () => {
    const edits = { "data/locations/locations.json": editJson((d) => { d.places = [{ id: "loc:x", location_status: "wishlist" }]; d.place_tags = "garbage"; }) };
    const again = buildReferenceSeed(overlay(edits), COMMIT);
    expect(again.refusals).toEqual([]);
    expect(again.tables.find((t) => t.spec.table === "area")!.rows).toHaveLength(rows("area").length);
  });

  it("refuses a row that carries the owner's list origin or a private key, before anything is written", () => {
    const tagEdit = (mut: (t: any) => void) => ({ "data/vocab/tags.json": editJson((d) => mut(d.tags[0])) });
    expect(() => buildSeed(overlay(tagEdit((t) => { t.saved = true; })), COMMIT)).toThrow(/E_SEED_PRIVATE_KEY/);
    expect(() => buildSeed(overlay(tagEdit((t) => { t.label = "see loc:abc"; })), COMMIT)).toThrow(/E_SEED_ORIGIN/);
  });

  it("refuses malformed or inconsistent inputs with the file name", () => {
    const fail = (edits: Record<string, (t: string) => string>) => {
      try {
        buildReferenceSeed(overlay(edits), COMMIT);
      } catch (e) {
        expect(e).toBeInstanceOf(SeedInputError);
        return (e as Error).message;
      }
      return "";
    };
    expect(fail({ "data/vocab/types.json": editJson((d) => { d.nodes[5].parent = "nope"; }) })).toMatch(/types\.json: .*unknown parent/);
    expect(fail({ "data/vocab/tags.json": editJson((d) => { d.tags[1].id = d.tags[0].id; }) })).toMatch(/duplicate tag id/);
    expect(fail({ "data/locations/locations.json": editJson((d) => { d.areas[0].region_id = "XX/YY"; }) })).toMatch(/unknown region/);
    expect(fail({ "data/capture/operators.json": editJson((d) => { d.operators[0].ref = "bad ref"; }) })).toMatch(/operators\.json/);
    expect(fail({ "data/reference/towns/ca.json": editJson((d) => { d.rows[0][2] = 123; }) })).toMatch(/out of range/);
    expect(fail({ "data/sources/registry.json": editJson((d) => { d.entries[0].id = "s-nothex"; }) })).toMatch(/registry\.json/);
  });
});

describe("reference seed: committed files", () => {
  const clean = (() => {
    try {
      return execFileSync("git", ["-C", REPO, "status", "--porcelain", "--", "data/vocab", "data/reference", "data/capture/operators.json", "data/sources", "data/locations/locations.json"], { encoding: "utf8" }).trim() === "";
    } catch {
      return false;
    }
  })();

  it.skipIf(!clean)("gives the same rows from the files of HEAD as from the working tree", () => {
    const head = execFileSync("git", ["-C", REPO, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const fromGit = buildReferenceSeed(gitSource(REPO, head), COMMIT);
    for (const t of built.tables) expect([...seedMap(fromGit.tables.find((x) => x.spec.table === t.spec.table)!)]).toEqual([...seedMap(t)]);
  });

  it("refuses a commit that is not a full sha", () => {
    expect(() => gitSource(REPO, "HEAD")).toThrow(/40-hex/);
  });
});
