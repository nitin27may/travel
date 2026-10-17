import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { REGISTRY } from "../src/schema/index.ts";
import { generate } from "../src/schema/generate.ts";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const BIN = join(REPO, "core", "bin", "schema.ts");
const GENERATED = join(REPO, "data", "schema", "generated");
const tmp: string[] = [];
const run = (...args: string[]) => spawnSync("node", [BIN, ...args], { encoding: "utf8" });
const scratch = () => {
  const d = mkdtempSync(join(tmpdir(), "p2a-gen-"));
  tmp.push(d);
  return d;
};
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("schema generate", () => {
  it("--check passes on the committed files", () => {
    const r = run("generate", "--check");
    expect(r.status, r.stderr).toBe(0);
  });

  it("--check fails with a diff when a committed file differs", () => {
    const root = scratch();
    expect(run("generate", "--root", root).status).toBe(0);
    const f = join(root, "data", "schema", "generated", "schema.sql");
    writeFileSync(f, readFileSync(f, "utf8").replace("CREATE TABLE areas", "CREATE TABLE areas_edited"));
    const r = run("generate", "--check", "--root", root);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("-CREATE TABLE areas_edited");
    expect(r.stderr).toContain("+CREATE TABLE areas (");
  });

  it("output is byte-stable across two runs", () => {
    const a = generate();
    const b = generate();
    expect(b).toEqual(a);
    const r1 = scratch();
    const r2 = scratch();
    run("generate", "--root", r1);
    run("generate", "--root", r2);
    for (const f of ["schema.json", "schema.sql"]) {
      const p = (r: string) => readFileSync(join(r, "data", "schema", "generated", f), "utf8");
      expect(p(r1)).toBe(p(r2));
      expect(p(r1)).toBe(readFileSync(join(GENERATED, f), "utf8"));
      expect(p(r1).endsWith("\n")).toBe(true);
      expect(p(r1).includes("\r")).toBe(false);
    }
  });

  it("keeps $defs sorted and keyed family.table", () => {
    const schema = JSON.parse(readFileSync(join(GENERATED, "schema.json"), "utf8"));
    const keys = Object.keys(schema.$defs);
    expect(keys).toEqual([...keys].sort((x, y) => x.localeCompare(y)));
    expect(keys).toEqual(REGISTRY.map((t) => t.key).sort((x, y) => x.localeCompare(y)));
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  });

  it("copies every table meta key into schema.json", () => {
    const schema = JSON.parse(readFileSync(join(GENERATED, "schema.json"), "utf8"));
    for (const t of REGISTRY) {
      const def = schema.$defs[t.key];
      expect(def["x-pk"], t.key).toEqual(t.meta.pk);
      expect(def["x-family"], t.key).toBe(t.family);
      expect(def["x-sql"], t.key).toEqual(t.meta.sql);
      expect(def["x-ui"], t.key).toEqual(t.meta.ui);
      expect(def["x-private"], t.key).toEqual(t.meta.private);
      expect(def["x-rules"], t.key).toEqual(t.meta.rules);
      expect(def["x-single"], t.key).toBe(t.meta.single === true);
      expect(def.additionalProperties, `${t.key} must be strict`).toBe(false);
    }
  });

  it("carries column metadata (type, fk, private, ui) onto the properties", () => {
    const schema = JSON.parse(readFileSync(join(GENERATED, "schema.json"), "utf8"));
    const items = schema.$defs["trip.items"].properties;
    expect(items.start["x-type"]).toBe("hhmm");
    expect(items.trail_id["x-fk"]).toBe("trails.id");
    expect(items.type["x-ui"].facet).toBe(true);
    expect(schema.$defs["trip.trip_bookings"].properties.confirmation["x-private"]).toBe(true);
  });

  it("emits DDL features: scoped keys, enum checks, json checks, indexes", () => {
    const sql = readFileSync(join(GENERATED, "schema.sql"), "utf8");
    expect(sql).toContain("trip_id TEXT NOT NULL REFERENCES trips(slug)");
    expect(sql).toContain("PRIMARY KEY (trip_id, id)");
    expect(sql).toContain("FOREIGN KEY (trip_id, base_id) REFERENCES bases(trip_id, id)");
    expect(sql).toContain("CHECK (json_valid(season_months))");
    expect(sql).toContain("CHECK (track IN ('A', 'B', 'C', 'P'))");
    expect(sql).toContain("CHECK ((lat IS NULL) = (lon IS NULL))");
    expect(sql).toContain("CREATE INDEX idx_trips_owner_id ON trips (owner_id);");
    expect(sql).toContain("CREATE INDEX idx_trails_review_status ON trails (review_status);");
    expect(sql).toContain("CREATE INDEX idx_stays_area_id ON stays (area_id);");
    expect(sql).toContain("CREATE TABLE trip_sources (");
    expect(sql).toContain("CREATE TABLE catalog_sources (");
    expect(sql).toContain('"end" TEXT NOT NULL');
  });
});
