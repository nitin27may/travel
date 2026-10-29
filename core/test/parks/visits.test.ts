// PA-X: park visits derived from a trip's stops and bases (protected-area-entry 6.1, QP4) and the park line (6.2, QP5), over the graph
// index. Fixtures: the synthetic graph parks (core/test/fixtures/graph/valid) and a Rockies-shaped file (core/test/fixtures/parks).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/capture/records.ts";
import { buildIndex } from "../../src/graph/build.ts";
import { parkVisits, protectedOf, type TripPlaces } from "../../src/parks/visits.ts";
import { daysText, listText, passSaving, shortNames, tripParks } from "../../src/parks/line.ts";
import { tripPark } from "../../src/schema/api/index.ts";
import { capDoc, put, scope, scratchRoot } from "../capture/helpers.ts";

const GRAPH = fileURLToPath(new URL("../fixtures/graph/valid/", import.meta.url));
const PARKS = fileURLToPath(new URL("../fixtures/parks/", import.meta.url));

function index(extra: unknown[] = []) {
  const root = scratchRoot({ "data/suitability/scope.json": scope([]) });
  for (const [dir, lane] of [[GRAPH, "graph-fixture"], [PARKS, "parks-fixture"]] as const) {
    for (const n of readdirSync(dir).filter((f) => f.endsWith(".json"))) put(root, `data/capture/${lane}/${n}`, JSON.parse(readFileSync(join(dir, n), "utf8")));
  }
  if (extra.length) put(root, "data/capture/graph-fixture/extra.json", capDoc(extra, { trip: "graph-fixture" }));
  return buildIndex(loadWorld(root));
}
const g = index();

const P = "place/lakeland-provincial-park";
const camp = (s: string) => `part/place/lakeland-provincial-park#${s}`;

describe("parkVisits (6.1): days, nights and modes from stops and bases", () => {
  it("a day trip: two members on day 1, no night inside: one visit, mode day", () => {
    const v = parkVisits(g, { stops: [{ day: 1, ref: "place/long-lake" }, { day: 1, ref: camp("day-use-beach") }], nights: [] });
    expect(v.map((x) => [x.ref, x.days, x.nights, x.modes])).toEqual([[P, [1], [], ["day"]]]);
  });
  it("a camping weekend: nights at a front-country campground make every day overnight_front, the morning after included", () => {
    const trip: TripPlaces = { stops: [{ day: 2, ref: "place/narrow-lake" }, { day: 3, ref: camp("day-use-beach") }], nights: [1, 2].map((night) => ({ night, ref: camp("pine-campground") })) };
    const [v] = parkVisits(g, trip);
    expect(v).toMatchObject({ ref: P, kind: "state_provincial", parent: null, days: [1, 2, 3], nights: [1, 2], modes: ["overnight_front"] });
    expect(v!.byDay).toEqual([{ day: 1, mode: "overnight_front" }, { day: 2, mode: "overnight_front" }, { day: 3, mode: "overnight_front" }]);
  });
  it("backcountry nights: a backcountry site base gives overnight_back; a later day with no night inside is a day visit", () => {
    const trip: TripPlaces = { stops: [{ day: 5, ref: "place/far-lake" }], nights: [{ night: 1, ref: camp("interior-site-9") }, { night: 2, ref: camp("interior-site-9") }] };
    const [v] = parkVisits(g, trip);
    expect(v!.byDay).toEqual([{ day: 1, mode: "overnight_back" }, { day: 2, mode: "overnight_back" }, { day: 5, mode: "day" }]);
    expect(v!.modes).toEqual(["day", "overnight_back"]);
  });
  it("a zone is a visit of its own with its park as parent; the park is visited too (containment, never geometry)", () => {
    const v = parkVisits(g, { stops: [{ day: 4, ref: "place/tarn-lake" }], nights: [] });
    expect(v.map((x) => x.ref)).toEqual(["part/place/ridgeback-national-park#glacier-basin", "place/ridgeback-national-park"]);
    expect(v[0]).toMatchObject({ kind: "zone", parent: "place/ridgeback-national-park" });
    expect(v[1]).toMatchObject({ kind: "national", parent: null });
  });
  it("membership by covers_areas (an area_id member) and by explicit part_of both count; a place outside every park counts for none", () => {
    expect(protectedOf(g, "place/east-bank-lake")).toEqual(["place/twin-rivers-national-park"]);
    expect(protectedOf(g, "place/border-overlook")).toEqual(["place/twin-rivers-national-park"]);
    expect(parkVisits(g, { stops: [{ day: 1, ref: "place/calgary-hotel" }], nights: [{ night: 1, ref: "place/canmore-hotel" }] })).toEqual([]);
  });
  it("a route stop is in the park its chain reaches (a trail starting at a park trailhead)", () => {
    const v = parkVisits(g, { stops: [{ day: 2, ref: "part/place/ridgeback-national-park#traverse-stage-2" }], nights: [] });
    expect(v.map((x) => x.ref)).toContain("place/ridgeback-national-park");
  });
});

// ---- the Rockies-shaped plan (6.3) -------------------------------------------------------------------------------------------------

const ROCKIES: TripPlaces = {
  stops: [
    { day: 1, ref: "place/calgary-hotel" },
    { day: 3, ref: "place/johnston-canyon" }, { day: 4, ref: "place/vermilion-lakes" }, { day: 5, ref: "place/johnston-canyon" }, { day: 6, ref: "place/vermilion-lakes" },
    { day: 7, ref: "place/maligne-lake" }, { day: 8, ref: "place/maligne-lake" },
    { day: 9, ref: "part/place/yoho-national-park#lake-ohara" }, { day: 9, ref: "place/emerald-lake" },
    { day: 10, ref: "place/lake-louise" }, { day: 11, ref: "place/moraine-lake" },
    { day: 12, ref: "place/marble-canyon" }, ...[12, 13, 14, 15].map((day) => ({ day, ref: "place/kananaskis-lakes" })),
  ],
  nights: [
    { night: 1, ref: "place/calgary-hotel" }, { night: 2, ref: "place/canmore-hotel" },
    ...[3, 4, 5, 6].map((night) => ({ night, ref: "place/banff-town-hotel" })),
    ...[7, 8].map((night) => ({ night, ref: "place/jasper-cabins" })),
    ...[9, 10].map((night) => ({ night, ref: "place/lake-louise-lodge" })),
    ...[11, 12, 13, 14].map((night) => ({ night, ref: "place/canmore-hotel" })),
  ],
};

describe("the Rockies-shaped plan: visits and park lines", () => {
  const visits = parkVisits(g, ROCKIES);
  const parks = tripParks(g, visits, { months: [9] });
  const byName = new Map(parks.map((p) => [p.name, p]));

  it("visits in the order first entered (the lodge night puts the Lake Louise area on day 9), then by ref; day numbers only", () => {
    expect(visits.map((v) => v.name)).toEqual(["Banff National Park", "Jasper National Park", "Lake Louise area", "Lake O'Hara", "Yoho National Park", "Kananaskis Country", "Kootenay National Park"]);
    expect(visits.find((v) => v.name === "Banff National Park")!.days).toEqual([3, 4, 5, 6, 9, 10, 11]);
  });
  it("the park line of the spec, word for word", () => {
    expect(byName.get("Banff National Park")!.line).toBe(
      "Banff National Park, days 3 to 6 and 9 to 11: entry fee each day, or the Discovery Pass covers it (also Jasper, Yoho and Kootenay on this trip)",
    );
    expect(byName.get("Jasper National Park")!.line).toBe("Jasper National Park, days 7 to 8: entry fee each day, or the Discovery Pass covers it (also Banff, Yoho and Kootenay on this trip)");
    expect(byName.get("Kananaskis Country")!.line).toBe("Kananaskis Country, days 12 to 15: vehicle permit each day");
    expect(byName.get("Lake O'Hara")!).toMatchObject({ kind: "zone", parent: { slug: "yoho-national-park", name: "Yoho National Park" }, line: "Lake O'Hara, day 9: shuttle seat" });
  });
  it("a zone with no requirement of its own is left out (its park's line says what applies)", () => {
    expect(byName.has("Lake Louise area")).toBe(false);
  });
  it("needs carry the row kind and the rule in words; the pass a fee is covered by is not a need of its own", () => {
    expect(byName.get("Banff National Park")!.needs).toEqual([{ name: "Banff daily admission", kind: "pass", text: "Buy any time before Day 3" }]);
    expect(byName.get("Kananaskis Country")!.needs).toEqual([{ name: "Conservation pass", kind: "pass", text: "Buy by 23:59 on Day 12" }]);
    expect(byName.get("Lake O'Hara")!.needs).toEqual([{ name: "Lake O'Hara day-use bus", kind: "booking", text: "Lottery: apply usually in March; leftover seats until 15:30 the day before Day 9" }]);
    expect(byName.get("Banff National Park")!.coveredBy).toBe("Discovery Pass");
  });
  it("the saving line once, on the first park the pass covers, with the day count across the parks it covers (QP5)", () => {
    // Banff 7 days, Jasper 2, Yoho 1 (day 9, shared with Banff), Kootenay 1: 10 distinct park days; 10 x 24.50 > 167.50 per family
    expect(byName.get("Banff National Park")!.saving).toBe("For 10 park days, the Discovery Pass is likely cheaper than the daily entry fee (family price)");
    expect(parks.filter((p) => p.saving).length).toBe(1);
  });
  it("every park parses as the API's TripPark", () => {
    for (const p of parks) expect(tripPark.safeParse(p).success, p.name).toBe(true);
  });
  it("no record ref and no dated folder name leaves the park lines (privacy: refs are opaque, folders encode real months)", () => {
    const text = JSON.stringify(parks);
    expect(text).not.toMatch(/"(?:place|part|offer|legacy)\//);
    expect(text).not.toMatch(/-(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)-\d{4}/i);
  });
});

describe("states of a park line (4.5)", () => {
  const extra = [
    { ref: "place/quiet-park", type: "nature.protected.nature_reserve", layer: "place", name: "Quiet Reserve", covers_areas: ["ZZ/Q1/quiet"] },
    { ref: "place/quiet-pond", type: "water.body.pond_reservoir", layer: "place", name: "Quiet Pond", area_id: "ZZ/Q1/quiet" },
    { ref: "place/free-park", type: "nature.protected.forest", layer: "place", name: "Free Forest", covers_areas: ["ZZ/Q1/free"], access_cost: { v: "no_limit", state: "value", basis: "official_info", src: ["src-0001"] } },
    { ref: "place/free-glade", type: "water.body.pond_reservoir", layer: "place", name: "Glade Pond", area_id: "ZZ/Q1/free" },
  ];
  const gx = index(extra);
  it("no requirement and no sourced answer: Entry not checked yet", () => {
    const [p] = tripParks(gx, parkVisits(gx, { stops: [{ day: 2, ref: "place/quiet-pond" }], nights: [] }));
    expect(p).toMatchObject({ state: "not_checked", line: "Entry not checked yet for Quiet Reserve", needs: [], coveredBy: null, saving: null });
  });
  it("a sourced no_limit: no entry fee or permit", () => {
    const [p] = tripParks(gx, parkVisits(gx, { stops: [{ day: 2, ref: "place/free-glade" }], nights: [] }));
    expect(p).toMatchObject({ state: "none_needed", line: "Free Forest, day 2: no entry fee or permit needed for this visit" });
  });
  it("requirements none of the visit's modes need: none needed for this visit (the O'Hara bus is day-only; a lodge guest's night is not)", () => {
    const v = parkVisits(gx, { stops: [], nights: [{ night: 9, ref: "place/lake-louise-lodge" }] });
    const parks = tripParks(gx, v);
    expect(parks.map((p) => p.name)).toEqual(["Banff National Park"]);
    const ohara = parkVisits(gx, { stops: [{ day: 9, ref: "part/place/yoho-national-park#lake-ohara" }], nights: [] }).map((x) => ({ ...x, modes: ["overnight_front" as const] }));
    expect(tripParks(gx, ohara).find((p) => p.name === "Lake O'Hara")).toBeUndefined();
  });
});

describe("words", () => {
  it("daysText: runs of days", () => {
    expect(daysText([3])).toBe("day 3");
    expect(daysText([3, 5])).toBe("days 3 and 5");
    expect(daysText([11, 3, 4, 5, 6, 9, 10])).toBe("days 3 to 6 and 9 to 11");
    expect(daysText([1, 3, 5, 6])).toBe("days 1, 3 and 5 to 6");
  });
  it("listText and shortNames", () => {
    expect(listText(["a"])).toBe("a");
    expect(listText(["a", "b", "c"])).toBe("a, b and c");
    expect(shortNames("Banff National Park", ["Jasper National Park", "Yoho National Park"])).toEqual(["Jasper", "Yoho"]);
    expect(shortNames("Banff National Park", ["Kananaskis Country"])).toEqual(["Kananaskis Country"]);
  });
});

describe("passSaving: only with comparable units and a known day count (QP5)", () => {
  const day = { v: { required: "always", needed_for: ["day"], unit: "person", valid: { span: 1, unit: "day", from: "purchase" }, channel: ["gate"] }, state: "value", src: [] };
  const price = (rows: unknown[]) => ({ v: rows, state: "value", src: [] });
  const fee = (rows: unknown[], entry: unknown = day) => ({ type: "access.pass.entry_fee", name: "Fee", entry, price: price(rows) });
  const pass = (rows: unknown[]) => ({ type: "access.pass.park_pass", name: "Annual Pass", price: price(rows) });
  it("says it when the pass is cheaper per the same family unit", () => {
    expect(passSaving(pass([{ amount: 100, currency: "CAD", per: "family" }]), [fee([{ amount: 20, currency: "CAD", per: "family" }])], 6)).toBe(
      "For 6 park days, the Annual Pass is likely cheaper than the daily entry fee (family price)",
    );
  });
  it("silent when not cheaper, when units differ, when currencies differ, per person only, multi-day fees, or no days", () => {
    expect(passSaving(pass([{ amount: 100, currency: "CAD", per: "family" }]), [fee([{ amount: 20, currency: "CAD", per: "family" }])], 5)).toBeNull();
    expect(passSaving(pass([{ amount: 50, currency: "CAD", per: "vehicle" }]), [fee([{ amount: 20, currency: "CAD", per: "family" }])], 9)).toBeNull();
    expect(passSaving(pass([{ amount: 50, currency: "USD", per: "family" }]), [fee([{ amount: 20, currency: "CAD", per: "family" }])], 9)).toBeNull();
    expect(passSaving(pass([{ amount: 50, currency: "CAD", per: "person" }]), [fee([{ amount: 20, currency: "CAD", per: "person" }])], 9)).toBeNull();
    const week = { ...day, v: { ...day.v, valid: { span: 7, unit: "day", from: "purchase" } } };
    expect(passSaving(pass([{ amount: 50, currency: "CAD", per: "vehicle" }]), [fee([{ amount: 35, currency: "CAD", per: "vehicle" }], week)], 9)).toBeNull();
    expect(passSaving(pass([{ amount: 50, currency: "CAD", per: "family" }]), [fee([{ amount: 20, currency: "CAD", per: "family" }])], 0)).toBeNull();
  });
  it("falls back to the vehicle unit, and stays silent when two fees disagree", () => {
    expect(passSaving(pass([{ amount: 60, currency: "CAD", per: "vehicle" }]), [fee([{ amount: 15, currency: "CAD", per: "vehicle" }])], 5)).toBe(
      "For 5 park days, the Annual Pass is likely cheaper than the daily entry fee (vehicle price)",
    );
    expect(passSaving(pass([{ amount: 60, currency: "CAD", per: "vehicle" }]), [fee([{ amount: 15, currency: "CAD", per: "vehicle" }]), fee([{ amount: 12, currency: "CAD", per: "vehicle" }])], 5)).toBeNull();
  });
});
