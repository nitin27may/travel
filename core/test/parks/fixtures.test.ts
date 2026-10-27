// PA-FX (protected-area-entry 13): synthetic parks (core/test/fixtures/protected-areas/**, README there) run through the real validator and
// the entry helpers. Valid files must raise no parks code, no error and no warning on an offer; each file in invalid/ raises exactly the codes
// listed in invalid/expected.json. Nothing here is real research, a trip or household data.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateDoc } from "../../src/validate/index.ts";
import { completeness, readProperty } from "../../src/capture/engine.ts";
import { loadWorld } from "../../src/capture/records.ts";
import { ENTRY_REQUIRED, VISIT_MODE, WINDOW_RULE } from "../../src/schema/capture/records.ts";
import { PRICE_PER_V2, PRICE_RESIDENCY } from "../../src/schema/enums.ts";
import { isSystemPass } from "../../src/schema/capture/relations.ts";
import { put, scope, scratchRoot } from "../capture/helpers.ts";

const HERE = fileURLToPath(new URL("../fixtures/protected-areas/", import.meta.url));
const GRAPH = fileURLToPath(new URL("../fixtures/graph/", import.meta.url));
const readJson = (base: string, rel: string) => JSON.parse(readFileSync(join(base, rel), "utf8")) as Record<string, any>;
const names = (sub: string) => readdirSync(join(HERE, sub)).filter((f) => f.endsWith(".json") && f !== "expected.json").sort();
const VALID = names("valid");
const INVALID = names("invalid");
const EXPECTED = readJson(HERE, "invalid/expected.json") as Record<string, { errors: string[]; warnings: string[] }>;
const laneOf = (n: string) => `data/capture/park-fixture/${n}`;

// the codes this task is about; the stub place records also raise tier and placement findings that are not the fixtures' point
const MINE = /^(E|W)_(ENTRY|WINDOW|PARK|PLACE_ORPHAN|CAP_(REL_|REF|LANE))/;
const mine = (list: { code: string }[]) => [...new Set(list.filter((e) => MINE.test(e.code)).map((e) => e.code))].sort();
const recordsOf = (sub: string, n: string) => readJson(HERE, `${sub}/${n}`).records as Record<string, any>[];
const ALL_RECORDS = VALID.flatMap((n) => recordsOf("valid", n));
const placeSlugs = () => ALL_RECORDS.filter((r) => /^place\//.test(r.ref)).map((r) => r.ref.slice(6));

function root(extra: { sub?: string; names?: string[]; relevance?: unknown } = {}): string {
  const graphOps = readJson(GRAPH, "operators.json");
  const mineOps = readJson(HERE, "operators.json");
  const slugs = new Set(placeSlugs());
  for (const n of INVALID) for (const r of recordsOf("invalid", n)) if (/^place\//.test(r.ref)) slugs.add(r.ref.slice(6));
  const r = scratchRoot({
    "data/suitability/scope.json": scope([...slugs]),
    "data/capture/operators.json": { ...graphOps, operators: [...graphOps.operators, ...mineOps.operators] },
    "data/locations/locations.json": readJson(HERE, "locations.json"),
    "data/capture/gap-budget.json": { schema: "capture-gap-budget/1", note: "", updated: "2026-10-26", strict: [], counts: {}, raised: [], pinned: { on: "2026-10-26", note: "", refs: [] } },
  });
  for (const n of extra.names ?? []) put(r, laneOf(n), readJson(HERE, `${extra.sub}/${n}`));
  return r;
}
const validate = (r: string, sub: string, n: string) => validateDoc(readJson(HERE, `${sub}/${n}`), "sidecar", r, { kind: "capture" }, join(r, laneOf(n)));

describe("protected-area fixtures: the valid parks", () => {
  const r = root({ sub: "valid", names: VALID });
  it("has four parks in different jurisdictions", () => {
    expect(VALID).toHaveLength(4);
    const areas = ALL_RECORDS.flatMap((x) => x.covers_areas ?? []);
    expect(new Set(areas.map((a: string) => a.split("/")[1])).size).toBeGreaterThanOrEqual(5);
  });
  for (const n of VALID) {
    it(`${n} validates: no parks code, no schema error, no warning on an offer`, () => {
      const res = validate(r, "valid", n);
      const bad = res.errors.filter((e) => !/^(W_TIER_REQUIRED|W_PLACE_POINT|E_PLACE_AREA)$/.test(e.code));
      expect(bad, JSON.stringify(bad)).toEqual([]);
      expect(mine(res.warnings)).toEqual([]);
      const offerWarn = res.warnings.filter((w) => /^\/records\/\d+/.test(w.path) && (r0 => r0?.layer === "offer" && !(r0.type.startsWith("stay.") && w.code === "W_CAP_BELOW_USABLE"))(recordsOf("valid", n)[Number(w.path.split("/")[2])]));
      expect(offerWarn, JSON.stringify(offerWarn)).toEqual([]);
    });
  }
});

describe("coverage: every entry kind of protected-area-entry 4.1 and 4.2 appears in at least one valid file", () => {
  const offers = ALL_RECORDS.filter((x) => x.layer === "offer");
  const types = new Set(offers.map((o) => o.type));
  const prices = offers.flatMap((o) => o.price?.v ?? []);
  const entries = offers.map((o) => o.entry?.v).filter(Boolean);
  const rules = offers.flatMap((o) => (o.window?.v ? [o.window.v.rule, o.window.v.then?.rule] : [])).filter(Boolean);
  it("access types", () => {
    for (const t of ["access.pass.entry_fee", "access.pass.park_pass", "access.pass.timed_entry", "access.pass.day_use_permit", "access.pass.vehicle_permit", "access.pass.activity_permit", "access.pass.backcountry_permit", "access.pass.shuttle_seat", "stay.camp.campground"]) expect(types.has(t), t).toBe(true);
  });
  it("window rules, including a lottery and a fixed date that each have a then", () => {
    for (const rule of WINDOW_RULE) expect(rules, rule).toContain(rule);
    for (const first of ["lottery", "fixed_date"]) expect(offers.some((o) => o.window?.v?.rule === first && o.window.v.then), first).toBe(true);
  });
  it("entry: every required level but through, every visit mode, group, vehicle and person units, a 7-day validity, every exemption used in the fixtures", () => {
    for (const q of ENTRY_REQUIRED) expect(entries.some((e) => e.required === q), q).toBe(true);
    for (const m of VISIT_MODE.filter((x) => x !== "through")) expect(entries.some((e) => e.needed_for.includes(m)), m).toBe(true);
    for (const u of ["person", "vehicle", "group"]) expect(entries.some((e) => e.unit === u), u).toBe(true);
    expect(entries.some((e) => e.valid?.span === 7 && e.valid.unit === "day")).toBe(true);
    for (const who of ["camper", "through_traffic", "pass_holder", "resident", "school_group"]) expect(entries.some((e) => e.exemptions?.some((x: any) => x.who === who)), who).toBe(true);
    expect(entries.some((e) => e.quota && e.for_types && e.cancel && e.change)).toBe(false); // each is used, none is crammed into one record
    for (const k of ["quota", "for_types", "cancel", "change", "proof"]) expect(entries.some((e) => e[k]), k).toBe(true);
  });
  it("prices: person_night, resident and foreign rows, a free child row, a per-family row", () => {
    expect(PRICE_PER_V2).toContain("person_night");
    expect(prices.some((p) => p.per === "person_night")).toBe(true);
    for (const res of PRICE_RESIDENCY) expect(prices.some((p) => p.residency === res), res).toBe(true);
    expect(prices.some((p) => p.per === "child" && p.amount === 0)).toBe(true);
    expect(prices.some((p) => p.per === "family")).toBe(true);
  });
  it("the half-filled requirement carries searched_none and none_stated, the no-fee reserve carries no offer", () => {
    expect(offers.some((o) => o.window?.state === "searched_none" && o.price?.state === "none_stated")).toBe(true);
    expect(offers.filter((o) => (o.at ?? []).includes("place/open-meadow-reserve"))).toEqual([]);
  });
});

describe("derivation over the valid parks (loadWorld and the engine)", () => {
  const r = root({ sub: "valid", names: VALID });
  const w = loadWorld(r);
  const read = (key: string, ref: string) => readProperty(w, key, ref, w.cap.get(ref)!.rec, w.rel.get(ref)?.rec);
  const PASS = "offer/operator/alpha-parks-service#explorer-pass";
  it("the system pass is a system pass (covered by a fee, no place) and its place layer is answered", () => {
    const inc = w.incoming.get(PASS)!;
    expect(inc.covers).toContain("offer/place/highcrest-national-park#daily-admission");
    expect(isSystemPass(w.cap.get(PASS)!.rec as never, inc.covers.length)).toBe(true);
    expect(read("at", PASS)).toBe("firm");
  });
  it("a park with a requirement at it has a firm access_cost; one with none is a gap until authored", () => {
    for (const p of ["place/highcrest-national-park", "place/pinewater-provincial-park", "place/twinfall-national-park", "place/ember-ridge-national-park"]) expect(read("access_cost", p), p).toBe("firm");
    expect(read("access_cost", "place/open-meadow-reserve")).toBe("gap");
  });
  it("an access offer is never asked for access_cost and has its summary", () => {
    for (const o of ALL_RECORDS.filter((x) => x.layer === "offer" && x.type.startsWith("access.pass."))) {
      expect(read("summary", o.ref), o.ref).toBe("firm");
      const c = completeness(w, o.ref)!;
      expect([...c.missingBase, ...c.conditionalMissing].filter((k) => k === "access_cost" || k === "summary"), o.ref).toEqual([]);
    }
  });
  it("members: the zone and the straddle park's overlook name their park by part_of; the lakes are members by area", () => {
    expect(w.cap.get("part/place/highcrest-national-park#glacier-basin")!.rec.part_of).toEqual(["place/highcrest-national-park"]);
    expect(w.cap.get("place/twinfall-border-overlook")!.rec.part_of).toEqual(["place/twinfall-national-park"]);
    expect(w.cap.get("place/twinfall-east-lake")!.rec.area_id).toBe("ZZ/Q3/twinfall");
    expect(w.cap.get("place/twinfall-national-park")!.rec.covers_areas).toHaveLength(2);
  });
  it("the no-fee reserve answers access_cost once a sourced no_limit is authored on its relevance record", () => {
    const rr = root({ sub: "valid", names: VALID });
    put(rr, "data/relevance/park-fixture/r.json", { schema: "relevance/1", trip: "park-fixture", lane: "r", researched: "2026-10-26", agent: "fixture", model: "none",
      sources: readJson(HERE, "valid/f4-no-fee-and-half-filled.json").sources,
      records: [{ ref: "place/open-meadow-reserve", why: "A meadow reserve with no gate.", access_cost: { v: null, state: "no_limit", basis: "official_info", src: ["src-0001"] } }] });
    const w2 = loadWorld(rr);
    expect(readProperty(w2, "access_cost", "place/open-meadow-reserve", w2.cap.get("place/open-meadow-reserve")!.rec, w2.rel.get("place/open-meadow-reserve")?.rec)).toBe("firm");
  });
});

describe("protected-area fixtures: the invalid files", () => {
  const r = root({ sub: "invalid", names: INVALID });
  it("the file list and expected.json agree", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(INVALID);
  });
  for (const n of INVALID) {
    it(`${n} raises exactly ${JSON.stringify(EXPECTED[n])}`, () => {
      const res = validate(r, "invalid", n);
      expect({ errors: mine(res.errors), warnings: mine(res.warnings) }).toEqual(EXPECTED[n]);
    });
  }
});
