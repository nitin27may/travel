// META-0: the placement block, the tiers and the gap budget (capture contract 3.7). One failing case per code; the severity rule
// (pinned records warn, new records in data/capture error, drafts outside the store warn); the point and town schemas; the budget gate.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POINT_ROLE } from "../../src/schema/enums.ts";
import { capPoint, capturePointsFile, NEAR_TOWN_NONE } from "../../src/schema/capture/points.ts";
import { capRecord } from "../../src/schema/capture/records.ts";
import { PROPERTY_BY_KEY } from "../../src/schema/capture/properties.ts";
import { PLACE_ERROR_LIST, PLACE_WARNING_LIST } from "../../src/validate/codes.ts";
import { validateDoc } from "../../src/validate/index.ts";
import { checkBudget, inStore, levelOf, writeBudget } from "../../src/capture/gapBudget.ts";
import { defaultPointRole, kmOutside, PLACEMENT_CODES } from "../../src/capture/placementBlock.ts";
import { kindOf, recordTier } from "../../src/capture/tiers.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { REPO, capDoc, put, scope, scratchRoot } from "./helpers.ts";

const LANE = "data/capture/fixture-trip/a.json";
const locations = {
  schema_version: 3,
  countries: [{ code: "IT", a3: "ITA", name: "Italy" }],
  regions: [{ id: "IT/trentino-alto-adige", country: "IT", code: "32", name: "Trentino-Alto Adige" }],
  areas: [{ id: "IT/trentino-alto-adige/bolzano", region_id: "IT/trentino-alto-adige", slug: "bolzano", name: "Bolzano" }],
  places: [
    { id: "IT/trentino-alto-adige/bolzano/seceda", area_id: "IT/trentino-alto-adige/bolzano", name: "Seceda", lat: 46.6, lon: 11.72 },
    { id: "IT/trentino-alto-adige/bolzano/tre-cime", area_id: "IT/trentino-alto-adige/bolzano", name: "Tre Cime", lat: 46.62, lon: 12.3 },
  ],
};
const AREA = "IT/trentino-alto-adige/bolzano";
const pt = (lat: number, lon: number, over: Record<string, unknown> = {}) => ({ lat, lon, coord_src: "osm", point_source: "OSM node 1 fixture", ...over });

function root(opts: { points?: Record<string, unknown>; pinned?: string[]; strict?: string[]; towns?: boolean; budget?: boolean; extra?: Record<string, unknown> } = {}): string {
  return scratchRoot({
    "data/suitability/scope.json": scope(["lago-di-braies", "moraine-lake", "banff-gondola"]),
    "data/capture/operators.json": { schema: "capture-operators/1", updated: "2026-10-18", operators: [] },
    "data/locations/locations.json": locations,
    "data/capture/points.json": { schema: "capture-points/1", points: opts.points ?? {} },
    ...(opts.budget === false ? {} : { "data/capture/gap-budget.json": { schema: "capture-gap-budget/1", note: "", updated: "2026-10-21", strict: opts.strict ?? [], counts: {}, raised: [], pinned: { on: "2026-10-21", note: "", refs: opts.pinned ?? [] } } }),
    ...(opts.towns ? { "data/reference/towns/it.json": [] } : {}),
    ...(opts.extra ?? {}),
  });
}
const lake = (over: Record<string, unknown> = {}) => ({ ref: "place/lago-di-braies", type: "water.body.lake", layer: "place", name: "Lago di Braies", area_id: AREA, ...over });
/** validated as the lane file in the store (new records error) */
const inLane = (r: string, doc: unknown) => validateDoc(doc, "sidecar", r, { kind: "capture" }, join(r, LANE));
/** validated as a draft with no path (everything warns) */
const draft = (r: string, doc: unknown) => validateDoc(doc, "sidecar", r, { kind: "capture" });
const errs = (res: { errors: { code: string }[] }) => [...new Set(res.errors.map((e) => e.code))].sort();
const warns = (res: { warnings: { code: string }[] }) => [...new Set(res.warnings.map((e) => e.code))].sort();
const place = (res: { errors: { code: string }[] }) => errs(res).filter((c) => /^(E|W)_(PLACE|TIER)_/.test(c));
const placeW = (res: { warnings: { code: string }[] }) => warns(res).filter((c) => /^(E|W)_(PLACE|TIER)_/.test(c));

describe("codes", () => {
  it("the placement and tier codes have their own block, and the budget counts each placement code", () => {
    expect(PLACE_ERROR_LIST).toEqual(["E_PLACE_AREA", "E_PLACE_ORPHAN", "E_PLACE_FAR"]);
    expect(PLACE_WARNING_LIST).toEqual(["W_PLACE_POINT", "W_PLACE_APPROX", "W_PLACE_TOWN", "W_TIER_REQUIRED"]);
    expect([...PLACEMENT_CODES].sort()).toEqual([...PLACE_ERROR_LIST, ...PLACE_WARNING_LIST].filter((c) => c !== "W_TIER_REQUIRED").sort());
  });
});

describe("the placement codes (3.7)", () => {
  it("a placed lake with its point and area passes placement; only the derived town and the tier remain", () => {
    const r = root({ points: { "place/lago-di-braies": pt(46.694, 12.085) } });
    const res = inLane(r, capDoc([lake()]));
    expect(place(res)).toEqual(["W_TIER_REQUIRED"]);
    expect(placeW(res)).toEqual(["W_PLACE_TOWN"]); // no towns layer yet: a warning for every record
  });
  it("E_PLACE_AREA: no area_id, or one the locations store does not have", () => {
    const r = root({ points: { "place/lago-di-braies": pt(46.694, 12.085) } });
    expect(place(inLane(r, capDoc([lake({ area_id: undefined })])))).toContain("E_PLACE_AREA");
    const bad = inLane(r, capDoc([lake({ area_id: "IT/nowhere/else" })]));
    expect(place(bad)).toContain("E_PLACE_AREA");
    expect(bad.errors.find((e) => e.code === "E_PLACE_AREA")!.message).toMatch(/is not an area, region or country of data\/locations\/locations\.json/);
    // a region id is a valid (coarse) area
    expect(place(inLane(r, capDoc([lake({ area_id: "IT/trentino-alto-adige" })])))).not.toContain("E_PLACE_AREA");
  });
  it("E_PLACE_ORPHAN: an offer that says nowhere, or names only things that are not a place or route", () => {
    const r = root({ points: { "place/lago-di-braies": pt(46.694, 12.085) } });
    const offer = (over: Record<string, unknown>) => ({ ref: "offer/place/lago-di-braies#rowing", type: "water.boat.boat_rental.rowboat", layer: "offer", name: "Rowing boats", ...over });
    const none = inLane(r, capDoc([lake(), offer({})]));
    expect(place(none)).toContain("E_PLACE_ORPHAN");
    expect(none.errors.find((e) => e.code === "E_PLACE_ORPHAN")!.message).toMatch(/says nowhere where it happens/);
    expect(place(inLane(r, capDoc([lake(), offer({ at: ["place/lago-di-braies"] })])))).not.toContain("E_PLACE_ORPHAN");
    // an offer at another offer reaches the place through it
    const chained = capDoc([lake(), offer({ at: ["place/lago-di-braies"] }), offer({ ref: "offer/place/lago-di-braies#pedal", at: ["offer/place/lago-di-braies#rowing"] })]);
    expect(inLane(r, chained).errors.filter((e) => e.code === "E_PLACE_ORPHAN")).toEqual([]);
  });
  it("W_PLACE_POINT: a place with no point errors when new; a route reads the point of where it starts", () => {
    const r = root();
    const res = inLane(r, capDoc([lake()]));
    expect(place(res)).toContain("W_PLACE_POINT");
    expect(res.errors.find((e) => e.code === "W_PLACE_POINT")!.message).toMatch(/point_role "centre"/);
    const r2 = root({ points: { "place/moraine-lake": pt(46.69, 12.08) } });
    const walk = { ref: "part/place/lago-di-braies#shore", type: "nature.trail.walk", layer: "route", name: "Shore walk", area_id: AREA, starts_at: ["place/moraine-lake"] };
    expect(place(inLane(r2, capDoc([walk])))).not.toContain("W_PLACE_POINT");
  });
  it("W_PLACE_APPROX: an approximate point says why", () => {
    const r = root({ points: { "place/lago-di-braies": pt(46.694, 12.085, { approx: true }) } });
    expect(place(inLane(r, capDoc([lake()])))).toContain("W_PLACE_APPROX");
    const ok = root({ points: { "place/lago-di-braies": pt(46.694, 12.085, { approx: true, approx_note: "centroid of the lake polygon" }) } });
    const res = inLane(ok, capDoc([lake()]));
    expect([...place(res), ...placeW(res)]).not.toContain("W_PLACE_APPROX");
    // an approximate point is never given a nearest town
    expect(placeW(res)).not.toContain("W_PLACE_TOWN");
  });
  it("E_PLACE_FAR: a point far outside its area's box (a wrong area or a swapped lat and lon)", () => {
    const r = root({ points: { "place/lago-di-braies": pt(12.085, 46.694) } });
    const res = inLane(r, capDoc([lake()]));
    expect(place(res)).toContain("E_PLACE_FAR");
    expect(res.errors.find((e) => e.code === "E_PLACE_FAR")!.message).toMatch(/km outside IT\/trentino-alto-adige\/bolzano/);
    // 20 km beyond the box is inside the 25 km margin
    const near = root({ points: { "place/lago-di-braies": pt(46.62 + 0.18, 12.0) } });
    expect(place(inLane(near, capDoc([lake()])))).not.toContain("E_PLACE_FAR");
    expect(kmOutside({ minLat: 0, maxLat: 1, minLon: 0, maxLon: 1, n: 2 }, 0.5, 0.5)).toBe(0);
  });
  it("W_PLACE_TOWN: a warning until the towns layer exists, then an error for a new record; a town needs its distance", () => {
    const pts = { "place/lago-di-braies": pt(46.694, 12.085) };
    expect(placeW(inLane(root({ points: pts }), capDoc([lake()])))).toContain("W_PLACE_TOWN");
    const withTowns = root({ points: pts, towns: true });
    expect(place(inLane(withTowns, capDoc([lake()])))).toContain("W_PLACE_TOWN");
    const town = { v: "it-32-braies", state: "value", basis: "our_inference", src: [], note: "derived: GeoNames cities1000, nearest settlement" };
    const km = { v: 1.4, state: "value", basis: "our_inference", src: [], note: "derived" };
    expect(place(inLane(withTowns, capDoc([lake({ near_town: town })])))).toContain("W_PLACE_TOWN");
    expect(place(inLane(withTowns, capDoc([lake({ near_town: town, near_town_km: km })])))).not.toContain("W_PLACE_TOWN");
    const none = { v: NEAR_TOWN_NONE, state: "value", basis: "our_inference", src: [], note: "derived: none within 50 km" };
    expect(place(inLane(withTowns, capDoc([lake({ near_town: none })])))).not.toContain("W_PLACE_TOWN");
  });
  it("W_TIER_REQUIRED: the required tier of the kind, from the R marks; a dated searched_none answers a key", () => {
    const r = root({ points: { "place/lago-di-braies": pt(46.694, 12.085) } });
    const res = inLane(r, capDoc([lake()]));
    expect(place(res)).toContain("W_TIER_REQUIRED");
    const msg = res.errors.find((e) => e.code === "W_TIER_REQUIRED")!.message;
    expect(msg).toMatch(/water\.body\.lake \(place\) leaves \d+ of the \d+ keys of its required tier unanswered/);
    expect(msg).not.toMatch(/\b(area_id|point|near_town)\b,/); // the placement codes report those
    const t0 = recordTier(loadWorld(r, join(r, LANE), [capDoc([lake()]) as never]), "place/lago-di-braies")!;
    expect(t0.requiredMissing).toContain("links");
    const searched = { kind: "official", state: "searched_none", query: "Lago di Braies official site", on: "2026-10-21" };
    const t1 = recordTier(loadWorld(r, join(r, LANE), [capDoc([lake({ links: [searched] })]) as never]), "place/lago-di-braies")!;
    expect(t1.requiredMissing).not.toContain("links");
  });
});

describe("severity: pinned records warn, new records error, drafts warn", () => {
  it("a record pinned in the gap budget gets the same findings as warnings; a strict code errors even when pinned", () => {
    const pinned = root({ pinned: ["place/lago-di-braies"] });
    const res = inLane(pinned, capDoc([lake({ area_id: undefined })]));
    expect(place(res)).toEqual([]);
    expect(placeW(res)).toEqual(expect.arrayContaining(["E_PLACE_AREA", "W_PLACE_POINT", "W_TIER_REQUIRED"]));
    const strict = root({ pinned: ["place/lago-di-braies"], strict: ["W_PLACE_POINT"] });
    expect(place(inLane(strict, capDoc([lake()])))).toEqual(["W_PLACE_POINT"]);
  });
  it("a pinned record keeps its pin through an alias after a rename", () => {
    const r = root({ pinned: ["place/moraine-lake"] });
    const res = inLane(r, capDoc([lake({ aliases: ["place/moraine-lake"] })]));
    expect(place(res)).toEqual([]);
  });
  it("a document validated outside data/capture (a template, a proposal) only warns", () => {
    const res = draft(root(), capDoc([lake({ area_id: undefined })]));
    expect(place(res)).toEqual([]);
    expect(placeW(res)).toContain("E_PLACE_AREA");
  });
  it("levelOf and inStore", () => {
    const sev = { pinned: new Set(["a"]), strict: new Set(["W_PLACE_POINT"]), townsLayer: false };
    expect(levelOf("E_PLACE_AREA", ["a"], true, sev)).toBe("warning");
    expect(levelOf("W_PLACE_POINT", ["a"], true, sev)).toBe("error");
    expect(levelOf("E_PLACE_AREA", ["b"], true, sev)).toBe("error");
    expect(levelOf("E_PLACE_AREA", ["b"], false, sev)).toBe("warning");
    expect(levelOf("W_PLACE_TOWN", ["b"], true, sev)).toBe("warning");
    expect(levelOf("W_PLACE_TOWN", ["b"], true, { ...sev, townsLayer: true })).toBe("error");
    expect(inStore("/r", "/r/data/capture/x/a.json")).toBe(true);
    expect(inStore("/r", "/r/data/capture/runs/a.json")).toBe(false);
    expect(inStore("/r", "/r/research/formats/templates/capture-record.json")).toBe(false);
    expect(inStore("/r", undefined)).toBe(false);
  });
});

describe("the point and the town (3.7, 3.37)", () => {
  it("POINT_ROLE is defined once, in enums.ts", () => {
    expect(POINT_ROLE).toEqual(["centre", "trailhead", "entrance", "parking", "meeting", "summit", "route_start"]);
    const hits: string[] = [];
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith(".ts") && /"trailhead",\s*"entrance",\s*"parking"/.test(readFileSync(p, "utf8"))) hits.push(p.slice(REPO.length));
      }
    };
    walk(join(REPO, "core", "src"));
    expect(hits).toEqual(["core/src/schema/enums.ts"]);
  });
  it("a point row takes point_role and approx, both optional, so every row written before stays valid", () => {
    expect(capPoint.safeParse({ lat: 51.1, lon: -115.5, coord_src: "osm" }).success).toBe(true);
    expect(capPoint.safeParse({ lat: 51.1, lon: -115.5, coord_src: "osm", point_role: "trailhead", approx: false }).success).toBe(true);
    expect(capPoint.safeParse({ lat: 51.1, lon: -115.5, coord_src: "osm", point_role: "door" }).success).toBe(false);
    expect(capPoint.safeParse({ lat: 51.1, lon: -115.5, coord_src: "google" }).success).toBe(false);
    expect(capPoint.safeParse({ lat: 151.1, lon: -115.5, coord_src: "osm" }).success).toBe(false);
    const real = JSON.parse(readFileSync(join(REPO, "data/capture/points.json"), "utf8"));
    const parsed = capturePointsFile.safeParse(real);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 2))).toBe(true);
  });
  it("a broken points file fails the budget check by name", () => {
    const r = root({ points: { "place/lago-di-braies": { lat: 1, lon: 2, coord_src: "osm", point_role: "door" } } });
    const res = checkBudget(r);
    expect(res.ok).toBe(false);
    expect(res.issues.join("\n")).toMatch(/data\/capture\/points\.json#\/points\/place~1lago-di-braies\/point_role|data\/capture\/points\.json#\/points\/place\/lago-di-braies\/point_role/);
  });
  it("near_town is a town id <cc>-<admin1>-<slug> (Q76) or the none value; geonames_id is a number in text", () => {
    const base = { ref: "place/x", type: "water.body.lake", layer: "place" };
    const v = (x: unknown) => ({ v: x, state: "value", basis: "our_inference", src: [], note: "derived" });
    expect(capRecord.safeParse({ ...base, near_town: v("ca-on-whitby"), near_town_km: v(3.2), geonames_id: v("6177869") }).success).toBe(true);
    expect(capRecord.safeParse({ ...base, near_town: v(NEAR_TOWN_NONE) }).success).toBe(true);
    expect(capRecord.safeParse({ ...base, near_town: v("town/ca/on/whitby") }).success).toBe(false);
    expect(capRecord.safeParse({ ...base, geonames_id: v("Q123") }).success).toBe(false);
  });
  it("the registry: near_town N until META-2 derives it (the placement codes ask for it), near_town_km rides with it, geonames_id A (R on settlements)", () => {
    expect(PROPERTY_BY_KEY.get("near_town")).toMatchObject({ group: "identity", base: "N", gap: "Nearest town not worked out yet", layers: ["place", "route"] });
    expect(PROPERTY_BY_KEY.get("near_town_km")).toMatchObject({ base: "N", unit: "km" });
    expect(PROPERTY_BY_KEY.get("geonames_id")).toMatchObject({ base: "A", layers: ["place"] });
    const town = JSON.parse(readFileSync(join(REPO, "data/schema/capture/settlement.json"), "utf8"));
    expect(JSON.stringify(town)).toContain('"geonames_id":"R"');
  });
  it("the default role of a point follows the type", () => {
    expect(defaultPointRole("nature.trail.hike", "route")).toBe("trailhead");
    expect(defaultPointRole("ride.lift.gondola", "route")).toBe("route_start");
    expect(defaultPointRole("nature.summit.peak", "place")).toBe("summit");
    expect(defaultPointRole("access.park.lot", "place")).toBe("parking");
    expect(defaultPointRole("culture.museum.museum", "place")).toBe("entrance");
    expect(defaultPointRole("water.body.lake", "place")).toBe("centre");
    expect(defaultPointRole("water.boat.boat_tour", "offer")).toBe("meeting");
    expect(kindOf({ type: "nature.trail.hike", layer: "route" })).toBe("trail");
    expect(kindOf({ type: "stay.mountain.hut", layer: "place" })).toBe("stay");
  });
});

describe("the repository", () => {
  it("every record is pinned, so the shipped data only warns, and the budget holds", () => {
    const res = checkBudget(REPO);
    expect(res.issues).toEqual([]);
    expect(res.rows.filter((x) => x.verdict === "rose")).toEqual([]);
    const budget = JSON.parse(readFileSync(join(REPO, "data/capture/gap-budget.json"), "utf8"));
    expect(new Set(budget.pinned.refs).size).toBe(budget.pinned.refs.length);
    expect(budget.counts.E_PLACE_FAR).toBe(0);
  });
  it("a test that fails when a required key is removed: a record whose required tier is complete loses one key", () => {
    const w = loadWorld(REPO);
    const complete = [...w.cap.keys()].map((ref) => recordTier(w, ref)).find((t) => t && t.required.length > 0 && t.requiredMissing.length === 0 && t.required.includes("links"))!;
    expect(complete, "the repository holds a record with its required tier complete").toBeTruthy();
    const loc = w.cap.get(complete.ref)!;
    loc.rec = { ...structuredClone(loc.rec), links: (loc.rec.links ?? []).filter((l) => l.kind !== "official") };
    expect(recordTier(w, complete.ref)!.requiredMissing).toEqual(["links"]);
  });
});

describe("the gap budget gate", () => {
  const cli = (r: string, ...args: string[]) => spawnSync("node", [join(REPO, "core/bin/capture.ts"), ...args, "--root", r], { encoding: "utf8" });
  it("--check passes on the repository", () => {
    const res = cli(REPO, "gaps", "--budget", "--check");
    expect(res.status, res.stdout + res.stderr).toBe(0);
    expect(res.stdout).toContain("OK: no gap count rose");
  });
  it("--check fails when a count rises (a new record without an area), and --write raises it only with a reason", () => {
    const r = root({ points: { "place/lago-di-braies": pt(46.694, 12.085) }, budget: false });
    put(r, LANE, capDoc([lake()]));
    expect(writeBudget(r, { today: "2026-10-21", pin: true }).written).toBe(true);
    expect(cli(r, "gaps", "--budget", "--check").status).toBe(0);
    put(r, LANE, capDoc([lake({ area_id: undefined })]));
    const rose = cli(r, "gaps", "--budget", "--check");
    expect(rose.status).toBe(1);
    expect(rose.stdout).toMatch(/ROSE E_PLACE_AREA/);
    expect(cli(r, "gaps", "--budget", "--write").status).toBe(1);
    expect(cli(r, "gaps", "--budget", "--write", "--reason", "fixture: area removed on purpose", "--today", "2026-10-22").status).toBe(0);
    const b = JSON.parse(readFileSync(join(r, "data/capture/gap-budget.json"), "utf8"));
    expect(b.raised).toEqual([{ on: "2026-10-22", code: "E_PLACE_AREA", from: 0, to: 1, reason: "fixture: area removed on purpose" }]);
    expect(cli(r, "gaps", "--budget", "--check").status).toBe(0);
  });
  it("a fall passes and asks for the budget to be lowered", () => {
    const r = root({ budget: false });
    put(r, LANE, capDoc([lake({ area_id: undefined })]));
    writeBudget(r, { today: "2026-10-21", pin: true });
    put(r, LANE, capDoc([lake()]));
    const res = cli(r, "gaps", "--budget", "--check");
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/fell, so lower the budget/);
  });
});

describe("the reports", () => {
  const cli = (...args: string[]) => spawnSync("node", [join(REPO, "core/bin/capture.ts"), ...args], { encoding: "utf8" });
  it("fields --type nature.trail.hike prints the placement block first, with the trailhead role", () => {
    const res = cli("fields", "--type", "nature.trail.hike");
    expect(res.stdout.split("\n")[0]).toBe("Placement (every record)");
    expect(res.stdout).toMatch(/route: area_id R · point R, role trailhead/);
    const json = JSON.parse(cli("fields", "--type", "nature.trail.hike", "--format", "json").stdout);
    expect(Object.keys(json)[0]).toBe("placement");
    expect(json.placement.layers.route.point.role).toBe("trailhead");
  });
  it("gaps --placement --trip prints the per-trip table and the records with a hint", () => {
    const res = cli("gaps", "--placement", "--trip", "canadian-rockies-2029");
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/^Placement gaps: canadian-rockies-2029\nrecords \d+ · no area \d+ · no point \d+ · approximate \d+ · no nearest town \d+ · outside its area \d+/);
    expect(res.stdout).toMatch(/role trailhead +hint: track start/);
    const json = JSON.parse(cli("gaps", "--placement", "--json").stdout);
    expect(json.summaries.length).toBeGreaterThan(1);
    expect(json.records.every((r: { findings: unknown[] }) => r.findings.length > 0)).toBe(true);
  });
  it("gaps --tier required --json prints the 6.4 matrix and the per-kind tier; --layer and --type narrow it", () => {
    const all = JSON.parse(cli("gaps", "--tier", "required", "--json").stdout);
    expect(all.matrix.map((m: { row: string }) => m.row)).toEqual(["place", "route", "route:trails", "offer", "event"]);
    expect(Object.keys(all.matrix[0].cells)).toEqual(["records", "area_id", "point", "osm_id", "wikidata", "official", "photos", "season", "where", "operator", "price", "duration", "window", "min_age"]);
    const total = all.matrix.filter((m: { row: string }) => m.row !== "route:trails").reduce((a: number, m: { cells: { records: number } }) => a + m.cells.records, 0);
    expect(total).toBe(loadWorld(REPO).cap.size);
    expect(all.kinds.map((k: { kind: string }) => k.kind)).toEqual(expect.arrayContaining(["place", "trail", "offer"]));
    const trails = JSON.parse(cli("gaps", "--tier", "enrichment", "--layer", "route", "--type", "nature.trail", "--json").stdout);
    expect(trails.matrix.map((m: { row: string }) => m.row)).toEqual(["route", "route:trails"]);
    expect(trails.kinds.map((k: { kind: string }) => k.kind)).toEqual(["trail"]);
    expect(cli("gaps", "--tier", "most").status).toBe(2);
  });
});
