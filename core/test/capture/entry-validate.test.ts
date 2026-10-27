// PA-C (protected-area-entry 5.1 C10, entity-graph 5.2): the validator rules of the parks contract, each with a passing and a failing case,
// and the acceptance check of section 12: the D8-R proposals, reshaped per section 11, validate with no relevance record.
import { describe, expect, it } from "vitest";
import { PARK_ERROR_CODES, PARK_ERROR_LIST, PARK_WARNING_CODES, PARK_WARNING_LIST } from "../../src/validate/codes.ts";
import { RefResolver } from "../../src/suitability/refs.ts";
import { SYSTEM_PASS_REF_RE, isSystemPass } from "../../src/schema/capture/relations.ts";
import { capDoc, put } from "./helpers.ts";
import { D8R_CAMPSITE, D8R_OFFERS, MORAINE, OHARA, PASS, PLACE_RECORDS, SOURCES, at, codesOf, doc, inLane, parksRoot, requirement } from "./entry-helpers.ts";

const [, FEE, ROAM, KANA, BUS] = D8R_OFFERS as Record<string, any>[];
const placeRecs = PLACE_RECORDS as Record<string, any>[];
const BANFF = placeRecs[0]!;
const lake = (over: Record<string, unknown> = {}) => ({ ref: "place/lake-louise", type: "water.body.lake", layer: "place", name: "Lake Louise", area_id: "CA/AB/banff-national-park", ...over });
const zone = (over: Record<string, unknown> = {}) => ({ ...placeRecs[2]!, ...over });

describe("the code blocks", () => {
  it("lists the parks codes of 5.1 C10 and entity-graph 5.2 in their own block", () => {
    expect(PARK_ERROR_LIST).toEqual(["E_ENTRY_SCHEMA", "E_WINDOW_THEN", "E_PARK_ZONE", "E_PARK_AREA"]);
    expect(PARK_WARNING_LIST).toEqual(["W_PARK_AREA", "W_ENTRY_OVERRIDE"]);
    for (const c of [...PARK_ERROR_LIST, ...PARK_WARNING_LIST]) expect({ ...PARK_ERROR_CODES, ...PARK_WARNING_CODES }[c].length).toBeGreaterThan(20);
  });
});

describe("acceptance (12, PA-C row): the D8-R proposals validate with no relevance record", () => {
  it("the five access offers (system pass, entry fee, Roam monthly batch, Kananaskis vehicle permit, Lake O'Hara lottery bus) raise no error and no warning", () => {
    const res = inLane(parksRoot(), doc([...PLACE_RECORDS, ...D8R_OFFERS]));
    expect(res.errors, JSON.stringify(res.errors)).toEqual([]);
    const offerPaths = D8R_OFFERS.map((_, i) => `/records/${PLACE_RECORDS.length + i}`);
    expect(res.warnings.filter((w) => offerPaths.some((p) => w.path === p || w.path.startsWith(`${p}/`)))).toEqual([]);
  });
  it("the frontcountry campsite (a lodging offer) has its summary answered; it waits only on the stay contract (access_cost, cost_band, wheelchair: PA-3C)", () => {
    const res = inLane(parksRoot(), doc([...PLACE_RECORDS, D8R_CAMPSITE]));
    const tier = res.errors.filter((e) => e.code === "W_TIER_REQUIRED");
    expect(tier).toHaveLength(1);
    expect(tier[0]!.message).toMatch(/unanswered: access_cost, cost_band, wheelchair\./);
    expect(codesOf(res.errors)).toEqual(["W_TIER_REQUIRED"]);
  });
});

describe("E_ENTRY_SCHEMA", () => {
  it("entry belongs to an access.pass offer", () => {
    const r = parksRoot();
    expect(at(inLane(r, doc([...PLACE_RECORDS, FEE])).errors, "E_ENTRY_SCHEMA")).toEqual([]);
    expect(at(inLane(r, doc([...PLACE_RECORDS.filter((p) => p.ref !== "place/lake-louise"), lake({ entry: FEE.entry })])).errors, "E_ENTRY_SCHEMA")).toEqual(["/records/5/entry"]);
    const raft = { ...FEE, ref: "offer/place/banff-national-park#raft", type: "water.river.rafting", covered_by: undefined };
    expect(at(inLane(r, doc([...PLACE_RECORDS, raft])).errors, "E_ENTRY_SCHEMA")).toEqual([`/records/${PLACE_RECORDS.length}/entry`]);
  });
  it("for_types names nodes of the type tree", () => {
    const r = parksRoot();
    const permit = (t: string[]) => requirement("offer/place/banff-national-park#fishing-permit", "access.pass.activity_permit", { at: ["place/banff-national-park"], entry: { ...FEE.entry, v: { ...FEE.entry.v, for_types: t } } });
    expect(at(inLane(r, doc([...PLACE_RECORDS, permit(["water.fishing", "mountain.climb"])])).errors, "E_ENTRY_SCHEMA")).toEqual([]);
    expect(at(inLane(r, doc([...PLACE_RECORDS, permit(["water.fishing", "water.angling"])])).errors, "E_ENTRY_SCHEMA")).toEqual([`/records/${PLACE_RECORDS.length}/entry/v/for_types/1`]);
  });
});

describe("E_WINDOW_THEN", () => {
  const win = (w: unknown) => ({ ...BUS, window: { ...BUS.window, v: w } });
  it("a lottery, a launch day or a batch may have one second phase", () => {
    expect(at(inLane(parksRoot(), doc([...PLACE_RECORDS, BUS])).errors, "E_WINDOW_THEN")).toEqual([]);
  });
  it("a then of a then is reported as E_WINDOW_THEN (not a bare schema error), and the rest of the record is still checked", () => {
    const res = inLane(parksRoot(), doc([...PLACE_RECORDS, win({ rule: "lottery", then: { rule: "rolling", then: { rule: "same_day" } } })]));
    expect(at(res.errors, "E_WINDOW_THEN")).toEqual([`/records/${PLACE_RECORDS.length}/window/v/then/then`]);
    expect(codesOf(res.errors)).toEqual(["E_WINDOW_THEN"]);
  });
  it("anytime and on_arrival have no phases", () => {
    for (const rule of ["anytime", "on_arrival"]) {
      const res = inLane(parksRoot(), doc([...PLACE_RECORDS, win({ rule, then: { rule: "rolling", days_before: 2 } })]));
      expect(at(res.errors, "E_WINDOW_THEN"), rule).toEqual([`/records/${PLACE_RECORDS.length}/window/v/then`]);
    }
  });
});

describe("E_PARK_ZONE", () => {
  const others = PLACE_RECORDS.filter((p) => p.ref !== OHARA);
  it("a zone names its park in part_of", () => {
    expect(at(inLane(parksRoot(), doc([...others, zone()])).errors, "E_PARK_ZONE")).toEqual([]);
  });
  it("a zone with no part_of, or part_of a record that is no protected area, errors", () => {
    expect(at(inLane(parksRoot(), doc([...others, zone({ part_of: undefined })])).errors, "E_PARK_ZONE")).toEqual([`/records/${others.length}/part_of`]);
    expect(at(inLane(parksRoot(), doc([...others, zone({ part_of: ["place/lake-louise"] })])).errors, "E_PARK_ZONE")).toEqual([`/records/${others.length}/part_of`]);
  });
  it("a zone whose ref also breaks E_CAP_REF_TOP is reported once, there, with the part_of fix in the message", () => {
    const bad = zone({ ref: "place/peace-park", part_of: undefined });
    const res = inLane(parksRoot({ pinned: others.map((p) => p.ref) }), doc([...others, bad]));
    expect(at(res.errors, "E_PARK_ZONE")).toEqual([]);
    const top = res.errors.filter((e) => e.code === "E_CAP_REF_TOP");
    expect(top).toHaveLength(1);
    expect(top[0]!.message).toMatch(/also name the protected area it sits in with part_of/);
  });
});

describe("E_PARK_AREA and W_PARK_AREA", () => {
  const others = PLACE_RECORDS.filter((p) => p.ref !== BANFF.ref);
  it("covers_areas names areas of the store", () => {
    expect(at(inLane(parksRoot(), doc([BANFF, ...others])).errors, "E_PARK_AREA")).toEqual([]);
    const res = inLane(parksRoot(), doc([{ ...BANFF, covers_areas: ["CA/AB/banff-national-park", "CA/AB/banf-national-park", "CA/AB"] }, ...others]));
    expect(at(res.errors, "E_PARK_AREA")).toEqual(["/records/0/covers_areas", "/records/0/covers_areas"]);
    expect(res.errors.find((e) => e.message.includes('"CA/AB"'))?.message).toMatch(/country or region/);
  });
  it("an area named after the park and not covered warns; covering it, or no such area, is quiet", () => {
    const wat = { ref: "place/waterton-lakes", type: "nature.protected.national_park", layer: "place", name: "Waterton Lakes National Park", area_id: "CA/AB/waterton-lakes" };
    const pin = parksRoot({ pinned: [...PLACE_RECORDS.map((p) => p.ref), wat.ref] });
    expect(at(inLane(pin, doc([...PLACE_RECORDS, wat])).warnings, "W_PARK_AREA")).toEqual([`/records/${PLACE_RECORDS.length}/covers_areas`]);
    expect(at(inLane(pin, doc([...PLACE_RECORDS, { ...wat, covers_areas: ["CA/AB/waterton-lakes"] }])).warnings, "W_PARK_AREA")).toEqual([]);
    // by name: the area slug is the park's name as a slug
    const byName = { ...wat, ref: "place/peace-park", name: "Waterton Lakes" };
    expect(at(inLane(parksRoot({ pinned: [...PLACE_RECORDS.map((p) => p.ref), byName.ref] }), doc([...PLACE_RECORDS, byName])).warnings, "W_PARK_AREA")).toEqual([`/records/${PLACE_RECORDS.length}/covers_areas`]);
    // a zone is not asked
    expect(at(inLane(pin, doc([...PLACE_RECORDS])).warnings, "W_PARK_AREA")).toEqual([]);
  });
});

describe("W_ENTRY_OVERRIDE (entity-graph 5.2, 7.1)", () => {
  const relDoc = (src: string[]) => ({ schema: "relevance/1", trip: "fixture-trip", lane: "r", researched: "2026-10-26", agent: "test", model: "none", sources: SOURCES, records: [{ ref: "place/lake-louise", access_cost: { v: null, state: "no_limit", basis: "official_info", src } }] });
  const run = (src: string[], records: unknown[]) => {
    const r = parksRoot();
    put(r, "data/relevance/fixture-trip/r.json", relDoc(src));
    return inLane(r, doc(records));
  };
  it("a member's own sourced no_limit that hides an inherited requirement warns, naming it", () => {
    const res = run(["src-0001"], [...PLACE_RECORDS, FEE]);
    const w = res.warnings.filter((x) => x.code === "W_ENTRY_OVERRIDE");
    expect(w.map((x) => x.path)).toEqual(["/records/5"]);
    expect(w[0]!.message).toContain("offer/place/banff-national-park#daily-admission (at place/banff-national-park)");
  });
  it("no warning without a source, or with nothing to inherit", () => {
    expect(at(run([], [...PLACE_RECORDS, FEE]).warnings, "W_ENTRY_OVERRIDE")).toEqual([]);
    expect(at(run(["src-0001"], [...PLACE_RECORDS]).warnings, "W_ENTRY_OVERRIDE")).toEqual([]);
  });
});

describe("the system pass (QP1): ref form, resolver, orphan exemption, the trip-less lane", () => {
  const pass = D8R_OFFERS[0] as Record<string, any>;
  it("the ref form and the predicate", () => {
    expect(SYSTEM_PASS_REF_RE.test(PASS)).toBe(true);
    expect(SYSTEM_PASS_REF_RE.test("offer/operator/parks-canada")).toBe(false);
    expect(isSystemPass(pass as never, 1)).toBe(true);
    expect(isSystemPass(pass as never, 0)).toBe(false); // nothing names it in covered_by yet
    expect(isSystemPass({ ...pass, run_by: "operator/roam-transit" } as never, 1)).toBe(false);
    expect(isSystemPass({ ...pass, type: "access.pass.vehicle_permit" } as never, 1)).toBe(false);
    expect(isSystemPass({ ...pass, at: ["place/banff-national-park"] } as never, 1)).toBe(false);
  });
  it("the resolver accepts offer/operator/<slug>#<product> only for an operator of operators.json, never under part/", () => {
    const res = new RefResolver(parksRoot());
    expect(res.why(PASS)).toBeNull();
    expect(res.why("offer/operator/nobody#pass")).toMatch(/not in data\/capture\/operators.json/);
    expect(res.why("offer/operator/parks-canada#")).toMatch(/product is not empty/);
    expect(res.why("part/operator/parks-canada#office")).toMatch(/unknown ref form/);
  });
  it("covered by a fee, the pass needs no place; with no fee, another operator or a non-pass type it is an orphan", () => {
    const r = parksRoot();
    expect(at(inLane(r, doc([...PLACE_RECORDS, pass, FEE])).errors, "E_PLACE_ORPHAN")).toEqual([]);
    const alone = inLane(r, doc([...PLACE_RECORDS, pass]));
    expect(at(alone.errors, "E_PLACE_ORPHAN")).toEqual([`/records/${PLACE_RECORDS.length}/at`]);
    expect(alone.errors.find((e) => e.code === "E_PLACE_ORPHAN")!.message).toMatch(/needs no place once a fee names it in covered_by/);
    expect(alone.errors.find((e) => e.code === "W_TIER_REQUIRED")?.message).toMatch(/unanswered: at\./);
    expect(at(inLane(r, doc([...PLACE_RECORDS, { ...pass, run_by: "operator/roam-transit" }, FEE])).errors, "E_PLACE_ORPHAN")).toEqual([`/records/${PLACE_RECORDS.length}/at`]);
    expect(at(inLane(r, doc([...PLACE_RECORDS, { ...pass, ref: "offer/operator/nobody#pass" }, FEE])).errors, "E_CAP_REF")).toEqual([`/records/${PLACE_RECORDS.length}/ref`]);
  });
  it("a system pass may sit in the trip-less lane; one of an unknown operator may not", () => {
    const r = parksRoot();
    put(r, "data/capture/fixture-trip/pa.json", doc([...PLACE_RECORDS, FEE]));
    const lane = (p: unknown) => inLane(r, capDoc([p], { trip: "catalogue", sources: SOURCES }), "data/capture/catalogue/PA-ca.json");
    const ok = lane(pass);
    expect(at(ok.errors, "E_CAP_LANE")).toEqual([]);
    expect(at(ok.errors, "E_PLACE_ORPHAN")).toEqual([]);
    expect(at(lane({ ...pass, ref: "offer/operator/nobody#pass" }).errors, "E_CAP_LANE")).toEqual(["/records/0/ref"]);
  });
});

describe("summary on the capture record (C1)", () => {
  it("is for offers only", () => {
    const res = inLane(parksRoot(), doc([...PLACE_RECORDS.filter((p) => p.ref !== "place/lake-louise"), lake({ summary: "A lake." })]));
    expect(at(res.errors, "E_CAP_SCHEMA")).toEqual(["/records/5/summary"]);
  });
  it("is a public summary: the keep rule's 160-character limit applies (warn mode)", () => {
    const long = { ...ROAM, summary: "a".repeat(170) };
    const res = inLane(parksRoot(), doc([...PLACE_RECORDS, long]));
    expect([...res.errors, ...res.warnings].filter((e) => e.code === "E_SUMMARY_LONG").map((e) => e.path)).toEqual([`/records/${PLACE_RECORDS.length}/summary`]);
    void KANA; void MORAINE;
  });
});
