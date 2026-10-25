// DATA-LOC L1 (PLAN R-110, BACKLOG 15.110): the trip-less capture lane. A stored place that no trip uses carries capture, suitability and
// relevance records in data/<kind>/<TRIPLESS_LANE>/; the validators, the gap reports and the gap budget treat the lane like a trip, the
// lane rules (E_CAP_LANE) keep it to pinned place refs with no private origin key, and the lane id never reaches public output.
// The fixture (fixtures/tripless-lane/lane.json) is a record whose required tier is fully answered, cut from a real one and retargeted.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rootRef, TRIPLESS_LANE, triplessDir } from "../../src/capture/lane.ts";
import { photoLicenceOk } from "../../src/capture/photoLicence.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { recordTier } from "../../src/capture/tiers.ts";
import { checkBudget } from "../../src/capture/gapBudget.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import { CAP_ERROR_LIST } from "../../src/validate/codes.ts";
import { allFiles, validateDoc, validateFile } from "../../src/validate/index.ts";
import { REPO, put, scope, scratchRoot } from "./helpers.ts";

type Doc = { trip: string; lane: string; sources: unknown[]; records: Record<string, unknown>[] } & Record<string, unknown>;
/** capture, suitability and relevance lane files, plus a one-place locations store that holds the fixture area */
const FIX = JSON.parse(readFileSync(join(REPO, "core/test/fixtures/tripless-lane/lane.json"), "utf8")) as Record<"capture" | "suitability" | "relevance", Doc>;
const REF = "place/fixture-pass";
const clone = <T>(x: T): T => structuredClone(x);
const capPath = `${triplessDir("capture")}/L1T.json`;
const suitPath = `${triplessDir("suitability")}/L1T.json`;
const relPath = `${triplessDir("relevance")}/L1T.json`;

const locations = (FIX as unknown as { locations: unknown }).locations;
const registry = {
  schema: "catalogue-slugs/2",
  places: { slugs: { [REF]: "fixture-pass", "place/fixture-other": "fixture-other" }, retired: {}, merged: { "place/fixture-old": REF }, withdrawn: { "place/fixture-gone": "fixture-gone" } },
  trips: { slugs: { "trip/fixture-trip": "fixture-trip" }, retired: {}, merged: {}, withdrawn: {} },
  formerKeys: {},
  regions: {},
};

/** A scratch repository with the lane on disk (capture, suitability, relevance), its point, its area and its pinned ref. */
function root(over: { capture?: Doc; suitability?: Doc; relevance?: Doc; extra?: Record<string, unknown> } = {}): string {
  return scratchRoot({
    "data/suitability/scope.json": scope(["fixture-pass", "fixture-other", "fixture-old", "fixture-gone", "fixture-unpinned"]),
    "data/capture/operators.json": { schema: "capture-operators/1", updated: "2026-10-18", operators: [] },
    "data/locations/locations.json": locations,
    "data/catalogue/slugs.json": registry,
    "data/capture/points.json": { schema: "capture-points/1", points: { [REF]: { lat: 46.5951, lon: 12.2654, coord_src: "wikidata", point_source: "Wikidata Q2217047 P625 (fixture)", point_role: "centre" } } },
    "data/capture/gap-budget.json": { schema: "capture-gap-budget/1", note: "", updated: "2026-10-25", strict: [], counts: {}, raised: [], pinned: { on: "2026-10-25", note: "", refs: [] } },
    [capPath]: over.capture ?? FIX.capture,
    [suitPath]: over.suitability ?? FIX.suitability,
    [relPath]: over.relevance ?? FIX.relevance,
    ...(over.extra ?? {}),
  });
}
const codes = (r: { errors: { code: string }[] }) => [...new Set(r.errors.map((e) => e.code))].sort();
const at = (r: string, rel: string) => validateFile(join(r, rel), r);
const withRef = (doc: Doc, ref: string, over: Record<string, unknown> = {}): Doc => ({ ...clone(doc), records: [{ ...clone(doc.records[0]!), ref, ...over }] });

describe("the lane id", () => {
  it("is one neutral constant that names no list, and is not a trip of the slug registry", () => {
    expect(TRIPLESS_LANE).toBe("catalogue");
    expect(TRIPLESS_LANE).not.toMatch(/wish|save|owner|private|list/i);
    const reg = JSON.parse(readFileSync(join(REPO, "data/catalogue/slugs.json"), "utf8")) as { trips: { slugs: Record<string, string> } };
    expect(Object.keys(reg.trips.slugs)).not.toContain(`trip/${TRIPLESS_LANE}`);
    expect(Object.values(reg.trips.slugs)).not.toContain(TRIPLESS_LANE);
    expect(triplessDir("capture")).toBe(`data/capture/${TRIPLESS_LANE}`);
  });
  it("the privacy detector refuses it as a trip value or a trip ref in any served body", () => {
    expect(privacyHits({ items: [{ ref: REF, trip: TRIPLESS_LANE }] }).map((h) => h.why)).toContain("the trip-less lane id");
    expect(privacyHits({ trips: ["fixture-trip", TRIPLESS_LANE] }).map((h) => h.why)).toContain("the trip-less lane id");
    expect(privacyHits({ note: `see trip/${TRIPLESS_LANE}` }).map((h) => h.why)).toContain("the trip-less lane id");
    // the word in prose, or a real trip, is not a hit
    expect(privacyHits({ trip: "fixture-trip", title: "The catalogue of places", href: "/places/" })).toEqual([]);
  });
  it("rootRef unwraps part/ and offer/ to the place a record hangs off", () => {
    expect(rootRef("offer/part/place/fixture-pass#shore#rowing")).toBe(REF);
    expect(rootRef("part/place/fixture-pass#shore")).toBe(REF);
    expect(rootRef(REF)).toBe(REF);
  });
});

describe("the validators accept the lane like a trip", () => {
  it("a lane record with its placement block and its required tier answered passes, in all three sidecars", () => {
    const r = root();
    for (const p of [capPath, suitPath, relPath]) {
      const res = at(r, p);
      expect(res.errors, `${p}: ${JSON.stringify(res.errors.slice(0, 3))}`).toEqual([]);
    }
    const t = recordTier(loadWorld(r), REF)!;
    expect(t.requiredMissing).toEqual([]);
    expect(loadWorld(r).trips.get(TRIPLESS_LANE)).toEqual([REF]);
  });
  it("validate.ts --all walks the lane, and gaps --placement --trip <lane> reports it", () => {
    const r = root();
    expect(allFiles(r).map((f) => f.slice(r.length + 1))).toEqual(expect.arrayContaining([capPath, suitPath, relPath]));
    const all = spawnSync("node", [join(REPO, "core/bin/validate.ts"), "--all", "--root", r], { encoding: "utf8" });
    expect(all.stdout.split("\n").filter((l) => l.startsWith("ERROR")).join("\n")).toBe("");
    expect(all.status).toBe(0);
    const gaps = spawnSync("node", [join(REPO, "core/bin/capture.ts"), "gaps", "--placement", "--trip", TRIPLESS_LANE, "--json", "--root", r], { encoding: "utf8" });
    expect(gaps.status, gaps.stderr).toBe(0);
    const rep = JSON.parse(gaps.stdout) as { summaries: { trip: string; records: number; no_point: number; no_area: number }[]; records: { ref: string; trip: string }[] };
    expect(rep.summaries).toEqual([expect.objectContaining({ trip: TRIPLESS_LANE, records: 1, no_point: 0, no_area: 0 })]);
    expect(rep.records).toEqual([]); // only records with a finding are listed; this one is fully placed
    // without its point the record is listed with the finding, under the lane
    const r2 = root({ extra: { "data/capture/points.json": { schema: "capture-points/1", points: {} } } });
    const g2 = spawnSync("node", [join(REPO, "core/bin/capture.ts"), "gaps", "--placement", "--trip", TRIPLESS_LANE, "--json", "--root", r2], { encoding: "utf8" });
    const rep2 = JSON.parse(g2.stdout) as typeof rep;
    expect(rep2.records.map((x) => [x.ref, x.trip])).toEqual([[REF, TRIPLESS_LANE]]);
    expect(rep2.summaries[0]).toEqual(expect.objectContaining({ no_point: 1 }));
    const tier = spawnSync("node", [join(REPO, "core/bin/capture.ts"), "gaps", "--tier", "required", "--trip", TRIPLESS_LANE, "--json", "--root", r], { encoding: "utf8" });
    expect(tier.status, tier.stderr).toBe(0);
    expect((JSON.parse(tier.stdout) as { records: unknown[] }).records).toEqual([]);
  });
  it("a lane record is a new record: its placement and tier findings are errors, and the gap budget does not move", () => {
    const bare = withRef(FIX.capture, REF);
    delete (bare.records[0] as Record<string, unknown>).area_id;
    delete (bare.records[0] as Record<string, unknown>).links;
    const r = root({ capture: bare });
    expect(codes(at(r, capPath))).toEqual(expect.arrayContaining(["E_PLACE_AREA", "W_TIER_REQUIRED"]));
    const ok = root();
    const b = checkBudget(ok);
    expect(b.rows.filter((x) => x.now > 0)).toEqual([]);
  });
});

describe("E_CAP_LANE", () => {
  it("is a capture code with a case here", () => {
    expect(CAP_ERROR_LIST).toContain("E_CAP_LANE");
  });
  it("the folder and the trip id agree: a lane file says the lane, and a trip's folder cannot hold a lane file", () => {
    const wrongTrip = { ...clone(FIX.capture), trip: "fixture-trip" };
    expect(codes(at(root({ capture: wrongTrip }), capPath))).toContain("E_CAP_LANE");
    const r = root({ extra: { "data/capture/fixture-trip/x.json": withRef(FIX.capture, "place/fixture-other") } });
    const res = at(r, "data/capture/fixture-trip/x.json");
    expect(res.errors.find((e) => e.code === "E_CAP_LANE")?.message).toMatch(/is the trip-less lane, but this file sits in data\/capture\/fixture-trip\//);
    const suit = { ...clone(FIX.suitability), trip: "fixture-trip" };
    expect(codes(at(root({ suitability: suit }), suitPath))).toContain("E_CAP_LANE");
    const rel = { ...clone(FIX.relevance), trip: "fixture-trip" };
    expect(codes(at(root({ relevance: rel }), relPath))).toContain("E_CAP_LANE");
  });
  it("every record hangs off a pinned place ref: not a trip item, a legacy row, an unpinned, merged or withdrawn ref", () => {
    const r = root();
    const run = (ref: string) => validateDoc(withRef(FIX.capture, ref), "sidecar", r, { kind: "capture" }, join(r, capPath));
    const laneMsg = (ref: string) => run(ref).errors.filter((e) => e.code === "E_CAP_LANE").map((e) => e.message).join(" ");
    expect(laneMsg("trip/fixture-trip/lake:fixture")).toMatch(/is not about a stored place/);
    expect(laneMsg("legacy/canadian-rockies-sept-2029/sights/moraine-lake")).toMatch(/is not about a stored place/);
    expect(laneMsg("place/fixture-unpinned")).toMatch(/is not a pinned place ref/);
    expect(laneMsg("place/fixture-old")).toMatch(/was merged into "place\/fixture-pass"/);
    expect(laneMsg("place/fixture-gone")).toMatch(/is withdrawn/);
    // a part or an offer of a pinned place is fine
    expect(laneMsg("part/place/fixture-other#shore")).toBe("");
  });
  it("no private origin key anywhere in a lane file (PRIV1)", () => {
    const leak = withRef(FIX.relevance, REF);
    (leak.records[0]!.draw as Record<string, unknown>).note = "from loc:IT/veneto/belluno/fixture-pass";
    const res = at(root({ relevance: leak }), relPath);
    expect(res.errors.filter((e) => e.code === "E_CAP_LANE").map((e) => e.path)).toEqual(["/records/0/draw/note"]);
    expect(JSON.stringify(res.errors)).not.toMatch(/loc:IT/);
  });
  it("a trip's own lane files are untouched by the rules", () => {
    const r = root({ extra: { "data/capture/fixture-trip/x.json": { ...withRef(FIX.capture, "place/fixture-other"), trip: "fixture-trip" } } });
    expect(codes(at(r, "data/capture/fixture-trip/x.json"))).not.toContain("E_CAP_LANE");
  });
});

describe("E_CAP_PHOTO_LICENCE: the allowlist stays strict (DD-3)", () => {
  it("accepts CC BY, CC BY-SA (with versions and ports), CC0 and public domain", () => {
    for (const l of ["CC BY 4.0", "CC BY-SA 2.5 ca", "CC BY-SA 3.0", "CC0", "CC0 1.0", "Public domain", "Public domain (US government)", "PDM 1.0", "PD-USGov-NPS"]) expect(photoLicenceOk(l), l).toBe(true);
  });
  it("refuses NC, ND, all rights reserved, Unsplash and Pexels", () => {
    for (const l of ["CC BY-NC 4.0", "CC BY-NC-SA 2.0", "CC BY-ND 4.0", "CC BY-NC-ND 3.0", "All rights reserved", "Unsplash License", "Pexels License", ""]) expect(photoLicenceOk(l), l).toBe(false);
  });
  it("every photo already stored in data/capture is on the allowlist", () => {
    const w = loadWorld(REPO);
    const bad = [...w.cap.values()].flatMap(({ rec }) => (rec.photos ?? []).filter((p) => !photoLicenceOk(p.licence)).map((p) => `${rec.ref} ${p.licence}`));
    expect(bad).toEqual([]);
  });
  it("a capture record with an NC photo errors", () => {
    const photo = { file: "Fixture.jpg", licence: "CC BY-NC 2.0", author: "A", attribution: "A, CC BY-NC 2.0", source_url: "https://example.org/f", width: 2000, height: 1300 };
    const doc = withRef(FIX.capture, REF, { photos: [photo] });
    const r = root({ capture: doc });
    const res = at(r, capPath);
    expect(res.errors.filter((e) => e.code === "E_CAP_PHOTO_LICENCE").map((e) => e.path)).toEqual(["/records/0/photos/0/licence"]);
    put(r, capPath, withRef(FIX.capture, REF, { photos: [{ ...photo, licence: "CC BY-SA 4.0", attribution: "A, CC BY-SA 4.0" }] }));
    expect(codes(at(r, capPath))).not.toContain("E_CAP_PHOTO_LICENCE");
  });
});
