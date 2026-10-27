// EG-FX: synthetic graph fixtures (core/test/fixtures/graph/**, README there) run through the real validator and loadWorld. The four
// valid files are four invented parks in different jurisdictions and must validate with no graph code; every file in invalid/ carries
// one deliberate fault and the codes it must raise are listed in expected.json. Nothing here is a real trip or real research.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateDoc } from "../../src/validate/index.ts";
import { emptyIncoming, loadWorld } from "../../src/capture/records.ts";
import { RELATION_RULES } from "../../src/schema/capture/relations.ts";
import { put, scope, scratchRoot } from "./helpers.ts";

const DIR = fileURLToPath(new URL("../fixtures/graph/", import.meta.url));
const readJson = (rel: string) => JSON.parse(readFileSync(join(DIR, rel), "utf8")) as Record<string, any>;
const files = (sub: string) => readdirSync(join(DIR, sub)).filter((f) => f.endsWith(".json")).sort();
const VALID = files("valid");
const INVALID = files("invalid");
const EXPECTED = readJson("expected.json") as Record<string, { errors: string[]; warnings: string[] }>;

const GRAPH = /^(E|W)_CAP_(REL_|VARIANT|REF|STAGE|INHERITED)/;
const codes = (list: { code: string }[]) => [...new Set(list.map((e) => e.code))].filter((c) => GRAPH.test(c)).sort();
const laneOf = (name: string) => `data/capture/graph-fixture/${name}`;

function rootWith(sub: string, names: string[], scopeFrom: string[] = names): string {
  const slugs = new Set<string>();
  for (const n of scopeFrom) for (const r of readJson(`${sub}/${n}`).records) if (/^place\//.test(r.ref)) slugs.add(r.ref.slice(6));
  const root = scratchRoot({
    "data/suitability/scope.json": scope([...slugs]),
    "data/capture/operators.json": readJson("operators.json"),
    "data/capture/gap-budget.json": { schema: "capture-gap-budget/1", note: "", updated: "2026-10-26", strict: [], counts: {}, raised: [], pinned: { on: "2026-10-26", note: "", refs: [] } },
  });
  for (const n of names) put(root, laneOf(n), readJson(`${sub}/${n}`));
  return root;
}
const validate = (root: string, sub: string, name: string) => validateDoc(readJson(`${sub}/${name}`), "sidecar", root, { kind: "capture" }, join(root, laneOf(name)));

describe("graph fixtures: the valid parks", () => {
  const root = rootWith("valid", VALID);
  it("has four parks in different jurisdictions (area ids differ by country-level prefix and region)", () => {
    expect(VALID).toEqual(["park-national.json", "park-provincial.json", "park-straddle.json", "park-system.json"]);
    const areas = VALID.flatMap((n) => readJson(`valid/${n}`).records.flatMap((r: any) => r.covers_areas ?? []));
    expect(new Set(areas.map((a: string) => a.split("/").slice(0, 2).join("/"))).size).toBeGreaterThanOrEqual(4);
  });
  for (const n of VALID) {
    it(`${n} validates with no graph error or warning`, () => {
      const res = validate(root, "valid", n);
      expect(res.errors.filter((e) => GRAPH.test(e.code)), JSON.stringify(res.errors)).toEqual([]);
      expect(res.warnings.filter((e) => GRAPH.test(e.code))).toEqual([]);
    });
  }
  it("every relation rule of entity-graph 5.1 is used by at least one valid record", () => {
    const used = new Set<string>();
    for (const n of VALID) for (const r of readJson(`valid/${n}`).records) for (const k of Object.keys(r)) used.add(k);
    for (const rule of RELATION_RULES) expect(used.has(rule.key), rule.key).toBe(true);
  });

  const w = loadWorld(root);
  const inc = (ref: string) => w.incoming.get(ref) ?? emptyIncoming();
  const part = (r: string, s: string) => `part/place/${r}#${s}`;
  const off = (r: string, s: string) => `offer/place/${r}#${s}`;

  it("members: a park lists its zones and direct members; a zone its lakes; a trek its stages (in file order)", () => {
    expect(inc("place/ridgeback-national-park").members).toEqual(expect.arrayContaining([part("ridgeback-national-park", "north-valley"), part("ridgeback-national-park", "glacier-basin"), part("ridgeback-national-park", "high-traverse")]));
    expect(inc(part("ridgeback-national-park", "north-valley")).members).toEqual(["place/mirror-lake", "place/ridge-pass"]);
    expect(inc(part("ridgeback-national-park", "glacier-basin")).members).toEqual(["place/tarn-lake"]);
    expect(inc(part("ridgeback-national-park", "high-traverse")).members).toEqual([1, 2, 3].map((n) => part("ridgeback-national-park", `traverse-stage-${n}`)));
    expect(inc("place/lakeland-provincial-park").members).toEqual(expect.arrayContaining([part("lakeland-provincial-park", "pine-campground"), part("lakeland-provincial-park", "shore-campground"), part("lakeland-provincial-park", "day-use-beach"), part("lakeland-provincial-park", "three-lake-loop")]));
    // a straddling park: explicit part_of members only; area-id members are the graph index's (EG-I)
    expect(inc("place/twin-rivers-national-park").members).toEqual(["place/border-overlook", "place/east-bank-hub"]);
    expect(inc("place/cedar-point-park").members).toEqual(["place/cedar-point"]);
  });
  it("variants: the primary lists its variant, the variant lists none", () => {
    expect(inc(part("mirror-lake", "ridge-loop")).variants).toEqual([part("mirror-lake", "ridge-loop-short")]);
    expect(inc(part("mirror-lake", "ridge-loop-short")).variants).toEqual([]);
  });
  it("stages: ends_at and starts_at link neighbours through the shared place (a chain, no branch)", () => {
    const rb = "ridgeback-national-park";
    expect(inc(part(rb, "camp-one")).starts_here).toEqual([part(rb, "traverse-stage-2")]);
    expect(inc(part(rb, "camp-one")).ends_here).toEqual([part(rb, "traverse-stage-1")]);
    expect(inc(part(rb, "camp-two")).starts_here).toEqual([part(rb, "traverse-stage-3")]);
    expect(inc(part(rb, "camp-two")).ends_here).toEqual([part(rb, "traverse-stage-2")]);
    expect(inc(part(rb, "far-trailhead")).ends_here).toEqual([part(rb, "traverse-stage-3")]);
    expect(inc(part("mirror-lake", "parking")).starts_here).toEqual([part(rb, "traverse-stage-1"), off(rb, "guided-ridge")]);
  });
  it("offers_at and offers_on: fees at the park, a timed entry at the gated sub-area, a rental at a lake, a guided hike and a permit on routes", () => {
    const rb = "ridgeback-national-park";
    expect(inc(`place/${rb}`).offers_at).toEqual([off(rb, "entry-fee"), off(rb, "vehicle-permit"), off(rb, "traverse-permit"), off(rb, "guided-ridge"), off(rb, "lodge-night")]);
    expect(inc(part(rb, "glacier-basin")).offers_at).toEqual([off(rb, "basin-timed-entry")]);
    expect(inc("place/mirror-lake").offers_at).toEqual([off("mirror-lake", "canoe-rental")]);
    expect(inc(part("mirror-lake", "ridge-loop")).offers_on).toEqual([off(rb, "guided-ridge")]);
    expect(inc(part(rb, "high-traverse")).offers_on).toEqual([off(rb, "traverse-permit")]);
    expect(inc(part("lakeland-provincial-park", "three-lake-loop")).offers_on).toEqual([off("lakeland-provincial-park", "interior-permit")]);
    expect(inc("place/long-lake").offers_at).toEqual([off("long-lake", "canoe-rental")]);
    expect(inc("place/cedar-point-park").offers_at).toEqual([off("cedar-point-park", "system-pass"), off("cedar-point-park", "day-fee")]);
    expect(inc("place/alder-bay-park").offers_at).toEqual([off("cedar-point-park", "system-pass"), off("alder-bay-park", "day-fee")]);
  });
  it("access_points: parking (parks_for) and a stop or launch (serves) both land in access_points", () => {
    expect(inc("place/mirror-lake").access_points).toEqual([part("mirror-lake", "parking"), part("mirror-lake", "shuttle-stop")]);
    expect(inc("place/mirror-lake").parks_for).toEqual([part("mirror-lake", "parking")]);
    expect(inc("place/mirror-lake").serves).toEqual([part("mirror-lake", "shuttle-stop")]);
    expect(inc("place/long-lake").access_points).toEqual([part("long-lake", "launch")]);
  });
  it("covers and included_in: the shared system pass covers both parks' fees; the annual pass covers the vehicle permit; tours and lodging include a fee", () => {
    expect(inc(off("cedar-point-park", "system-pass")).covers).toEqual([off("cedar-point-park", "day-fee"), off("alder-bay-park", "day-fee")]);
    expect(inc(off("lakeland-provincial-park", "annual-pass")).covers).toEqual([off("lakeland-provincial-park", "daily-vehicle-permit")]);
    expect(inc(off("ridgeback-national-park", "entry-fee")).included_in).toEqual([off("ridgeback-national-park", "guided-ridge"), off("ridgeback-national-park", "lodge-night")]);
    expect(inc(off("lakeland-provincial-park", "daily-vehicle-permit")).included_in).toEqual([off("lakeland-provincial-park", "shore-site")]);
  });
  it("reached_by, passed_by, operator_of and the symmetric pairs", () => {
    expect(inc("place/ridge-pass").reached_by).toEqual([part("mirror-lake", "ridge-loop")]);
    expect(inc("place/tarn-lake").passed_by).toEqual([part("mirror-lake", "ridge-loop")]);
    expect(inc("place/far-lake").passed_by).toEqual([part("lakeland-provincial-park", "three-lake-loop")]);
    expect(inc("operator/lakeside-concessions").operator_of).toEqual([part("lakeland-provincial-park", "shore-campground"), off("long-lake", "canoe-rental")]);
    expect(inc("operator/gamma-park-system").operator_of).toEqual(["place/cedar-point-park", "place/alder-bay-park", off("cedar-point-park", "system-pass")]);
    expect(inc(part("west-bank-lake", "shore-walk")).alternative_to).toEqual([part("east-bank-lake", "shore-walk")]);
    expect(inc("place/border-overlook").combo_with).toEqual(["place/east-bank-hub"]);
  });
});

describe("graph fixtures: the invalid records", () => {
  it("expected.json lists every invalid file and nothing else", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(INVALID);
  });
  for (const n of INVALID) {
    it(`${n} raises exactly its listed codes`, () => {
      const root = rootWith("invalid", [n]);
      const res = validate(root, "invalid", n);
      expect({ errors: codes(res.errors), warnings: codes(res.warnings) }, JSON.stringify([...res.errors, ...res.warnings].map((e) => e.message))).toEqual(EXPECTED[n]);
    });
  }
});
