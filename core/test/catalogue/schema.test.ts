// The API contracts themselves (core/src/schema/api): the allowlists, round trips, provenance, points, and that every schema becomes
// JSON Schema (API-1b builds OpenAPI 3.1 from them).
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import * as S from "../../src/schema/api/index.ts";
import { CATALOGUE_CONTRACT, CATALOGUE_METHODS } from "../../src/catalogue/store.ts";
import { PLACE_SORT_VALUES, TRIP_SORT_VALUES } from "../../src/catalogue/sorting.ts";
import { StubStore } from "../../src/catalogue/stub/index.ts";
import { api, REGISTRY } from "../../src/schema/index.ts";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");

/** The 39 keys of the list row the site ships (web/tests/data/light-data.test.ts pins the same list). */
const SHIPPED_ROW_KEYS = ["id", "slug", "name", "kind", "kindLabel", "legacyKind", "country", "country_name", "region", "region_name", "regionAliases", "area", "area_name", "lat", "lon", "km", "gain_m", "elevation_m", "season", "kid_fit", "tags", "image", "trips", "honesty", "completeness", "statsState", "researched", "type", "effort", "kids_from", "kids_basis", "time_band", "price_band", "booking", "flags", "walk_band", "shape", "best_time", "badge"];
/** web/components/trips/types.ts TRIP_LIST_KEYS. */
const SHIPPED_TRIP_KEYS = ["id", "slug", "title", "depth", "nights", "days", "seasonNotSet", "isDone", "region", "cover", "seasonLabel", "seasonMonths", "country", "countryName", "lat", "lon", "approx", "ageFit", "kidsBasis", "effort", "firstBase", "countries", "continents", "length", "lengthClass", "hike", "hikeBasis", "strollerDays", "activities", "highlights", "around", "perDay", "perDayApprox", "shape", "fromHubMin", "fromHubApprox"];

describe("allowlists (schema diff 13.1 items 1 and 2)", () => {
  it("the shipped row is today's 41 keys; the API row adds ref, approx (R-17) and nearTown (store.ts A35) and nothing else", () => {
    expect(S.PLACE_LIST_ROW_KEYS).toEqual(SHIPPED_ROW_KEYS);
    expect([...S.PLACE_ROW_KEYS].sort()).toEqual([...SHIPPED_ROW_KEYS, "ref", "approx", "nearTown"].sort());
  });
  it("sort keys are an allowlist with a value rule each (R-4)", () => {
    expect([...S.PLACE_SORT_KEYS].sort()).toEqual(Object.keys(PLACE_SORT_VALUES).sort());
    expect([...S.TRIP_SORT_KEYS].sort()).toEqual(Object.keys(TRIP_SORT_VALUES).sort());
    expect(S.placeQuery.safeParse({ sort: ["-km", "name"] }).success).toBe(true);
    expect(S.placeQuery.safeParse({ sort: ["password"] }).success).toBe(false);
    expect(S.tripQuery.safeParse({ sort: ["-nights"] }).success).toBe(true);
    expect(S.tripQuery.safeParse({ sort: ["km"] }).success).toBe(false);
  });
  it("a detail's notes are always empty (R-16)", () => {
    expect(S.placeDetail.shape.notes.safeParse("").success).toBe(true);
    expect(S.placeDetail.shape.notes.safeParse("Hotel idea").success).toBe(false);
  });
  it("the trip row is web's 36 keys plus ref", () => {
    expect([...S.TRIP_ROW_KEYS].sort()).toEqual([...SHIPPED_TRIP_KEYS, "ref"].sort());
  });
  it("rows are strict: an extra key fails, a missing key fails", async () => {
    const row = (await new StubStore().listPlaces({})).ok ? ((await new StubStore().listPlaces({})) as { data: S.Paged<S.PlaceRow> }).data.items[0]! : null;
    expect(row).not.toBeNull();
    expect(S.placeRow.safeParse(row).success).toBe(true);
    expect(S.placeRow.safeParse({ ...row, notes: "x" }).success).toBe(false);
    // the API row is the shipped row plus ref, approx and nearTown (store.ts A35)
    const { ref: _r, approx: _a, nearTown: _n, ...shipped } = row!;
    expect(S.placeRow.safeParse(shipped).success).toBe(false);
    expect(S.placeListRow.safeParse(shipped).success).toBe(true);
  });
});

describe("round trips: every StubStore answer parses with its method's output schema, unchanged", () => {
  const store = new StubStore();
  const calls: [keyof typeof CATALOGUE_CONTRACT, () => Promise<unknown>][] = [
    ["listPlaces", () => store.listPlaces({ facets: { country: ["CA"] } })],
    ["countPlaces", () => store.countPlaces({})],
    ["getPlace", () => store.getPlace("larch-basin-trail")],
    ["getPlace", () => store.getPlace("larch-basin")],
    ["nearbyForPlace", () => store.nearbyForPlace("glacier-lake")],
    ["near", () => store.near({ near: "place:glacier-lake", r: 500 })],
    ["towns", () => store.towns({ city: "ca-ab-canmore" })],
    ["parse", () => store.parse({ q: "alberta lakes" })],
    ["search", () => store.search({ q: "lake" })],
    ["listUnchecked", () => store.listUnchecked({ facets: { season: ["7"] } })],
    ["searchCards", () => store.searchCards({ q: "glacier lake" })],
    ["listTrips", () => store.listTrips({})],
    ["tripLegs", () => store.tripLegs("stub-rockies-loop")],
    ["getTrip", () => store.getTrip("stub-alps-week")],
    ["getTrip", () => store.getTrip("stub-alps-holiday")],
    ["getExport", () => store.getExport({ type: "trip", slug: "stub-rockies-loop", format: "kml" })],
    ["globeTree", () => store.globeTree()],
    ["globePins", () => store.globePins("it")],
    ["globeCard", () => store.globeCard("trip:stub-alps-week")],
    ["globeFeature", () => store.globeFeature("ne-range-1")],
    ["globeLine", () => store.globeLine("ne-range-1")],
    ["globeCity", () => store.globeCity("ca-ab-canmore")],
    ["report", () => store.report({ page: "/trips/stub-alps-week/" })],
  ];
  for (const [method, call] of calls) {
    it(method, async () => {
      const r = (await call()) as S.Result<unknown>;
      expect(r.ok, method).toBe(true);
      if (!r.ok) return;
      const out = CATALOGUE_CONTRACT[method].output;
      expect(S.result(out).safeParse(r).success).toBe(true);
      const parsed = out.parse(r.data);
      expect(parsed).toEqual(r.data);
      expect(out.parse(JSON.parse(JSON.stringify(r.data)))).toEqual(r.data);
    });
  }
  it("covers every method", () => {
    expect(new Set([...calls.map(([m]) => m), "revision"])).toEqual(new Set(CATALOGUE_METHODS));
  });
});

describe("JSON Schema (the OpenAPI input of API-1b)", () => {
  for (const [method, c] of Object.entries(CATALOGUE_CONTRACT)) {
    it(`${method} input and output convert`, () => {
      if (c.input) expect(() => z.toJSONSchema(c.input, { io: "input" })).not.toThrow();
      if ("query" in c && c.query) expect(() => z.toJSONSchema(c.query, { io: "input" })).not.toThrow();
      expect(() => z.toJSONSchema(c.output, { io: "output" })).not.toThrow();
    });
  }
  it("the API schemas are not registered as data tables (schema.ts generate is unchanged by them)", () => {
    expect(api.placeRow).toBe(S.placeRow);
    expect(REGISTRY.some((t) => /api/i.test(t.key))).toBe(false);
  });
});

describe("apiVal and provenance (D-B4)", () => {
  const registryIds = new Set((JSON.parse(readFileSync(join(ROOT, "data/sources/registry.json"), "utf8")).entries as { id: string }[]).map((e) => e.id));
  const known = [...registryIds][0]!;
  const v = S.apiVal(z.number());

  it("accepts a value citing registry ids, every state, and the editorial basis", () => {
    for (const state of ["value", "none_stated", "searched_none", "not_applicable", "gap", "no_limit"] as const) {
      expect(v.safeParse({ v: null, state, basis: null, src: [] }).success, state).toBe(true);
    }
    expect(v.safeParse({ v: 3, state: "value", basis: "editorial", src: [known], read: "2026-10-01", conflicts: [{ v: 4, basis: "community", src: [known] }] }).success).toBe(true);
  });
  it("rejects a file-local id, an unknown state or basis, and the page's display shape", () => {
    expect(v.safeParse({ v: 3, state: "value", basis: "official_info", src: ["src-0001"] }).success).toBe(false);
    expect(v.safeParse({ v: 3, state: "maybe", basis: null, src: [] }).success).toBe(false);
    expect(v.safeParse({ v: 3, state: "value", basis: "tripadvisor", src: [] }).success).toBe(false);
    expect(v.safeParse({ value: 3, state: "value", basis: null, basisLabel: "", sources: [] }).success).toBe(false);
  });
  it("an id with no registry entry fails the provenance check; a registry id passes", () => {
    const out = { section: { val: { v: 1, state: "value", basis: "official_info", src: ["s-0000000000"] } } };
    expect(S.provenanceProblems(out, registryIds)).toEqual(["$.section.val: source s-0000000000 is not in the source registry"]);
    expect(S.provenanceProblems({ val: { v: 1, state: "value", basis: "official_info", src: [known] } }, registryIds)).toEqual([]);
    expect(S.provenanceProblems({ citations: { "s-0000000000": {} } }, registryIds)[0]).toMatch(/citations: source s-0000000000/);
  });
  it("a page PVal that leaked into output unmapped is reported; a page row is not mistaken for a value", () => {
    const leaked = { val: { value: 1, state: "value", basis: "official_info", basisLabel: "official information", sources: [] } };
    expect(S.provenanceProblems(leaked, registryIds)[0]).toMatch(/not an apiVal/);
    expect(S.collectVals({ key: "k", state: "gap", value: null, val: null })).toEqual([]);
  });
});

describe("points, ids and inputs", () => {
  it("every detail point carries pointRole and approx (13.1 item 3)", () => {
    const p = { lat: 1, lon: 2, pointRole: "trailhead", approx: false, pointSource: "osm_node:1", pointChecked: null, sourceLicence: "ODbL" };
    expect(S.apiPoint.safeParse(p).success).toBe(true);
    expect(S.apiPoint.safeParse({ ...p, pointRole: null }).success).toBe(true);
    const { approx: _a, ...noApprox } = p;
    expect(S.apiPoint.safeParse(noApprox).success).toBe(false);
    expect(S.apiPoint.safeParse({ ...p, pointRole: "somewhere" }).success).toBe(false);
  });
  it("city takes META-0's town id; a facet key outside the list is refused; scoped facets pass", () => {
    expect(S.apiTownId.safeParse("ca-on-oshawa").success).toBe(true);
    expect(S.apiTownId.safeParse("town/ca/on/oshawa").success).toBe(false);
    expect(S.placeQuery.safeParse({ facets: { "f.swim": ["yes"], city: ["ca-ab-canmore"], region: ["CA-AB"] } }).success).toBe(true);
    expect(S.placeQuery.safeParse({ facets: { status: ["visited"] } }).success).toBe(false);
  });
  it("an export names one slug; a list is not a slug", () => {
    expect(S.exportQuery.safeParse({ type: "place", slug: "a", format: "gpx" }).success).toBe(true);
    expect(S.exportQuery.safeParse({ type: "place", slug: "a,b", format: "gpx" }).success).toBe(false);
  });
  it("the result envelope: ok with a revision, or an error with a known code", () => {
    const rs = S.result(z.number());
    expect(rs.safeParse({ ok: true, data: 1, revision: "a".repeat(64) }).success).toBe(true);
    expect(rs.safeParse({ ok: true, data: 1, revision: "mtime-123" }).success).toBe(false);
    expect(rs.safeParse({ ok: false, error: { code: "teapot", message: "x" } }).success).toBe(false);
  });
});
