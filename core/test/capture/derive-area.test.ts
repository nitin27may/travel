// `capture.ts derive-area` (capture contract 3.7.1): area_id from the parent, else from the sourced point against the registry's areas;
// the hold-out accuracy test on a frozen copy of the records that had an authored area; idempotent; only the area_id key changes.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AREA_DERIVATION } from "../../src/config/area.ts";
import { DERIVED_AREAS_PATH, decideAreas, familyOf, holdOutAccuracy, loadAreaInput, planAreaDerivation, pointDecision } from "../../src/capture/deriveArea.ts";
import type { AreaInput, AreaLabel, AreaSubject } from "../../src/capture/deriveArea.ts";
import { deriveAreaCommand } from "../../src/capture/deriveAreaCli.ts";
import { budgetCounts } from "../../src/capture/gapBudget.ts";
import { loadPlacement } from "../../src/capture/placementBlock.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { REPO, capDoc, put, scratchRoot } from "./helpers.ts";

// one degree of latitude is about 111.2 km, so 0.01 degrees is about 1.1 km
const KM = 1 / 111.2;
const subject = (ref: string, lat: number | null, over: Partial<AreaSubject> = {}): AreaSubject => ({ ref, trip: "fx", point: lat === null ? null : { lat, lon: 10, approx: false }, town: null, parents: [], authored: null, ...over });
const towns = { "xx-aa-alpha": { lat: 46, lon: 10, region: "XX/AA" }, "xx-aa-beta": { lat: 46 + 30 * KM, lon: 10, region: "XX/AA" }, "xx-bb-gamma": { lat: 46 + 2 * KM, lon: 10, region: "unregistered:XX-BB" } };
const areaRegion = { "XX/AA/park": "XX/AA", "XX/AA/valley": "XX/AA" };
const input = (subjects: AreaSubject[], storeLabels: AreaLabel[] = []): AreaInput => ({ subjects, storeLabels, towns, areaRegion });

describe("the point rule", () => {
  const park = subject("place/park-a", 46, { authored: "XX/AA/park", town: "xx-aa-alpha" });
  it("takes the area of the nearest label within the radius, with the distances", () => {
    const d = decideAreas(input([park, subject("place/near", 46 + 4 * KM, { town: "xx-aa-alpha" })])).get("place/near")!;
    expect(d).toMatchObject({ area: "XX/AA/park", via: "point", from: "place/park-a", reason: null });
    expect(d.km).toBeCloseTo(4, 0);
  });
  it("leaves a point beyond the radius a gap, as a proposal (never the nearest area at any distance)", () => {
    const far = subject("place/far", 46 + (AREA_DERIVATION.radiusKm + 2) * KM);
    expect(decideAreas(input([park, far])).get("place/far")).toMatchObject({ area: null, reason: "no_area_within_radius" });
  });
  it("refuses a point between two areas without a clear margin", () => {
    const valley = subject("place/valley-a", 46 + 8 * KM, { authored: "XX/AA/valley" });
    const mid = subject("place/mid", 46 + 3 * KM);
    expect(decideAreas(input([park, valley, mid])).get("place/mid")).toMatchObject({ area: null, reason: "ambiguous" });
    const close = subject("place/close", 46 + 1 * KM);
    expect(decideAreas(input([park, valley, close])).get("place/close")).toMatchObject({ area: "XX/AA/park" });
  });
  it("refuses an area of another region than the nearest town's, also a region the registry lacks", () => {
    const over = subject("place/over-the-border", 46 + 2 * KM, { town: "xx-bb-gamma" });
    expect(decideAreas(input([park, over])).get("place/over-the-border")).toMatchObject({ area: null, reason: "region_mismatch", region: "unregistered:XX-BB" });
  });
  it("refuses a point whose nearest town lies outside the area (the Canmore case: close to Banff, but Canmore is not in it)", () => {
    const edge = subject("place/edge", 46 + 9 * KM, { town: "xx-aa-beta" });
    expect(decideAreas(input([park, edge])).get("place/edge")).toMatchObject({ area: null, reason: "town_outside_area" });
    // the same point passes once a label of the area names that town
    const inside = subject("place/park-b", 46 + 12 * KM, { authored: "XX/AA/park", town: "xx-aa-beta" });
    expect(decideAreas(input([park, inside, edge])).get("place/edge")).toMatchObject({ area: "XX/AA/park" });
  });
  it("reads a store place as a label like an authored record", () => {
    const store: AreaLabel = { area: "XX/AA/valley", lat: 46, lon: 10, town: null, from: "locations store" };
    expect(decideAreas(input([subject("place/x", 46 + KM)], [store])).get("place/x")).toMatchObject({ area: "XX/AA/valley", from: "locations store" });
  });
  it("gives a record with no point (and no parent) nothing", () => {
    expect(pointDecision(subject("place/none", null), [], input([]))).toMatchObject({ area: null, reason: "no_point" });
  });
  it("never lets a derived area label another record, so labels cannot hop from area to area", () => {
    const b = subject("place/b", 46 + 8 * KM);
    const c = subject("place/c", 46 + 16 * KM);
    const ds = decideAreas(input([park, b, c]));
    expect(ds.get("place/b")!.area).toBe("XX/AA/park");
    expect(ds.get("place/c")).toMatchObject({ area: null, reason: "no_area_within_radius" });
  });
});

describe("the parent", () => {
  const park = subject("place/park-a", 46, { authored: "XX/AA/park" });
  const valley = subject("place/valley-a", 47, { authored: "XX/AA/valley" });
  it("comes before the point: a part takes its parent's area even where its own point would say another", () => {
    const part = subject("part/place/valley-a#viewpoint", 46 + KM, { parents: ["place/valley-a"] });
    expect(decideAreas(input([park, valley, part])).get("part/place/valley-a#viewpoint")).toMatchObject({ area: "XX/AA/valley", via: "parent", from: "place/valley-a" });
  });
  it("chains through a parent that was itself placed by its point", () => {
    const parent = subject("place/lake", 46 + 2 * KM);
    const part = subject("part/place/lake#parking", null, { parents: ["place/lake"] });
    expect(decideAreas(input([park, parent, part])).get("part/place/lake#parking")).toMatchObject({ area: "XX/AA/park", via: "parent" });
  });
  it("leaves a record whose parents disagree a gap", () => {
    const both = subject("place/both", 46.5, { parents: ["place/park-a", "place/valley-a"] });
    expect(decideAreas(input([park, valley, both])).get("place/both")).toMatchObject({ area: null, reason: "parents_disagree" });
  });
  it("families group a part with the record it was cut out of", () => {
    expect(familyOf("part/place/lake#parking")).toBe("place/lake");
    expect(familyOf("place/lake")).toBe("place/lake");
  });
});

describe("the hold-out accuracy test on the frozen known records (25 Oct 2026)", () => {
  // the 67 place and route records that had an authored area_id when the rule was built, with their trips' other records (parents),
  // the store labels near them and the towns they name: core/test/fixtures/derive-area/known-2026-10-25.json
  const frozen = JSON.parse(readFileSync(new URL("../fixtures/derive-area/known-2026-10-25.json", import.meta.url), "utf8")) as AreaInput;
  it("matches the authored area on at least the gated share of the answers, with each record and its family hidden", () => {
    const fam = holdOutAccuracy(frozen, "family");
    expect(fam.known).toBe(67);
    expect(fam.precision).toBeGreaterThanOrEqual(AREA_DERIVATION.minPrecision);
    // the measured numbers (research/runs/AREA-derive-area.md): a change of rule or thresholds shows here first
    expect([fam.answered, fam.matched]).toEqual([44, 43]);
    expect(fam.confusion.map((c) => [c.ref, c.known, c.derived])).toEqual([["place/viel-dal-pan", "IT/veneto/belluno", "IT/trentino-alto-adige/provincia-di-trento"]]);
  });
  it("matches with only the record itself hidden (its parents and siblings keep their areas)", () => {
    const one = holdOutAccuracy(frozen, "one");
    expect(one.precision).toBeGreaterThanOrEqual(AREA_DERIVATION.minPrecision);
    expect([one.known, one.answered, one.matched]).toEqual([67, 56, 55]);
  });
  it("would put Canmore trails in Banff with a 15 km radius: the radius is the fence the test cannot see", () => {
    const wide = { ...AREA_DERIVATION, radiusKm: 15 };
    expect(holdOutAccuracy(frozen, "family", wide).precision).toBeGreaterThanOrEqual(AREA_DERIVATION.minPrecision);
    const canmore = frozen.subjects.find((s) => s.ref === "legacy/canadian-rockies-sept-2029/trails/ha-ling-peak")!;
    expect(decideAreas(frozen, wide).get(canmore.ref)!.area).toBe("CA/AB/banff-national-park");
    expect(decideAreas(frozen).get(canmore.ref)!.area).toBeNull();
  });
});

// ----- the files ------------------------------------------------------------------------------------------------------------------------

const part = JSON.stringify({ schema: "towns-part/1", cc: "xx", admin1: { aa: "Alpha Land" }, rows: [["xx-aa-alpha", "Alpha", 46, 10, 5000, "aa", "Alpha", 1001]] }) + "\n";
const manifest = { schema: "towns-manifest/1", source: { name: "GeoNames", downloaded: "2026-10-23", licence: { id: "CC BY 4.0", attribution: "x", url: "x" }, files: {} }, filter: { population_min: 1000 }, parts: [{ file: "xx.json", cc: "xx", rows: 1, gzip: 100, sha256: createHash("sha256").update(part).digest("hex") }], totals: { parts: 1, rows: 1, bytes: part.length, gzip: 100 } };
const store = {
  schema_version: 3, layout: "single",
  countries: [{ code: "XX", name: "Exland" }],
  regions: [{ id: "XX/AA", country: "XX", code: "AA", name: "Alpha Land", iso_3166_2: "XX-AA" }],
  areas: [{ id: "XX/AA/park", region_id: "XX/AA", slug: "park", name: "Park" }, { id: "XX/AA/valley", region_id: "XX/AA", slug: "valley", name: "Valley" }],
  places: [{ id: "XX/AA/valley/far-lake", area_id: "XX/AA/valley", name: "Far Lake", lat: 47, lon: 10 }],
};
const rec = (ref: string, over: Record<string, unknown> = {}) => ({ ref, type: "water.body.lake", layer: "place", name: ref, ...over });
const pt = (lat: number) => ({ lat, lon: 10, coord_src: "osm", point_source: "OSM node 1" });
const sink = () => { const lines: string[] = []; return { lines, out: (s: string) => void lines.push(s), err: (s: string) => void lines.push(s) }; };

function fixture(records: unknown[], points: Record<string, unknown>): string {
  return scratchRoot({
    "data/reference/towns/xx.json": part,
    "data/reference/towns/manifest.json": manifest,
    "data/locations/locations.json": store,
    "data/capture/points.json": { schema: "capture-points/1", points },
    "data/capture/fx/a.json": capDoc(records, { trip: "fx" }),
  });
}
const records = [
  rec("place/park-a", { area_id: "XX/AA/park" }),
  rec("place/park-b", { area_id: "XX/AA/park" }),
  rec("place/near"),
  rec("part/place/near#parking"),
  rec("place/far"),
  rec("place/kept", { area_id: "XX/AA/valley" }),
];
const points = { "place/park-a": pt(46), "place/park-b": pt(46 + 0.5 * KM), "place/near": pt(46 + 3 * KM), "place/far": pt(46.5), "place/kept": pt(46.3) };

describe("derive-area on a fixture", () => {
  it("--check exits 1, --write adds only area_id lines after each ref and the ledger, a second run finds nothing", () => {
    const root = fixture(records, points);
    const file = join(root, "data/capture/fx/a.json");
    const before = readFileSync(file, "utf8");
    const io = sink();
    expect(deriveAreaCommand(["--check"], root, io.out, io.err)).toBe(1);
    expect(deriveAreaCommand(["--write"], root, io.out, io.err)).toBe(0);
    const after = readFileSync(file, "utf8");
    // the diff is two inserted lines, each right after the ref line of its record
    expect(after).toContain('"ref": "place/near",\n      "area_id": "XX/AA/park",');
    expect(after).toContain('"ref": "part/place/near#parking",\n      "area_id": "XX/AA/park",');
    const back = after.replace('"ref": "place/near",\n      "area_id": "XX/AA/park",', '"ref": "place/near",').replace('"ref": "part/place/near#parking",\n      "area_id": "XX/AA/park",', '"ref": "part/place/near#parking",');
    expect(back).toBe(before);
    const now = JSON.parse(after).records as Record<string, unknown>[];
    expect(now.find((r) => r.ref === "place/far")!.area_id).toBeUndefined();
    expect(now.find((r) => r.ref === "place/kept")!.area_id).toBe("XX/AA/valley");
    const ledger = JSON.parse(readFileSync(join(root, DERIVED_AREAS_PATH), "utf8"));
    expect(ledger.basis).toBe("our_inference");
    expect(ledger.areas["place/near"]).toMatchObject({ area_id: "XX/AA/park", via: "point", from: "place/park-b" });
    expect(ledger.areas["part/place/near#parking"]).toEqual({ area_id: "XX/AA/park", via: "parent", from: "place/near" });
    expect(deriveAreaCommand(["--check"], root, io.out, io.err)).toBe(0);
    expect(planAreaDerivation(root).writes).toEqual([]);
  });

  it("follows the labels: a value it wrote changes when the evidence does; a hand-set value is authored and never touched", () => {
    const root = fixture(records, points);
    deriveAreaCommand(["--write"], root, () => {}, () => {});
    // move the near record next to the valley place: its derived area follows, its part follows the parent
    put(root, "data/capture/points.json", { schema: "capture-points/1", points: { ...points, "place/near": pt(47 + KM) } });
    const plan = planAreaDerivation(root);
    expect(plan.changes.map((c) => [c.ref, c.from, c.to])).toEqual([["part/place/near#parking", "XX/AA/park", "XX/AA/valley"], ["place/near", "XX/AA/park", "XX/AA/valley"]]);
    deriveAreaCommand(["--write"], root, () => {}, () => {});
    // a person sets another area by hand: it is now authored, and the ledger lets go of it
    const file = join(root, "data/capture/fx/a.json");
    put(root, "data/capture/fx/a.json", readFileSync(file, "utf8").replace('"ref": "place/near",\n      "area_id": "XX/AA/valley"', '"ref": "place/near",\n      "area_id": "XX/AA/park"'));
    const again = planAreaDerivation(root);
    expect(again.changes.map((c) => c.ref)).toEqual(["part/place/near#parking"]);
    // (the CLI would refuse this write: the hand-set park contradicts the valley label next to it, so the hold-out gate fails)
    for (const w of again.writes) writeFileSync(w.path, w.text);
    const ledger = JSON.parse(readFileSync(join(root, DERIVED_AREAS_PATH), "utf8"));
    expect(ledger.areas["place/near"]).toBeUndefined();
    expect(JSON.parse(readFileSync(file, "utf8")).records.find((r: { ref: string }) => r.ref === "place/near").area_id).toBe("XX/AA/park");
  });

  it("--trip limits the writes to one trip", () => {
    const root = scratchRoot({
      "data/reference/towns/xx.json": part, "data/reference/towns/manifest.json": manifest, "data/locations/locations.json": store,
      "data/capture/points.json": { schema: "capture-points/1", points: { ...points, "place/other": pt(46 + 2 * KM) } },
      "data/capture/fx/a.json": capDoc(records, { trip: "fx" }),
      "data/capture/fy/a.json": capDoc([rec("place/other")], { trip: "fy" }),
    });
    expect(planAreaDerivation(root, { trip: "fy" }).changes.map((c) => c.ref)).toEqual(["place/other"]);
  });

  it("lowers the E_PLACE_AREA count by the records it placed", () => {
    const root = fixture(records, points);
    const count = (): number => budgetCounts(loadPlacement(root, loadWorld(root))).E_PLACE_AREA!;
    expect(count()).toBe(3);
    deriveAreaCommand(["--write"], root, () => {}, () => {});
    expect(count()).toBe(1);
  });

  it("refuses --write when the hold-out precision is under the gate", () => {
    // two authored records a few hundred metres apart in different areas: hiding either one, the other answers wrongly
    const bad = [rec("place/p", { area_id: "XX/AA/park" }), rec("place/q", { area_id: "XX/AA/valley" }), rec("place/r")];
    const root = fixture(bad, { "place/p": pt(46), "place/q": pt(46 + 0.2 * KM), "place/r": pt(46 + 5 * KM) });
    const io = sink();
    expect(deriveAreaCommand(["--write"], root, io.out, io.err)).toBe(1);
    expect(io.lines.join("\n")).toMatch(/REFUSED: the hold-out precision/);
  });
});

describe("the real data", () => {
  it("passes the hold-out gate on the live records, so --write may run", () => {
    const { input, problems } = loadAreaInput(REPO);
    expect(problems).toEqual([]);
    const fam = holdOutAccuracy(input, "family");
    expect(fam.known).toBeGreaterThan(0);
    expect(fam.precision).toBeGreaterThanOrEqual(AREA_DERIVATION.minPrecision);
  });
});
