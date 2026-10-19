// relevance.ts points --build: coordinates from files we already hold; never Google; every point has a coord_src.
import { describe, expect, it } from "vitest";
import { TRIP_WINDOWS, buildPoints, windowFromLabel } from "../../src/relevance/points.ts";
import type { Sources } from "../../src/relevance/points.ts";

const ref = (r: string, class_key: string, extra: object = {}) => ({ ref: r, trip: "t", class_key, qid: null, name: null, ...extra });
const src = (over: Partial<Sources> = {}): Sources => ({
  refs: [],
  scope: [],
  locations: [],
  snapshot: null,
  wikidata: {},
  ...over,
});

describe("buildPoints", () => {
  it("keeps the points research lanes read for capture records, including refs with no relevance record, and lets a correction beat the generic pick", () => {
    const { file, report } = buildPoints(src({
      refs: [ref("place/top", "lift/x", { qid: "Q1" })],
      wikidata: { Q1: { label: "Top", p625: { lat: 1, lon: 2 } } },
      captured: {
        "place/top": { lat: 1.5, lon: 2.5, coord_src: "osm", point_source: "OSM node 9 (upper station)" },
        "part/place/lot#parking": { lat: 3.123456, lon: 4, coord_src: "osm", point_source: "OSM node 10" },
      },
    }));
    expect(file.points["place/top"]).toMatchObject({ lat: 1.5, lon: 2.5, coord_src: "osm", point_source: "OSM node 9 (upper station)" });
    expect(file.points["part/place/lot#parking"]).toMatchObject({ lat: 3.12346, lon: 4, coord_src: "osm" });
    expect(report.by_src).toEqual({ osm: 2, wikidata: 0 });
  });

  it("takes a location row resolved by wikidata or nominatim and ignores manual and unresolved rows", () => {
    const { file, report } = buildPoints(src({
      refs: [ref("place/a", "lake/x"), ref("place/b", "lake/x"), ref("place/c", "lake/x")],
      locations: [
        { id: "CA/AB/p/a", name: "A", lat: 1.234567, lon: 2.5, resolver: "wikidata", location_status: "resolved" },
        { id: "CA/AB/p/b", name: "B", lat: 3, lon: 4, resolver: "manual", location_status: "resolved" },
        { id: "CA/AB/p/c", name: "C", lat: 5, lon: 6, resolver: "nominatim", location_status: "unconfirmed" },
      ],
    }));
    expect(file.points["place/a"]).toMatchObject({ lat: 1.23457, lon: 2.5, coord_src: "wikidata" });
    expect(Object.keys(file.points)).toEqual(["place/a"]);
    expect(report.missing).toEqual(["place/b", "place/c"]);
  });

  it("a trail starts at the snapshot's OSM trailhead; a lake falls back to Wikidata P625, then OSM parking, then the approximate snapshot place", () => {
    const snapshot = {
      places: [{ id: "braies", name: "Braies", kind: "lake", lat: 46.7, lng: 12.08 }],
      access: { braies: { trailhead: { lat: 46.699, lon: 12.0855, point_source: "osm_node 1" }, parking: [{ lat: 46.7004, lon: 12.0847, point_source: "osm_way 2" }] } },
      publicTrips: [],
    };
    const scope = [{ ref: "place/braies", key: null, trip: "t", kind: "lake", name: "Braies", days: [], source: { protoId: "braies" } }];
    const trail = buildPoints(src({ refs: [ref("place/braies", "trail/lookout")], scope, snapshot }));
    expect(trail.file.points["place/braies"]).toMatchObject({ lat: 46.699, coord_src: "osm" });
    const lake = buildPoints(src({ refs: [ref("place/braies", "lake/x", { qid: "Q1" })], scope, snapshot, wikidata: { Q1: { label: "Braies", p625: { lat: 46.69, lon: 12.08 } } } }));
    expect(lake.file.points["place/braies"]).toMatchObject({ lat: 46.69, coord_src: "wikidata" });
    const parking = buildPoints(src({ refs: [ref("place/braies", "lake/x")], scope, snapshot }));
    expect(parking.file.points["place/braies"]).toMatchObject({ lat: 46.7004, coord_src: "osm" });
    const approx = buildPoints(src({ refs: [ref("place/braies", "lake/x")], scope, snapshot: { ...snapshot, access: {} } }));
    expect(approx.file.points["place/braies"]).toMatchObject({ lat: 46.7, lon: 12.08, coord_src: "prototype" });
  });

  it("a legacy trail with a named trailhead takes the point of the sight of that name in the same trip", () => {
    const { file } = buildPoints(src({
      refs: [ref("place/moraine-lake", "lake/x", { qid: "Q2", name: "Moraine Lake" }), ref("legacy/f/trails/larch", "trail/alpine-loop", { trailhead: "Moraine Lake" }), ref("legacy/f/trails/far", "trail/alpine-loop", { trailhead: "Nowhere Hut" })],
      wikidata: { Q2: { label: "Moraine Lake", p625: { lat: 51.32, lon: -116.18 } } },
    }));
    expect(file.points["legacy/f/trails/larch"]).toMatchObject({ lat: 51.32, lon: -116.18, coord_src: "wikidata" });
    expect(file.points["legacy/f/trails/far"]).toBeUndefined();
  });

  it("never emits a point without a coord_src, and never a link-only or Google source", () => {
    const { file } = buildPoints(src({ refs: [ref("place/a", "lake/x", { qid: "Q3" })], wikidata: { Q3: { label: "A", p625: { lat: 1, lon: 2 } } } }));
    for (const p of Object.values(file.points)) expect(`${p.coord_src}`).toMatch(/^(wikidata|nominatim|osm|prototype)$/);
  });

  it("a town with a stay comes from the day bases; the private home town is left out; windows come from the plans or a clear label", () => {
    const snapshot = {
      places: [],
      access: {},
      publicTrips: [{ id: "p-iceland", season: { label: "4 to 22 September" }, days: [{ base: "Hofn" }, { base: "Whitby" }, { base: "Unknown Bay" }] }],
    };
    const { file, report } = buildPoints(src({ snapshot, wikidata: { Q9: { label: "Höfn", p625: { lat: 64.25, lon: -15.2 } } } }), {});
    expect(file.towns.map((t) => t.id)).toEqual(["hofn"]);
    expect(file.towns[0]).toMatchObject({ has_stay: true, lat: 64.25 });
    expect(report.unresolved_bases).toEqual([{ trip: "iceland-ring-road-2027", base: "Unknown Bay" }]);
    expect(file.trips!["iceland-ring-road-2027"]).toEqual({ window: { from: "09-04", to: "09-22" }, base: { lat: 64.25, lon: -15.2 } });
    expect(TRIP_WINDOWS["dolomites-2027"]).toEqual({ from: "07-13", to: "07-26" });
  });

  it("windowFromLabel reads only an explicit day range", () => {
    expect(windowFromLabel("4 to 22 September")).toEqual({ from: "09-04", to: "09-22" });
    expect(windowFromLabel("Mid-July to end of August")).toBeNull();
    expect(windowFromLabel(undefined)).toBeNull();
  });
});
