import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Family } from "../../src/schema/meta.ts";
import { validateDoc } from "../../src/validate/index.ts";
import type { DocInfo } from "../../src/validate/index.ts";
import { REPO } from "../capture/helpers.ts";

// research/formats/templates/*.json are the shapes a research run copies. validateFile cannot check them in place (it reads every
// JSON under research/ as research-sidecar/1; see research/formats/README.md), so each is validated with validateDoc and the
// family and document kind its schema names. A trip file has no `schema` string: it is `trip/<schema_version>` here (the
// validator detects it by its `trip` and `profile` keys). A new template needs a row here, or the last test fails.
const DIR = join(REPO, "research", "formats", "templates");
const KIND: Record<string, { family: Family; kind?: DocInfo["kind"] }> = {
  "capture/1": { family: "sidecar", kind: "capture" },
  "capture-run/1": { family: "sidecar", kind: "capture-run" },
  "trip/1": { family: "trip" },
};
/** the key whose removal must fail each template */
const REQUIRED: Record<string, string> = { "capture-run.json": "run", "capture-record.json": "records", "trip.json": "items" };
const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const load = (f: string) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as Record<string, unknown>;
const schemaOf = (doc: Record<string, unknown>): string =>
  typeof doc.schema === "string" ? doc.schema : "trip" in doc && "profile" in doc ? `trip/${String(doc.schema_version)}` : "";
const check = (doc: Record<string, unknown>) => {
  const k = KIND[schemaOf(doc)]!;
  return validateDoc(doc, k.family, REPO, k.kind ? { kind: k.kind } : {});
};

describe("research/formats/templates", () => {
  it("holds the templates the formats page names", () => {
    expect(files).toEqual(["capture-points.json", "capture-record.json", "capture-run.json", "trip.json"]);
  });

  for (const f of files.filter((x) => KIND[schemaOf(load(x))])) {
    it(`${f} validates with no error against its schema`, () => {
      expect(check(load(f)).errors).toEqual([]);
    });
    it(`${f} fails when a required key is removed`, () => {
      const doc = load(f);
      expect(REQUIRED[f], `${f} needs a row in REQUIRED`).toBeDefined();
      delete doc[REQUIRED[f]!];
      expect(check(doc).errors.length).toBeGreaterThan(0);
    });
  }

  it("trip.json is a public, dateless template (data/trips/README.md): planner tables empty, no household value", () => {
    const d = load("trip.json") as Record<string, Record<string, unknown> | unknown[]>;
    const trip = d.trip as Record<string, unknown>;
    expect(trip.visibility).toBe("public");
    expect(trip.origin).toBe("");
    for (const t of ["travellers", "editions", "trip_bookings", "budget", "fx", "fare_windows", "fare_quotes", "documents", "emergency", "notes", "packing", "questions"]) {
      expect(d[t], t).toEqual([]);
    }
  });

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
    for (const f of files) expect([...Object.keys(KIND), "capture-points/1"], f).toContain(schemaOf(load(f)));
  });
});
