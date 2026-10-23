// API-3b units: the pure pieces the stores share (print text, legs mapping, card order, the unchecked page) and the stub's own rules.
import { describe, expect, it } from "vitest";
import { cardHitsOf, roundScore } from "../../src/catalogue/cards.ts";
import { tripLegsOf, noLegs } from "../../src/catalogue/json/legs.ts";
import { StubStore, stubData } from "../../src/catalogue/stub/index.ts";
import { uncheckedPageOf } from "../../src/catalogue/unchecked.ts";
import { printText } from "../../src/catalogue/printText.ts";
import { PRINT_GAP, decodePolyline5, encodePolyline5, type ExportModel, type PlaceRow, type TripDetail, type TripLegsFile } from "../../src/schema/api/index.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import { northOfHome } from "../privacy/probe.ts";

const row = (name: string, ref = `place/${name.toLowerCase()}`, over: Partial<PlaceRow> = {}): PlaceRow => ({ ...stubData().places[0]!.row, name, ref, slug: ref.slice(6), id: ref.slice(6), ...over });

describe("printText", () => {
  const point = { lat: 51.3, lon: -116.1, pointSource: "osm_node:1", pointChecked: null, sourceLicence: "ODbL" };
  const trip: ExportModel = {
    type: "trip", slug: "t", title: "A trip", url: "https://x.invalid/trips/t/", depth: "full", nights: 1, tz: null, seasonLabel: null, skipped: 0, waypoints: [], lines: [],
    days: [{ n: 1, title: "Arrive", base: "Banff" }, { n: 2, title: "Nothing planned", base: null }],
    stops: [
      { day: 1, order: 0, id: "a", name: "Scenic Drive", kind: "sight", category: null, area: null, time: "09:00", durationMin: null, lane: null, note: null, placeSlug: null, links: [], point },
      { day: 1, order: 1, id: "b", name: "Hut", kind: "sight", category: null, area: "Bow Valley", time: null, durationMin: null, lane: "Lane A", note: null, placeSlug: null, links: [], point: null },
    ],
  };
  it("lays out a trip: title, URL, day lines, a stop per line, every missing value as the gap words", () => {
    const text = printText(trip);
    expect(text.split("\n").slice(0, 2)).toEqual(["A trip", "https://x.invalid/trips/t/"]);
    expect(text).toContain("Day 1: Arrive (base Banff)");
    expect(text).toContain("09:00 | Scenic Drive | Not checked yet | (51.30000, -116.10000)");
    expect(text).toContain(`${PRINT_GAP} | Hut | Bow Valley | ${PRINT_GAP} | Lane A`);
    expect(text).toContain(`Day 2: Nothing planned\n  ${PRINT_GAP}`);
    expect(text).not.toMatch(/\b(?:null|undefined|NaN)\b/);
  });
  it("keeps every number away from a word, so the street-address rule of the detector reads nothing into a stop", () => {
    expect(privacyHits(printText(trip))).toEqual([]);
  });
  it("lays out a place as kind, area and location, and says when the pin is approximate", () => {
    const place: ExportModel = { type: "place", slug: "p", title: "Lake", url: "https://x.invalid/places/p/", kind: "lake", skipped: 0, lines: [], waypoints: [{ id: "place:0:p", name: "Lake", kind: "lake", role: "place", day: null, note: null, url: null, point: { ...point, pointSource: "prototype_approx" } }] };
    expect(printText(place, { area: "Bow Valley, Canada" })).toContain("Area: Bow Valley, Canada");
    expect(printText(place)).toContain(`Area: ${PRINT_GAP}`);
    expect(printText(place)).toContain("Location: (51.30000, -116.10000, approximate)");
    expect(printText({ ...place, waypoints: [] })).toContain(`Location: ${PRINT_GAP}`);
  });
});

describe("cardHitsOf", () => {
  it("orders by rounded score, then sortKey(name), then ref, caps at the limit and says what it cut", () => {
    const a = row("Beta"), b = row("alpha"), c = row("Gamma");
    const out = cardHitsOf([{ row: a, score: 1.0000001 }, { row: b, score: 1 }, { row: c, score: 2 }], ["x"], 2);
    expect(out.items.map((r) => r.name)).toEqual(["Gamma", "alpha"]);
    expect(out).toMatchObject({ total: 3, truncated: true, terms: ["x"] });
    expect(roundScore(0.1 + 0.2)).toBe(roundScore(0.3));
  });
  it("answers nothing for no hits", () => {
    expect(cardHitsOf([], [], 50)).toEqual({ items: [], total: 0, truncated: false, terms: [] });
  });
});

describe("uncheckedPageOf", () => {
  it("lists groups in order, each sorted, a row once, with the counts of every group on every page", () => {
    const rows = [row("B"), row("A"), row("C")];
    const page = uncheckedPageOf([{ key: "effort", label: "Effort", note: "not checked yet", rows: [rows[0]!, rows[1]!] }, { key: "kid", label: "Kids", note: "not checked yet", rows: [rows[2]!] }, { key: "empty", label: "x", note: "x", rows: [] }], [], 2, 2);
    expect(page.total).toBe(3);
    expect(page.items.map((r) => [r.name, r.gap])).toEqual([["C", "kid"]]);
    expect(page.groups).toEqual([{ key: "effort", label: "Effort", note: "not checked yet", count: 2 }, { key: "kid", label: "Kids", note: "not checked yet", count: 1 }]);
    expect(page.nextPage).toBeNull();
    expect(uncheckedPageOf([{ key: "effort", label: "E", note: "n", rows }], [], 1, 2).nextPage).toBe(2);
  });
});

describe("tripLegsOf", () => {
  const day = (n: number, baseId: string | null, ids: string[]) => ({ n, baseId, items: ids.map((id) => ({ id, variant: null })), tracks: null });
  const detail = { ref: "trip/t", slug: "t", bases: [], days: [day(1, "b1", ["i1", "i2"]), day(2, "b2", ["i3"])] } as unknown as TripDetail;
  const line: [number, number][] = [[-116.1, 51.3], [-116.0, 51.4]];
  const file: TripLegsFile = {
    schema: "trip-legs/2", trip: "t", fetched: "2026-10-01", attribution: "ORS; OSM",
    legs: [
      { from: "p2", to: "p1", profile: "driving-car", mode: "drive", km: 5, minutes: 9, geometry: encodePolyline5(line) },
      { from: "p2", to: "p3", profile: "foot-hiking", mode: "walk", km: 1, minutes: 20 },
    ],
  };
  const src = { file, pairKeyOf: (k: string) => ({ i1: "p1", i2: "p2", i3: "p3", "base:b1": "p0" })[k] ?? null };
  it("names each leg by the detail's stop keys, in the direction the stops run, and reverses a geometry stored the other way", () => {
    const out = tripLegsOf(detail, src);
    expect(out).toMatchObject({ ref: "trip/t", slug: "t", attribution: "ORS; OSM", fetched: "2026-10-01" });
    const first = out.legs.find((l) => l.from === "i1" && l.to === "i2")!;
    expect(first).toMatchObject({ day: 1, mode: "drive", km: 5, minutes: 9 });
    expect(decodePolyline5(first.geometry!)!.map(([x, y]) => [Math.round(x * 1e3) / 1e3, Math.round(y * 1e3) / 1e3])).toEqual([[-116, 51.4], [-116.1, 51.3]]);
    // i2 -> base:b2 -> i3 is not a leg of the file; the stop pair i2 -> i3 does not exist in one day either
    expect(out.legs.some((l) => l.to === "base:b2" || l.from === "base:b2")).toBe(false);
  });
  it("serves a leg that touches the household radius with no geometry, its km and minutes kept (A33 rule 3)", () => {
    const near = northOfHome(0.5);
    const bad: TripLegsFile = { ...file, legs: [{ ...file.legs[0]!, geometry: encodePolyline5([[-116.1, 51.3], [near.lon, near.lat]]) }] };
    const leg = tripLegsOf(detail, { ...src, file: bad }).legs[0]!;
    expect(leg.geometry).toBeNull();
    expect(leg.minutes).toBe(9);
  });
  it("answers no legs, and no fetch date, for a trip with no file", () => {
    expect(noLegs(detail)).toEqual({ ref: "trip/t", slug: "t", legs: [], attribution: "", fetched: null });
  });
});

describe("StubStore API-3 rules", () => {
  it("reads an empty season as a gap: the rows are unchecked and counted under the season key", async () => {
    const store = new StubStore();
    const c = await store.countPlaces({ facets: { season: ["7"] } });
    if (!c.ok) throw new Error(c.error.message);
    expect(c.data.unchecked).toBeGreaterThan(0);
    expect(c.data.notes).toEqual([`${c.data.unchecked} not checked yet`]);
    expect(c.data.gaps.season).toBeGreaterThanOrEqual(c.data.unchecked);
  });
  it("moves a town whose centre is inside the household radius, and drops the outline that touches it, in the constructor", async () => {
    const d = stubData();
    const near = northOfHome(0.5);
    d.towns.push({ id: "ca-zz-planted", name: "Planted", lat: near.lat, lon: near.lon, pop: 5000, cc: "ca", region: null, places: null, distanceKm: null, bearing: null });
    d.cities.push({ id: "ca-zz-planted", name: "Planted", geometry: { type: "Polygon", coordinates: [[[near.lon, near.lat], [near.lon + 0.01, near.lat], [near.lon, near.lat + 0.01], [near.lon, near.lat]]] }, credit: "OpenStreetMap contributors (ODbL)" });
    const store = new StubStore({ data: d });
    const city = await store.globeCity("ca-zz-planted");
    expect(city.ok && city.data.geometry).toBeNull();
    const towns = await store.towns({ near: "place:glacier-lake", r: 100 });
    if (towns.ok) for (const t of towns.data.items) expect(privacyHits(t)).toEqual([]);
  });
  it("answers the pins cap with too_large and the max, never a cut list (A36)", async () => {
    const d = stubData();
    const seed = d.places.find((p) => p.row.country === "CA" && p.detail.point)!;
    for (let i = 0; i < 2001; i++) {
      const slug = `${seed.row.slug}-x${i}`;
      d.places.push({ row: { ...seed.row, id: slug, slug, ref: `place/${slug}` }, detail: { ...seed.detail, slug, ref: `place/${slug}` } });
    }
    const r = await new StubStore({ data: d }).globePins("ca");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: "too_large", details: { max: 2000 } });
  });
});
