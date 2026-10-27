// EG-C: the entity graph's relation contract (docs/v2/features/entity-graph.md 5, 6.2 and 11.1). The table itself (every relation has a
// source and a target rule, inverse names are unique and never stored, the registry agrees), the derived inverses of loadWorld with
// their legacy aliases, and one accepting and one failing case for every validator rule the table drives.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAP_RELATION, CAP_RELATION_DERIVED } from "../../src/schema/enums.ts";
import { capRecord } from "../../src/schema/capture/records.ts";
import { PROPERTY_BY_KEY } from "../../src/schema/capture/properties.ts";
import {
  CHAIN_RULES, DERIVED_NAMES, LEGACY_INCOMING_ALIASES, RELATION_RULES, RULE_BY_KEY, RULE_KEYS, nestedWrapper, protectedRefRule, sourceAllowed, targetAllowed,
} from "../../src/schema/capture/relations.ts";
import { CAP_ERROR_CODES, CAP_WARNING_CODES } from "../../src/validate/codes.ts";
import { stageChainProblem } from "../../src/validate/capture.ts";
import { validateDoc } from "../../src/validate/index.ts";
import { emptyIncoming, loadWorld } from "../../src/capture/records.ts";
import { levelOfLink } from "../../src/capture/gapBudget.ts";
import type { CaptureRecord } from "../../src/schema/capture/records.ts";
import { capDoc, put, scope, scratchRoot } from "./helpers.ts";

const LANE = "data/capture/fixture-trip/a.json";
const PLACES = ["moraine-lake", "lake-louise", "banff-national-park", "yoho-national-park", "lagazuoi", "sentinel-pass"];

function root(opts: { pinned?: string[]; strict?: string[]; known?: unknown[]; extra?: Record<string, unknown> } = {}): string {
  return scratchRoot({
    "data/suitability/scope.json": scope(PLACES),
    "data/capture/operators.json": { schema: "capture-operators/1", updated: "2026-10-26", operators: [{ ref: "operator/parks-canada", name: "Parks Canada", url: "https://parks.canada.ca/" }] },
    "data/capture/gap-budget.json": { schema: "capture-gap-budget/1", note: "", updated: "2026-10-26", strict: opts.strict ?? [], counts: {}, raised: [], ...(opts.known ? { known: opts.known } : {}), pinned: { on: "2026-10-21", note: "", refs: opts.pinned ?? [] } },
    ...(opts.extra ?? {}),
  });
}
/** validated as a lane file in the store: a new record errors */
const inLane = (r: string, doc: unknown) => validateDoc(doc, "sidecar", r, { kind: "capture" }, join(r, LANE));
const GRAPH = /^(E|W)_CAP_(REL_|VARIANT|REF|STAGE|INHERITED)/;
const errs = (res: { errors: { code: string }[] }) => [...new Set(res.errors.map((e) => e.code))].filter((c) => GRAPH.test(c)).sort();
const warns = (res: { warnings: { code: string }[] }) => [...new Set(res.warnings.map((e) => e.code))].filter((c) => GRAPH.test(c)).sort();

// ---- fixture records -------------------------------------------------------------------------------------------------------------------
const lake = (slug = "moraine-lake", over: Record<string, unknown> = {}) => ({ ref: `place/${slug}`, type: "water.body.lake", layer: "place", name: slug, ...over });
const park = (slug = "banff-national-park", over: Record<string, unknown> = {}) => ({ ref: `place/${slug}`, type: "nature.protected.national_park", layer: "place", name: slug, ...over });
const parking = (over: Record<string, unknown> = {}) => ({ ref: "part/place/moraine-lake#parking", type: "access.park.parking", layer: "place", name: "Moraine Lake parking", parks_for: ["place/moraine-lake"], ...over });
const hike = (slug: string, over: Record<string, unknown> = {}) => ({ ref: `part/place/moraine-lake#${slug}`, type: "nature.trail.hike", layer: "route", name: slug, ...over });
const offer = (product: string, type: string, over: Record<string, unknown> = {}) => ({ ref: `offer/place/banff-national-park#${product}`, type, layer: "offer", name: product, at: ["place/banff-national-park"], ...over });

describe("RELATION_RULES (entity-graph 5.1)", () => {
  it("has one rule per stored relation, plus covers_areas; every stored relation is a capture/1 key and a registry property", () => {
    expect([...RULE_KEYS].sort()).toEqual([...CAP_RELATION, "covers_areas"].sort());
    for (const k of RULE_KEYS) {
      expect(Object.keys(capRecord.shape), k).toContain(k);
      expect(PROPERTY_BY_KEY.get(k)?.home, k).toEqual({ in: "capture", path: k });
    }
    expect(CAP_RELATION).toContain("covered_by");
    expect(CAP_RELATION).toContain("includes");
    expect(CAP_RELATION).not.toContain("covers_areas"); // names areas, never a relation row (EG-M)
  });
  it("no relation without a source and a target rule (EG-R0)", () => {
    for (const r of RELATION_RULES) {
      expect(r.source.length, r.key).toBeGreaterThan(0);
      expect(r.target === "same" || r.target.length > 0, r.key).toBe(true);
      if (r.target === "same") expect(r.same?.layer, r.key).toBe(true);
    }
  });
  it("the registry's layers equal the rule's source layers", () => {
    for (const r of RELATION_RULES) {
      const layers = [...new Set(r.source.map((e) => e.layer))].sort();
      const def = PROPERTY_BY_KEY.get(r.key)!;
      expect([...(def.layers ?? ["event", "offer", "place", "route"])].sort(), r.key).toEqual(layers);
    }
  });
  it("inverse names are unique (members and access_points each gather two relations of one meaning), never stored and never a stored relation", () => {
    const by = new Map<string, string[]>();
    for (const r of RELATION_RULES) if (r.inverse) by.set(r.inverse, [...(by.get(r.inverse) ?? []), r.key]);
    for (const [inv, keys] of by) {
      if (inv === "members") expect(keys.sort()).toEqual(["covers_areas", "part_of"]);
      else if (inv === "access_points") expect(keys.sort()).toEqual(["parks_for", "serves"]);
      else expect(keys, inv).toHaveLength(1);
    }
    expect([...DERIVED_NAMES].sort()).toEqual([...CAP_RELATION_DERIVED].sort());
    for (const d of CAP_RELATION_DERIVED) {
      expect(RULE_KEYS as readonly string[], d).not.toContain(d);
      expect(Object.keys(capRecord.shape), d).not.toContain(d);
    }
    // symmetric relations have no inverse name and are stored on either side
    for (const r of RELATION_RULES) expect(r.symmetric, r.key).toBe(r.inverse === null && r.stored === "either");
  });
  it("CHAIN_RULES follow exactly the relations marked chain (6.2), and only record-to-record ones", () => {
    const followed = new Set(CHAIN_RULES.flatMap((c) => c.follow.map((s) => s.rel)));
    const chained = RELATION_RULES.filter((r) => r.chain && r.shape !== "areas").map((r) => r.key);
    expect([...followed].sort()).toEqual([...chained].sort());
    // the access-place row sits before the generic place row, so it wins
    expect(CHAIN_RULES.findIndex((c) => c.layer === "place" && c.types?.includes("access"))).toBeLessThan(CHAIN_RULES.findIndex((c) => c.layer === "place" && !c.types));
  });
  it("endpoint matching reads layer, type prefix, offer class and the source layer narrowing", () => {
    const partOf = RULE_BY_KEY.get("part_of")!;
    expect(targetAllowed(partOf, { layer: "route", type: "nature.trek.x", offerClass: null }, "route")).toBe(true);
    expect(targetAllowed(partOf, { layer: "route", type: "nature.trek.x", offerClass: null }, "place")).toBe(false);
    const cov = RULE_BY_KEY.get("covered_by")!;
    expect(targetAllowed(cov, { layer: "offer", type: "access.pass.park_pass", offerClass: "access" }, "offer")).toBe(true);
    expect(targetAllowed(cov, { layer: "offer", type: "stay.camp.campground", offerClass: "lodging" }, "offer")).toBe(true);
    expect(targetAllowed(cov, { layer: "offer", type: "access.pass.shuttle_seat", offerClass: "access" }, "offer")).toBe(false);
    const inc = RULE_BY_KEY.get("includes")!;
    expect(sourceAllowed(inc, { layer: "offer", type: "water.river.rafting", offerClass: "experience" })).toBe(true);
    expect(sourceAllowed(inc, { layer: "offer", type: "access.pass.entry_fee", offerClass: "access" })).toBe(false);
  });
  it("every new code has a description", () => {
    for (const c of ["E_CAP_REL_TARGET", "E_CAP_REL_CYCLE", "E_CAP_REL_SYM", "E_CAP_REL_CARD", "E_CAP_VARIANT", "E_CAP_REF_TOP"]) expect((CAP_ERROR_CODES as Record<string, string>)[c], c).toBeTruthy();
    for (const c of ["W_CAP_REL_PARENTS", "W_CAP_REL_CARD", "W_CAP_STAGE_ORDER", "W_CAP_INHERITED_COPY"]) expect((CAP_WARNING_CODES as Record<string, string>)[c], c).toBeTruthy();
  });
});

describe("ref grammar (4.4)", () => {
  it("one wrapper only", () => {
    expect(nestedWrapper("part/place/banff-national-park#tunnel-mountain-village-1")).toBeNull();
    expect(nestedWrapper("offer/place/banff-national-park#tunnel-mountain-village-1-campsite")).toBeNull();
    expect(nestedWrapper("offer/part/place/banff-national-park#a#b")).toMatch(/One wrapper only/);
    expect(nestedWrapper("part/part/place/x#a#b")).toMatch(/One wrapper only/);
  });
  it("a protected area is place/<slug> (or has it as an alias); a zone is part/<park>#<slug>", () => {
    expect(protectedRefRule("nature.protected.national_park", ["place/banff-national-park"])).toBeNull();
    expect(protectedRefRule("nature.protected.national_park", ["legacy/x/sights/y", "place/y"])).toBeNull();
    expect(protectedRefRule("nature.protected.national_park", ["part/place/banff-national-park#lake-louise-area"])).toMatch(/top-level record/);
    expect(protectedRefRule("nature.protected.zone", ["part/place/banff-national-park#lake-louise-area"])).toBeNull();
    expect(protectedRefRule("nature.protected.zone", ["place/lake-louise"])).toMatch(/zone/);
    expect(protectedRefRule("water.body.lake", ["part/x#y"])).toBeNull();
  });
  it("E_CAP_REF: a nested wrapper is refused in a file", () => {
    const r = root();
    const res = inLane(r, capDoc([lake(), { ref: "part/part/place/moraine-lake#shore#rock", type: "nature.viewpoint.viewpoint", layer: "place", name: "Rock" }]));
    expect(res.errors.some((e) => e.code === "E_CAP_REF" && /One wrapper only/.test(e.message))).toBe(true);
  });
  it("E_CAP_REF_TOP: a new protected area under a part/ ref errors, a pinned one warns, place/<slug> passes", () => {
    const bad = { ref: "part/place/moraine-lake#reserve", type: "nature.protected.nature_reserve", layer: "place", name: "Reserve" };
    expect(errs(inLane(root(), capDoc([lake(), bad])))).toContain("E_CAP_REF_TOP");
    expect(warns(inLane(root({ pinned: [bad.ref] }), capDoc([lake(), bad])))).toContain("E_CAP_REF_TOP");
    const ok = inLane(root(), capDoc([park(), { ref: "part/place/banff-national-park#lake-louise-area", type: "nature.protected.zone", layer: "place", name: "Lake Louise area", part_of: ["place/banff-national-park"] }]));
    expect(errs(ok)).toEqual([]);
    expect(warns(ok)).toEqual([]);
  });
});

describe("validator: source and target kinds", () => {
  it("a park with a zone, a lake in the zone, parking, a hike, an entry fee covered by a system pass and a tour that includes it is valid", () => {
    const r = root();
    const doc = capDoc([
      park("banff-national-park", { run_by: "operator/parks-canada", covers_areas: ["CA/AB/banff-national-park"] }),
      { ref: "part/place/banff-national-park#lake-louise-area", type: "nature.protected.zone", layer: "place", name: "Lake Louise area", part_of: ["place/banff-national-park"] },
      lake("moraine-lake", { part_of: ["part/place/banff-national-park#lake-louise-area"] }),
      parking(),
      hike("larch-valley", { starts_at: ["part/place/moraine-lake#parking"], reaches: ["place/sentinel-pass"] }),
      lake("sentinel-pass", { type: "nature.landform.pass" }),
      hike("larch-valley-meadows", { variant_of: "part/place/moraine-lake#larch-valley", starts_at: ["part/place/moraine-lake#parking"] }),
      offer("discovery-pass", "access.pass.park_pass"),
      offer("daily-admission", "access.pass.entry_fee", { covered_by: ["offer/place/banff-national-park#discovery-pass"] }),
      offer("guided-hike", "mountain.alpine.guided_summit", { at: undefined, starts_at: ["part/place/moraine-lake#parking"], includes: ["offer/place/banff-national-park#daily-admission"], run_by: "operator/parks-canada" }),
    ]);
    const res = inLane(r, doc);
    expect(errs(res), JSON.stringify(res.errors.filter((e) => GRAPH.test(e.code)))).toEqual([]);
    expect(warns(res), JSON.stringify(res.warnings.filter((e) => GRAPH.test(e.code)))).toEqual([]);
  });
  it("E_CAP_REL_KIND: run_by on a lake, parks_for on a lake, includes on an access offer, covered_by on a rental", () => {
    const r = root();
    expect(errs(inLane(r, capDoc([lake("moraine-lake", { run_by: "operator/parks-canada" })])))).toEqual(["E_CAP_REL_KIND"]);
    expect(errs(inLane(r, capDoc([lake("moraine-lake"), lake("lake-louise", { parks_for: ["place/moraine-lake"] })])))).toEqual(["E_CAP_REL_KIND"]);
    expect(errs(inLane(r, capDoc([park(), offer("fee", "access.pass.entry_fee"), offer("fee2", "access.pass.entry_fee", { includes: ["offer/place/banff-national-park#fee"] })])))).toEqual(["E_CAP_REL_KIND"]);
    expect(errs(inLane(r, capDoc([park(), offer("pass", "access.pass.park_pass"), offer("boats", "water.boat.boat_rental.rowboat", { covered_by: ["offer/place/banff-national-park#pass"] })])))).toEqual(["E_CAP_REL_KIND"]);
    // a route may now hold variant_of; a protected area run_by
    expect(errs(inLane(r, capDoc([park("banff-national-park", { run_by: "operator/parks-canada" })])))).toEqual([]);
  });
  it("E_CAP_REL_TARGET: an access place parks_for an offer, an offer on a place, a route starts_at a route, a place part_of a route", () => {
    const r = root();
    const raft = { ref: "offer/place/moraine-lake#raft", type: "water.river.rafting", layer: "offer", name: "Raft", at: ["place/moraine-lake"] };
    expect(errs(inLane(r, capDoc([lake(), raft, parking({ parks_for: ["offer/place/moraine-lake#raft"] })])))).toEqual(["E_CAP_REL_TARGET"]);
    expect(errs(inLane(r, capDoc([lake(), { ...raft, at: undefined, on: [{ ref: "place/moraine-lake" }] }])))).toEqual(["E_CAP_REL_TARGET"]);
    const line = { ref: "place/lagazuoi", type: "ride.lift.cable_car", layer: "route", name: "Lagazuoi cable car" };
    expect(errs(inLane(r, capDoc([lake(), line, hike("tunnels", { starts_at: ["place/lagazuoi"] })])))).toEqual(["E_CAP_REL_TARGET"]);
    expect(errs(inLane(r, capDoc([lake(), hike("whole"), lake("lake-louise", { part_of: ["part/place/moraine-lake#whole"] })])))).toEqual(["E_CAP_REL_TARGET"]);
    // a route part_of a route is a stage: allowed
    expect(errs(inLane(r, capDoc([lake(), hike("whole"), hike("stage-1", { part_of: ["part/place/moraine-lake#whole"] })])))).toEqual([]);
    // covered_by a shuttle seat: not a pass that covers
    expect(errs(inLane(r, capDoc([park(), offer("seat", "access.pass.shuttle_seat"), offer("fee", "access.pass.entry_fee", { covered_by: ["offer/place/banff-national-park#seat"] })])))).toEqual(["E_CAP_REL_TARGET"]);
  });
  it("E_CAP_REL_TARGET severity: decided by the known list only (EG-R0 S1): a known fault warns, a pinned record's new fault errors, strict makes both errors", () => {
    const raft = { ref: "offer/place/moraine-lake#raft", type: "water.river.rafting", layer: "offer", name: "Raft", at: ["place/moraine-lake"] };
    const doc = capDoc([lake(), raft, parking({ parks_for: ["offer/place/moraine-lake#raft"] })]);
    const pinned = inLane(root({ pinned: ["part/place/moraine-lake#parking"] }), doc);
    expect(errs(pinned)).toEqual(["E_CAP_REL_TARGET"]);
    expect(warns(pinned)).toEqual([]);
    const fault = { code: "E_CAP_REL_TARGET", ref: "part/place/moraine-lake#parking", rel: "parks_for", target: "offer/place/moraine-lake#raft" };
    const known = inLane(root({ known: [fault] }), doc);
    expect(errs(known)).toEqual([]);
    expect(warns(known)).toEqual(["E_CAP_REL_TARGET"]);
    // the known list names one link: the same record pointing wrongly elsewhere still errors
    const other = inLane(root({ known: [{ ...fault, target: "offer/place/moraine-lake#other" }] }), doc);
    expect(errs(other)).toEqual(["E_CAP_REL_TARGET"]);
    expect(errs(inLane(root({ known: [fault], strict: ["E_CAP_REL_TARGET"] }), doc))).toEqual(["E_CAP_REL_TARGET"]);
    expect(errs(inLane(root({ pinned: [fault.ref], strict: ["E_CAP_REL_TARGET"] }), doc))).toEqual(["E_CAP_REL_TARGET"]);
    // a draft outside the store warns
    expect(levelOfLink("E_CAP_REL_TARGET", ["x"], "on", "y", false, { pinned: new Set(), strict: new Set(), townsLayer: false })).toBe("warning");
  });
  it("the ten faults of entity-graph 11.2 are listed once in the shipped gap budget and warn there", async () => {
    const { REPO } = await import("./helpers.ts");
    const { loadBudget } = await import("../../src/capture/gapBudget.ts");
    const known = loadBudget(REPO)?.known ?? [];
    expect(known.length).toBeLessThanOrEqual(10); // only shrinks (EG-D removes each as it fixes it)
    expect(new Set(known.map((k) => `${k.ref}|${k.rel}|${k.target}`)).size).toBe(known.length);
    for (const k of known) expect(k.code).toBe("E_CAP_REL_TARGET");
  });
});

describe("validator: variants, cycles, symmetry, cardinality", () => {
  it("E_CAP_VARIANT: another layer or category, or a variant of a variant", () => {
    const r = root();
    expect(errs(inLane(r, capDoc([lake(), hike("main"), hike("short", { variant_of: "part/place/moraine-lake#main" })])))).toEqual([]);
    expect(errs(inLane(r, capDoc([lake(), hike("main"), hike("short", { variant_of: "place/moraine-lake" })])))).toEqual(["E_CAP_VARIANT"]);
    const raft = { ref: "offer/place/moraine-lake#raft", type: "water.river.rafting", layer: "offer", name: "Raft", at: ["place/moraine-lake"] };
    const tour = { ...raft, ref: "offer/place/moraine-lake#tour", type: "mountain.alpine.guided_summit", variant_of: "offer/place/moraine-lake#raft" };
    expect(errs(inLane(r, capDoc([lake(), raft, tour])))).toEqual(["E_CAP_VARIANT"]);
    const two = capDoc([lake(), hike("main"), hike("short", { variant_of: "part/place/moraine-lake#main" }), hike("shorter", { variant_of: "part/place/moraine-lake#short" })]);
    const res = inLane(r, two);
    expect(errs(res)).toEqual(["E_CAP_VARIANT"]);
    expect(res.errors.find((e) => e.code === "E_CAP_VARIANT")!.message).toMatch(/One level only/);
  });
  it("E_CAP_REL_CYCLE: part_of loops, a loop through covers_areas membership, variant_of loops", () => {
    const r = root();
    expect(errs(inLane(r, capDoc([lake("moraine-lake", { part_of: ["place/lake-louise"] }), lake("lake-louise", { part_of: ["place/moraine-lake"] })])))).toEqual(["E_CAP_REL_CYCLE"]);
    // Yoho covers an area; Banff sits in that area (so it is Yoho's member) and Yoho says part_of Banff
    const areaLoop = capDoc([park("yoho-national-park", { covers_areas: ["CA/BC/yoho"], part_of: ["place/banff-national-park"] }), park("banff-national-park", { area_id: "CA/BC/yoho" })]);
    expect(errs(inLane(r, areaLoop))).toEqual(["E_CAP_REL_CYCLE"]);
    // a park in its own covered area is not its own member, and an explicit part_of wins over area membership
    expect(errs(inLane(r, capDoc([park("banff-national-park", { covers_areas: ["CA/AB/banff"], area_id: "CA/AB/banff" }), lake("moraine-lake", { area_id: "CA/AB/banff" })])))).toEqual([]);
    const vloop = capDoc([lake(), hike("a", { variant_of: "part/place/moraine-lake#b" }), hike("b", { variant_of: "part/place/moraine-lake#a" })]);
    expect(errs(inLane(r, vloop))).toEqual(["E_CAP_REL_CYCLE", "E_CAP_VARIANT"]);
  });
  it("E_CAP_REL_SYM: a symmetric link stored on both sides; once is fine", () => {
    const r = root();
    expect(errs(inLane(r, capDoc([lake("moraine-lake", { combo_with: ["place/lake-louise"] }), lake("lake-louise")])))).toEqual([]);
    expect(errs(inLane(r, capDoc([lake("moraine-lake", { combo_with: ["place/lake-louise"] }), lake("lake-louise", { combo_with: ["place/moraine-lake"] })])))).toEqual(["E_CAP_REL_SYM"]);
    // alternative_to joins records of one layer
    expect(errs(inLane(r, capDoc([lake(), hike("a", { alternative_to: ["place/moraine-lake"] })])))).toEqual(["E_CAP_REL_TARGET"]);
  });
  it("cardinality: ends_at holds one place (E_CAP_REL_CARD), a route one starts_at (W_CAP_REL_CARD), two part_of parents (W_CAP_REL_PARENTS)", () => {
    const r = root();
    const res = inLane(r, capDoc([lake(), lake("lake-louise"), hike("a", { ends_at: ["place/moraine-lake", "place/lake-louise"] })]));
    expect(errs(res)).toEqual(["E_CAP_REL_CARD"]);
    const st = inLane(r, capDoc([lake(), lake("lake-louise"), hike("a", { starts_at: ["place/moraine-lake", "place/lake-louise"] })]));
    expect(errs(st)).toEqual([]);
    expect(warns(st)).toEqual(["W_CAP_REL_CARD"]);
    // an offer may meet at several places
    expect(warns(inLane(r, capDoc([lake(), lake("lake-louise"), { ref: "offer/place/moraine-lake#raft", type: "water.river.rafting", layer: "offer", name: "Raft", starts_at: ["place/moraine-lake", "place/lake-louise"] }])))).toEqual([]);
    const three = inLane(r, capDoc([park(), park("yoho-national-park"), lake("lake-louise"), lake("moraine-lake", { part_of: ["place/banff-national-park", "place/yoho-national-park", "place/lake-louise"] })]));
    expect(warns(three)).toEqual(["W_CAP_REL_PARENTS"]);
    expect(warns(inLane(r, capDoc([park(), park("yoho-national-park"), lake("moraine-lake", { part_of: ["place/banff-national-park", "place/yoho-national-park"] })])))).toEqual([]);
  });
  it("E_CAP_REL_DERIVED: every derived inverse is refused when typed", () => {
    const r = root();
    for (const k of ["members", "variants", "access_points", "offers_at", "covers", "included_in", "reached_by", "requirements"]) {
      const res = inLane(r, capDoc([lake("moraine-lake", { [k]: ["place/lake-louise"] }), lake("lake-louise")]));
      expect(res.errors.filter((e) => e.code === "E_CAP_REL_DERIVED").map((e) => e.path), k).toEqual([`/records/0/${k}`]);
    }
  });
});

describe("stages and inherited copies", () => {
  const stage = (n: number, from: string, to: string | null) => hike(`stage-${n}`, { part_of: ["part/place/moraine-lake#whole"], starts_at: [from], ...(to ? { ends_at: [to] } : {}) });
  const sites = ["place/moraine-lake", "place/lake-louise", "place/sentinel-pass", "place/lagazuoi"];
  it("W_CAP_STAGE_ORDER: stages that chain by ends_at to starts_at pass; a gap, a branch or a missing end warns once", () => {
    const r = root();
    const base = [lake(), lake("lake-louise"), lake("sentinel-pass"), lake("lagazuoi"), hike("whole")];
    const good = inLane(r, capDoc([...base, stage(2, sites[1]!, sites[2]!), stage(1, sites[0]!, sites[1]!), stage(3, sites[2]!, sites[3]!)]));
    expect(warns(good)).toEqual([]);
    const gap = inLane(r, capDoc([...base, stage(1, sites[0]!, sites[1]!), stage(2, sites[2]!, sites[3]!)]));
    expect(gap.warnings.filter((w) => w.code === "W_CAP_STAGE_ORDER")).toHaveLength(1);
    const missing = inLane(r, capDoc([...base, stage(1, sites[0]!, null), stage(2, sites[1]!, sites[2]!)]));
    expect(warns(missing)).toEqual(["W_CAP_STAGE_ORDER"]);
  });
  it("stageChainProblem names the fault", () => {
    const s = (ref: string, a: string, b?: string) => ({ ref, type: "nature.trail.hike", layer: "route", starts_at: [a], ...(b ? { ends_at: [b] } : {}) }) as CaptureRecord;
    expect(stageChainProblem([s("1", "a", "b"), s("2", "b", "c")])).toBeNull();
    expect(stageChainProblem([s("1", "a", "b")])).toBeNull();
    expect(stageChainProblem([s("1", "a", "b"), s("2", "b", "c"), s("3", "b", "d")])).toMatch(/ends where 2 stages start/);
    expect(stageChainProblem([s("1", "a", "b"), s("2", "b", "a")])).toMatch(/loop/);
    expect(stageChainProblem([s("1", "a"), s("2", "b", "c")])).toMatch(/lack starts_at or ends_at/);
  });
  it("W_CAP_INHERITED_COPY: a member repeats its container's conditions link; a zone repeats the park's fee", () => {
    const r = root();
    const cond = { kind: "conditions", url: "https://parks.canada.ca/pn-np/ab/banff/conditions", state: "filled" };
    const res = inLane(r, capDoc([park("banff-national-park", { links: [cond] }), lake("moraine-lake", { part_of: ["place/banff-national-park"], links: [cond] })]));
    expect(warns(res)).toEqual(["W_CAP_INHERITED_COPY"]);
    // the same link through covers_areas membership
    const area = inLane(r, capDoc([park("banff-national-park", { links: [cond], covers_areas: ["CA/AB/banff"] }), lake("moraine-lake", { area_id: "CA/AB/banff", links: [cond] })]));
    expect(warns(area)).toEqual(["W_CAP_INHERITED_COPY"]);
    // its own different link is fine
    expect(warns(inLane(r, capDoc([park("banff-national-park", { links: [cond] }), lake("moraine-lake", { part_of: ["place/banff-national-park"], links: [{ ...cond, url: "https://example.org/moraine" }] })])))).toEqual([]);
    const book = { kind: "booking", url: "https://reservation.pc.gc.ca/", state: "filled" };
    const zone = { ref: "part/place/banff-national-park#lake-louise-area", type: "nature.protected.zone", layer: "place", name: "Lake Louise area", part_of: ["place/banff-national-park"] };
    const fee = offer("daily-admission", "access.pass.entry_fee", { links: [book] });
    const copy = offer("zone-admission", "access.pass.entry_fee", { at: ["part/place/banff-national-park#lake-louise-area"], links: [book] });
    expect(warns(inLane(r, capDoc([park(), zone, fee, copy])))).toEqual(["W_CAP_INHERITED_COPY"]);
    // a zone's own requirement of another kind (a shuttle seat) is not a copy
    expect(warns(inLane(r, capDoc([park(), zone, fee, { ...copy, type: "access.pass.shuttle_seat" }])))).toEqual([]);
  });
});

describe("loadWorld: derived inverses from RELATION_RULES, with the legacy names", () => {
  it("builds every inverse; at, on and children are the same arrays as offers_at, offers_on and members", () => {
    const r = root();
    put(r, LANE, capDoc([
      park(), lake("moraine-lake", { part_of: ["place/banff-national-park"] }), parking(),
      hike("main", { starts_at: ["part/place/moraine-lake#parking"], passes: [{ ref: "place/lake-louise" }], ends_at: ["place/sentinel-pass"], reaches: ["place/sentinel-pass"] }),
      hike("short", { variant_of: "part/place/moraine-lake#main" }),
      offer("pass", "access.pass.park_pass"), offer("fee", "access.pass.entry_fee", { covered_by: ["offer/place/banff-national-park#pass"] }),
      offer("tour", "mountain.alpine.guided_summit", { includes: ["offer/place/banff-national-park#fee"], run_by: "operator/parks-canada", on: [{ ref: "part/place/moraine-lake#main" }] }),
    ]));
    const w = loadWorld(r);
    const inc = (ref: string) => w.incoming.get(ref) ?? emptyIncoming();
    const parkIn = inc("place/banff-national-park");
    expect(parkIn.members).toEqual(["place/moraine-lake"]);
    expect(parkIn.children).toBe(parkIn.members);
    expect(parkIn.offers_at).toEqual(["offer/place/banff-national-park#pass", "offer/place/banff-national-park#fee", "offer/place/banff-national-park#tour"]);
    expect(parkIn.at).toBe(parkIn.offers_at);
    const lakeIn = inc("place/moraine-lake");
    expect(lakeIn.access_points).toEqual(["part/place/moraine-lake#parking"]);
    expect(lakeIn.parks_for).toEqual(["part/place/moraine-lake#parking"]);
    expect(lakeIn.serves).toEqual([]);
    expect(inc("place/lake-louise").passed_by).toEqual(["part/place/moraine-lake#main"]);
    expect(inc("place/sentinel-pass").ends_here).toEqual(["part/place/moraine-lake#main"]);
    expect(inc("place/sentinel-pass").reached_by).toEqual(["part/place/moraine-lake#main"]);
    expect(inc("part/place/moraine-lake#parking").starts_here).toEqual(["part/place/moraine-lake#main"]);
    const main = inc("part/place/moraine-lake#main");
    expect(main.variants).toEqual(["part/place/moraine-lake#short"]);
    expect(main.offers_on).toEqual(["offer/place/banff-national-park#tour"]);
    expect(main.on).toBe(main.offers_on);
    expect(inc("offer/place/banff-national-park#pass").covers).toEqual(["offer/place/banff-national-park#fee"]);
    expect(inc("offer/place/banff-national-park#fee").included_in).toEqual(["offer/place/banff-national-park#tour"]);
    expect(inc("operator/parks-canada").operator_of).toEqual(["offer/place/banff-national-park#tour"]);
    expect(Object.keys(LEGACY_INCOMING_ALIASES).every((k) => k in emptyIncoming())).toBe(true);
  });
});
