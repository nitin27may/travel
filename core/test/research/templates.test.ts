import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDoc } from "../../src/validate/index.ts";
import { REPO } from "../capture/helpers.ts";

// research/formats/templates/*.json are the shapes a research run copies. validateFile cannot check them in place (it reads every
// JSON under research/ as research-sidecar/1; see research/formats/README.md), so each is validated with validateDoc and the
// document kind its own `schema` string names. A new template needs a row here, or the last test fails.
const DIR = join(REPO, "research", "formats", "templates");
const KIND: Record<string, "capture" | "capture-run"> = { "capture/1": "capture", "capture-run/1": "capture-run" };
const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const load = (f: string) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as Record<string, unknown>;
const check = (doc: unknown) => validateDoc(doc, "sidecar", REPO, { kind: KIND[(doc as { schema: string }).schema] });

describe("research/formats/templates", () => {
  it("holds the templates the formats page names", () => {
    expect(files).toEqual(["capture-points.json", "capture-record.json", "capture-run.json"]);
  });

  for (const f of files.filter((x) => KIND[String(load(x).schema)])) {
    it(`${f} validates with no error against its schema`, () => {
      expect(check(load(f)).errors).toEqual([]);
    });
    it(`${f} fails when a required key is removed`, () => {
      const doc = load(f);
      delete doc[f === "capture-run.json" ? "run" : "records"];
      expect(check(doc).errors.length).toBeGreaterThan(0);
    });
  }

  it("capture-points.json follows the points rules (no core validator reads data/capture/points.json)", () => {
    const d = load("capture-points.json") as { schema: string; points: Record<string, Record<string, unknown>> };
    expect(d.schema).toBe("capture-points/1");
    for (const [ref, p] of Object.entries(d.points)) {
      expect(Object.keys(p).every((k) => ["lat", "lon", "coord_src", "point_source"].includes(k)), ref).toBe(true);
      expect(["lat", "lon", "coord_src"].every((k) => k in p), ref).toBe(true);
      expect(Math.abs(p.lat as number)).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lon as number)).toBeLessThanOrEqual(180);
      expect(["osm", "wikidata", "official", "manual"]).toContain(p.coord_src);
      expect(JSON.stringify(p).toLowerCase(), ref).not.toContain("google");
    }
  });

  it("every JSON template has a schema string this test knows", () => {
    for (const f of files) expect([...Object.keys(KIND), "capture-points/1"], f).toContain(load(f).schema);
  });
});
