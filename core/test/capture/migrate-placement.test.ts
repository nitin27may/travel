// META-1: `capture.ts migrate-placement` (capture contract 3.7.1): area_id from the locations store and the parent chain, never a guess;
// trailheads from held tracks; idempotent; only adds leaves (the migration ledger rule).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { insertAreaIds, planPlacementMigration, TRAILHEAD_MAX_OFFSET_M } from "../../src/capture/migratePlacement.ts";
import { migratePlacementCommand } from "../../src/capture/migratePlacementCli.ts";
import { capDoc, scratchRoot } from "./helpers.ts";
import { capturePointsFile } from "../../src/schema/capture/points.ts";

const A = "IT/veneto/belluno";
const B = "IT/trentino-alto-adige/bolzano";
const store = {
  schema_version: 3,
  countries: [{ code: "IT", a3: "ITA", name: "Italy" }],
  regions: [{ id: "IT/veneto", country: "IT", code: "34", name: "Veneto" }, { id: "IT/trentino-alto-adige", country: "IT", code: "32", name: "Trentino" }],
  areas: [{ id: A, region_id: "IT/veneto", slug: "belluno", name: "Belluno" }, { id: B, region_id: "IT/trentino-alto-adige", slug: "bolzano", name: "Bolzano" }],
  places: [{ id: `${A}/lago-x`, area_id: A, name: "Lago X", lat: 46.5, lon: 12.0 }],
};
const rec = (ref: string, over: Record<string, unknown> = {}) => ({ ref, type: "water.body.lake", layer: "place", name: ref, ...over });
const trail = (ref: string, over: Record<string, unknown> = {}) => rec(ref, { type: "nature.trail.hike", layer: "route", ...over });
const track = (over: Record<string, unknown> = {}) => ({ schema: "trail-track/1", place: "fed", refs: ["place/walk"], osm: ["relation:42"], fetched: "2026-10-19", stitched: true, confirmed: true, start_offset_m: 3, cut: "destination", geometry: [[12.1, 46.5], [12.2, 46.6]], ...over });

function fixture(records: unknown[], tracks: Record<string, unknown> = {}, points: Record<string, unknown> = {}): string {
  return scratchRoot({
    "data/locations/locations.json": store,
    "data/locations/page-keys.json": { schema: "catalogue-origin-keys/1", keys: { [`loc:${A}/lago-x`]: "place/lago-x" } },
    "data/capture/points.json": { schema: "capture-points/1", points },
    "data/capture/fx/a.json": capDoc(records, { trip: "fx" }),
    ...Object.fromEntries(Object.entries(tracks).map(([n, t]) => [`data/tracks/${n}.json`, t])),
  });
}
const sink = () => { const lines: string[] = []; return { lines, out: (s: string) => void lines.push(s), err: (s: string) => void lines.push(s) }; };

describe("area_id", () => {
  it("takes the store's area for a store place, then the parent's for what hangs off it, and leaves the rest a gap", () => {
    const root = fixture([
      rec("place/lago-x"),
      rec("part/place/lago-x#parking"),
      trail("place/walk", { starts_at: ["place/lago-x"] }),
      rec("place/unknown"),
      rec("offer/place/lago-x#boat", { type: "water.boat.boat_rental.rowboat", layer: "offer" }),
    ]);
    const plan = planPlacementMigration(root);
    expect(plan.problems).toEqual([]);
    expect(Object.fromEntries(plan.areas.map((a) => [a.ref, [a.area_id, a.via]]))).toEqual({
      "place/lago-x": [A, "store"],
      "part/place/lago-x#parking": [A, "parent"],
      "place/walk": [A, "parent"],
    });
    expect(plan.gaps.map((g) => [g.ref, g.why])).toEqual([["place/unknown", "no_source"]]);
    expect(plan.report).toMatchObject({ place_route_records: 4, area_id_before: 0, area_id_assigned: 3, area_id_after: 3 });
  });
  it("never chooses between parents that sit in different areas", () => {
    const root = fixture([rec("place/lago-x"), rec("place/other", { area_id: B }), trail("place/walk", { starts_at: ["place/lago-x"], part_of: ["place/other"] })]);
    const plan = planPlacementMigration(root);
    expect(plan.areas.map((a) => a.ref)).toEqual(["place/lago-x"]);
    expect(plan.gaps).toEqual([{ ref: "place/walk", trip: "fx", why: "parents_disagree" }]);
  });
  it("uses an alias of the record to find the store place, and ignores `reaches`", () => {
    const root = fixture([rec("trip/fx/lake:x", { aliases: ["place/lago-x"] }), trail("trip/fx/trail:t", { reaches: ["place/lago-x"] })]);
    const plan = planPlacementMigration(root);
    expect(plan.areas.map((a) => [a.ref, a.area_id])).toEqual([["trip/fx/lake:x", A]]);
    expect(plan.gaps.map((g) => g.ref)).toEqual(["trip/fx/trail:t"]);
  });
  it("writes only inserted area_id lines, and a second run finds nothing to do", () => {
    const root = fixture([rec("place/lago-x"), rec("place/unknown")]);
    const file = join(root, "data/capture/fx/a.json");
    const before = readFileSync(file, "utf8");
    const io = sink();
    expect(migratePlacementCommand(["--check"], root, io.out, io.err)).toBe(1);
    expect(migratePlacementCommand(["--write"], root, io.out, io.err)).toBe(0);
    const after = readFileSync(file, "utf8");
    const line = `      "area_id": "${A}",\n`;
    expect(after.replace(line, "")).toBe(before); // exactly one inserted line, every other byte untouched
    expect(JSON.parse(after).records[0]).toMatchObject({ ref: "place/lago-x", area_id: A });
    expect(planPlacementMigration(root).writes).toEqual([]);
    expect(migratePlacementCommand(["--check"], root, io.out, io.err)).toBe(0);
  });
  it("insertAreaIds refuses a file it cannot edit in place instead of guessing", () => {
    expect(() => insertAreaIds('{"records": [{"ref": "x"}]}', new Map([["x", A]]))).toThrow(/no top-level ref line/);
  });
});

describe("trailheads from held tracks", () => {
  const rows = (root: string) => JSON.parse(readFileSync(join(root, "data/capture/points.json"), "utf8")).points as Record<string, Record<string, unknown>>;
  it("a confirmed track cut at the trailhead gives an exact trailhead, with its source", () => {
    const root = fixture([trail("place/walk", { area_id: A })], { fed: track() });
    const plan = planPlacementMigration(root);
    expect(plan.report).toMatchObject({ trailheads_added: 1, trailheads_exact: 1, trailheads_approx: 0 });
    const io = sink();
    migratePlacementCommand(["--write"], root, io.out, io.err);
    expect(rows(root)["place/walk"]).toMatchObject({ lat: 46.5, lon: 12.1, coord_src: "osm", point_role: "trailhead" });
    expect(rows(root)["place/walk"]!.approx).toBeUndefined();
    expect(String(rows(root)["place/walk"]!.point_source)).toMatch(/^OSM relation 42, first vertex of the stored track data\/tracks\/fed\.json/);
    expect(planPlacementMigration(root).trailheads).toEqual([]); // idempotent
  });
  it.each([
    ["not confirmed", { confirmed: false, held_back: ["listed in UNCONFIRMED_TRAIL_DATA"] }],
    ["not cut", { cut: null }],
    ["far from the named trailhead", { start_offset_m: TRAILHEAD_MAX_OFFSET_M + 1 }],
    ["offset unknown", { start_offset_m: null }],
  ])("a track that is %s gives an approximate point with a note", (_n, over) => {
    const root = fixture([trail("place/walk", { area_id: A })], { fed: track(over) });
    const plan = planPlacementMigration(root);
    expect(plan.report).toMatchObject({ trailheads_added: 1, trailheads_exact: 0, trailheads_approx: 1 });
    expect(plan.trailheads[0]!.row).toMatchObject({ approx: true, point_role: "trailhead" });
    expect(String(plan.trailheads[0]!.row.approx_note).length).toBeGreaterThan(20);
  });
  it("writes the capture-points/2 shape into a /2 file, parsed by the normaliser's rule", () => {
    const root = fixture([trail("place/walk", { area_id: A })], { fed: track() });
    const file = join(root, "data/capture/points.json");
    writeFileSync(file, JSON.stringify({ schema: "capture-points/2", points: {} }, null, 2) + "\n");
    const io = sink();
    expect(migratePlacementCommand(["--write"], root, io.out, io.err)).toBe(0);
    const row = rows(root)["place/walk"]!;
    expect(row.point_source).toBeUndefined();
    expect(row).toMatchObject({ lat: 46.5, lon: 12.1, coord_src: "osm", point_role: "trailhead", point_src: { provider: "OpenStreetMap", element: "relation/42", read: "2026-10-19" }, meta: { run_id: "META-1" } });
    expect(capturePointsFile.safeParse(JSON.parse(readFileSync(file, "utf8"))).success).toBe(true);
  });
  it("leaves a trail that already has its own point, and a track that is not stitched", () => {
    const own = { lat: 46.4, lon: 12.0, coord_src: "osm", point_source: "OSM node 9 fixture" };
    expect(planPlacementMigration(fixture([trail("place/walk", { area_id: A })], { fed: track() }, { "place/walk": own })).trailheads).toEqual([]);
    expect(planPlacementMigration(fixture([trail("place/walk", { area_id: A })], { fed: track({ stitched: false, geometry: [] }) })).trailheads).toEqual([]);
  });
});

describe("the real data", () => {
  it("is fully migrated: nothing is left that held data can answer, and every gap has a reason", () => {
    const root = join(__dirname, "../../..");
    const plan = planPlacementMigration(root);
    expect(plan.problems).toEqual([]);
    expect(plan.writes.map((w) => w.path)).toEqual([]);
    expect(plan.report.area_gaps.parents_disagree).toBe(0);
  });
});
