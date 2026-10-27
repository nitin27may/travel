// The registry exposure contract (PM-C; property-display-matrix 3.3, 3.4, 8.1, 10 K1 K2 K5 K10 K11; owner QM1, QM7).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveNode } from "../../src/capture/resolve.ts";
import { PRIVATE_KEYS, privacyHits } from "../../src/privacy/detect.ts";
import { placeDetail, placeRow } from "../../src/schema/api/place.ts";
import { tripDetail, tripRow } from "../../src/schema/api/trip.ts";
import {
  EXPORT_FORMATS, PROPERTIES, PROPERTY_BY_KEY, REGISTRY_PRIVACY, SOURCE_LANES, TRIP_SURFACES, exposeOf, exposureProblems, type PropertyDef,
} from "../../src/schema/capture/properties.ts";
import { ENVELOPE_EXPOSURE, READ_MODELS, envelopeProblems } from "../../src/schema/exposure.ts";
import { REPO } from "./helpers.ts";

const get = (k: string): PropertyDef => PROPERTY_BY_KEY.get(k)!;
const ex = (k: string) => get(k).expose;
const NONE = { page: "no", trip: [], list: [], export: [], api: "none", mcp: "none" };

describe("every registry property resolves to a privacy class and an exposure", () => {
  it("each row has a registry privacy class and all six surfaces, from their vocabularies", () => {
    expect(PROPERTIES.length).toBeGreaterThanOrEqual(239);
    for (const p of PROPERTIES) {
      expect(REGISTRY_PRIVACY, p.key).toContain(p.privacy);
      expect(Object.keys(p.expose).sort(), p.key).toEqual(["api", "export", "list", "mcp", "page", "trip"]);
      expect(["rest!", "rest", "card", "detail", "no"], p.key).toContain(p.expose.page);
      for (const t of p.expose.trip) expect(TRIP_SURFACES, p.key).toContain(t);
      for (const f of p.expose.export) expect(EXPORT_FORMATS, p.key).toContain(f);
      for (const l of p.expose.list) expect(l, p.key).toMatch(/^(row:[A-Za-z_]+|facet|search|rank|sort)$/);
      for (const l of p.lanes ?? []) expect(SOURCE_LANES, p.key).toContain(l);
    }
  });
  it("the registry holds K1, K2, K5, K10 and K11 today", () => {
    expect(exposureProblems(PROPERTIES)).toEqual([]);
  });
  it("no registry property is household data (K1; 8.2 lists where household data lives instead)", () => {
    expect(PROPERTIES.filter((p) => (p.privacy as string) === "household")).toEqual([]);
    // the household data of 8.2 and the detector's private keys are never registry keys, so no surface can carry them as a fact
    const household = ["travellers", "ages", "height_cm", "weight_kg", "start", "from", "fromRef", "gw", "home", "home_point", "favourites", "copies", "booking_state", "confirmation", "status", "notes", "notes_private", "visits", "meta"];
    for (const k of [...household, ...PRIVATE_KEYS]) expect(PROPERTY_BY_KEY.has(k), k).toBe(false);
  });
  it("matches the committed snapshot of exposeOf for every row (review the diff: defaults hide intent, Gotchas)", async () => {
    const snap = Object.fromEntries(PROPERTIES.map((p) => [p.key, { privacy: p.privacy, ...p.expose, ...(p.lanes ? { lanes: p.lanes } : {}) }]));
    await expect(JSON.stringify(snap, null, 1) + "\n").toMatchFileSnapshot("./registry-exposure.snap.json");
  });
});

describe("exposeOf defaults (3.4)", () => {
  it("page is the strongest display level", () => {
    expect(ex("access_cost").page).toBe("rest!");
    expect(ex("access_season").page).toBe("rest!");
    expect(ex("season").page).toBe("rest");
    expect(ex("wikidata").page).toBe("detail");
  });
  it("trip: suitability chips and card facts on the day row, booking facts on Bookings, season and parks on the Summary", () => {
    expect(ex("min_age").trip).toEqual(["day"]);
    expect(ex("age_band").trip).toEqual(["day"]);
    expect(ex("effort.drivers.gain_m").trip).toEqual(["day"]);
    expect(ex("toilets").trip).toEqual([]);
    expect(ex("participation.guide").trip).toEqual([]);
    expect(ex("window").trip).toEqual(["book"]);
    expect(ex("entry").trip).toEqual(["book"]);
    expect(ex("covered_by").trip).toEqual(["book"]);
    expect(ex("access_cost").trip).toEqual(["book", "sum"]);
    expect(ex("part_of").trip).toEqual(["sum"]);
    expect(ex("access_season").trip).toEqual(["sum"]);
  });
  it("list: the filter band when it is a row key, the facet, search text and ranking inputs", () => {
    expect(ex("price").list).toEqual(["row:price_band", "facet"]);
    expect(ex("window").list).toEqual(["row:booking", "facet"]);
    expect(ex("walk_m").list).toEqual(["row:walk_band", "facet"]);
    expect(ex("summary").list).toEqual(["search"]);
    expect(ex("class_key").list).toEqual(["rank"]);
    expect(ex("draw").list).toEqual(["row:badge", "sort"]);
    // the three registry bands that are not row keys (9.3) feed their real row key; PM-G's K5 still flags the band names
    expect(get("season").filter?.band).toBe("season_band");
    expect(ex("season").list).toEqual(["row:season", "facet"]);
    expect(ex("effort.drivers.distance_km").list).toEqual(["row:km", "facet"]);
    expect(ex("effort.drivers.gain_m").list).toEqual(["row:gain_m", "facet"]);
  });
  it("export: print from the page level, csv for card, money and window, gpx for the map keys, ics never", () => {
    expect(ex("name").export).toEqual(["print", "csv", "gpx"]);
    expect(ex("price").export).toEqual(["print", "csv"]);
    expect(ex("deposit").export).toEqual(["csv"]);
    expect(ex("geometry").export).toEqual(["gpx"]);
    expect(ex("wikidata").export).toEqual([]);
    expect(PROPERTIES.filter((p) => p.expose.export.includes("ics"))).toEqual([]);
  });
  it("api and mcp: row, detail or none by home and list row; mcp follows the api except the ranking inputs and the track", () => {
    expect([ex("season").api, ex("season").mcp]).toEqual(["row", "public"]);
    expect([ex("hours").api, ex("hours").mcp]).toEqual(["detail", "public"]);
    for (const k of ["class_key", "standing", "distinction", "easy_payoff", "weather", "geometry"]) expect([k, ex(k).api, ex(k).mcp]).toEqual([k, "detail", "none"]);
    // K10: a property with no home can only ever say "not checked": never on the API or MCP, though the page may show its gap
    for (const p of PROPERTIES.filter((x) => x.home.in === "none")) expect([p.key, p.expose.api, p.expose.mcp]).toEqual([p.key, "none", "none"]);
    // every suitability property is on the API (detail, or row when it feeds a list row) and public on MCP (6)
    for (const p of PROPERTIES.filter((x) => x.home.in === "suitability")) expect([p.key, p.expose.api === "none", p.expose.mcp]).toEqual([p.key, false, "public"]);
    expect(ex("age_band").api).toBe("row");
  });
});

describe("the exceptions the spec writes on rows", () => {
  it("near_town is off the page (HIDDEN_FROM_PAGE) but a row key and a town id on MCP; near_town_km rides inside it", () => {
    expect(get("near_town").privacy).toBe("derived");
    expect(ex("near_town")).toEqual({ page: "no", trip: [], list: ["row:nearTown"], export: [], api: "row", mcp: "public" });
    expect(ex("near_town_km")).toEqual(NONE);
  });
  it("covers_areas drives membership and is shown nowhere; photos are files, never an export column", () => {
    expect(ex("covers_areas")).toEqual(NONE);
    expect(ex("photos").export).toEqual([]);
    expect(ex("photos").list).toEqual(["row:image"]);
  });
  it("lanes: the point from open data then official (never Google), the track from open data, derived facts computed", () => {
    expect(get("point").lanes).toEqual(["D", "F"]);
    expect(get("geometry").lanes).toEqual(["D"]);
    for (const k of ["near_town", "near_town_km", "access_points", "variants"]) expect(get(k).lanes, k).toEqual(["X"]);
    expect(get("ext.water.boating").lanes).toEqual(["F", "O"]);
  });
  it("the two new rows of 9.2: lake boats and event recurrence, each with a home", () => {
    expect(get("ext.water.boating")).toMatchObject({ value: "enum", display: ["rest"], home: { in: "suitability" } });
    expect(get("recurrence")).toMatchObject({ value: "object", layers: ["event"], home: { in: "capture", path: "recurrence" } });
    expect(ex("recurrence")).toMatchObject({ page: "rest", trip: ["sum"], api: "detail", mcp: "public" });
  });
  it("matrix rows for the EG-C relations: covered_by, includes, covers_areas, entry (review EG-R0)", () => {
    expect(ex("covered_by")).toEqual({ page: "rest!", trip: ["book"], list: [], export: ["print"], api: "detail", mcp: "public" });
    expect(ex("includes")).toEqual({ page: "rest", trip: ["book"], list: [], export: ["print"], api: "detail", mcp: "public" });
    expect(ex("entry")).toEqual({ page: "rest!", trip: ["book"], list: [], export: ["print", "csv"], api: "detail", mcp: "public" });
  });
});

describe("S6: variants is derived, never asked; QM7: offers and events are never asked for access_cost", () => {
  const types = JSON.parse(readFileSync(join(REPO, "data/vocab/types.json"), "utf8")) as { nodes: { id: string; level: string }[] };
  const resolved = types.nodes.map((n) => resolveNode(n.id)!).filter(Boolean);
  it("variants and access_points have the derived home and the derived class", () => {
    expect(get("variants")).toMatchObject({ value: "relation_list", privacy: "derived", home: { in: "derived", path: "variant_of" } });
    expect(get("access_points")).toMatchObject({ privacy: "derived", home: { in: "derived" } });
  });
  it("no type asks a researcher for variants", () => {
    for (const n of resolved) for (const rl of Object.values(n.layers)) expect([n.id, rl!.layer, rl!.base.variants ?? "N"]).toEqual([n.id, rl!.layer, "N"]);
  });
  it("access_cost is N on every offer class and on events, and still asked on places and routes", () => {
    let offers = 0;
    for (const n of resolved) for (const l of ["offer", "event"] as const) {
      const rl = n.layers[l];
      if (!rl) continue;
      offers++;
      expect([n.id, l, rl.base.access_cost ?? "N"]).toEqual([n.id, l, "N"]);
    }
    expect(offers).toBeGreaterThan(20);
    expect(resolveNode("nature.trail.hike")!.layers.route!.base.access_cost).toBe("R");
  });
});

describe("privacy: what is not public is never exposed (planted rows, the style of core/test/privacy)", () => {
  const { expose: _e, ...season } = get("season");
  void _e;
  it("an internal row resolves to none on every surface, even when it writes its own exceptions (K2)", () => {
    expect(exposeOf({ ...season, key: "x_internal", privacy: "internal" })).toEqual(NONE);
    expect(exposeOf({ ...season, key: "x_internal", privacy: "internal" }, { page: "rest", api: "row", mcp: "public", export: ["csv"] })).toEqual(NONE);
  });
  it("the problem list names each planted break: household (K1), internal exposed (K2), no home on the api (K10), mcp without api (K11), a fake row key (K5)", () => {
    const base = get("season");
    const planted: PropertyDef[] = [
      { ...base, key: "x_household", privacy: "household" as never },
      { ...base, key: "x_internal", privacy: "internal" as never },
      { ...base, key: "x_homeless", home: { in: "none" } },
      { ...base, key: "x_mcp", expose: { ...base.expose, api: "none", mcp: "public" } },
      { ...base, key: "x_band", expose: { ...base.expose, list: ["row:season_band"] } },
      base,
    ];
    expect(exposureProblems(planted)).toEqual([
      "x_household: K1 privacy household is not a registry class",
      "x_household: K2 household is exposed",
      "x_internal: K2 internal is exposed",
      "x_homeless: K10 no home but exposed to the api or mcp",
      "x_mcp: K11 mcp without the api",
      "x_band: K5 a list row key that is not a PlaceRow key",
    ]);
  });
  it("a body of every MCP-public registry key passes the privacy detector", () => {
    const body = Object.fromEntries(PROPERTIES.filter((p) => p.expose.mcp === "public").map((p) => [p.key, "x"]));
    expect(Object.keys(body).length).toBeGreaterThan(150);
    expect(privacyHits(body)).toEqual([]);
  });
});

describe("the envelope exposure map (8.1, core/src/schema/exposure.ts)", () => {
  const shapes = { placeRow, placeDetail, tripRow, tripDetail } as const;
  it("has exactly one row per top-level key of each public read model", () => {
    expect(READ_MODELS).toEqual(Object.keys(shapes));
    for (const m of READ_MODELS) expect(Object.keys(ENVELOPE_EXPOSURE[m]).sort(), m).toEqual(Object.keys(shapes[m].shape).sort());
  });
  it("holds no household row and sends no internal key to MCP; the detector's private keys are never MCP-public", () => {
    expect(envelopeProblems(ENVELOPE_EXPOSURE)).toEqual([]);
    for (const m of READ_MODELS) for (const [k, e] of Object.entries(ENVELOPE_EXPOSURE[m])) if (PRIVATE_KEYS.includes(k)) expect([m, k, e.mcp]).toEqual([m, k, "none"]);
    expect(ENVELOPE_EXPOSURE.tripDetail.legacyUrl!.mcp).toBe("none");
    expect(ENVELOPE_EXPOSURE.placeDetail.sources!.privacy).toBe("internal");
  });
  it("fails a planted household key and an internal key sent to MCP", () => {
    expect(envelopeProblems({ tripRow: { isDone: { privacy: "household", mcp: "none" }, legacyUrl: { privacy: "internal", mcp: "public" } } })).toEqual([
      "tripRow.isDone: household data in a public read model",
      "tripRow.legacyUrl: internal exposed to mcp",
    ]);
  });
});
