// A small fixture kit for the trip builder engine (TB-E1): places, towns, an in-memory drive index and a build body, so a test (and
// the golden fixtures of TB-G1 in core/test/fixtures/plan/) can state a plan in a few lines. Coordinates are real towns and parks of
// central Ontario; nothing here reads a file, the clock or the environment.
import { indexDriveData, type DriveIndex } from "../../src/drive/model.ts";
import type { EngineInput, EnginePlace, EnginePoint, EngineTown } from "../../src/plan/engineTypes.ts";
import { readSuitability } from "../../src/schedule/suitability.ts";
import type { PlaceRow } from "../../src/schema/api/place.ts";
import type { PlanBuildInput } from "../../src/schema/api/plan.ts";

/** The model with no country profile: every leg answers `rough` from the fallback speed and terrain (deterministic). */
export const EMPTY_DRIVE: DriveIndex = indexDriveData({ profiles: [], areas: [], crossings: [], segments: [], calibration: null });

export const pt = (lat: number, lon: number, cc: string | null = "CA"): EnginePoint => ({ lat, lon, cc });

export function mkPlace(ref: string, lat: number | null, lon: number | null, over: Partial<EnginePlace> = {}): EnginePlace {
  const slug = ref.split("/").pop()!.replace(/[^a-z0-9-]/g, "-");
  return {
    ref,
    slug,
    name: slug.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" "),
    kind: "lake",
    type: null,
    tags: [],
    point: lat === null || lon === null ? null : pt(lat, lon),
    region: "ontario",
    country: "CA",
    season: [5, 6, 7, 8, 9, 10],
    draw: "detour",
    complete: true,
    suitability: null,
    visitMin: 90,
    visitRange: null,
    distanceKm: null,
    gainM: null,
    needsDaylight: false,
    ...over,
  };
}

export const mkTown = (id: string, name: string, lat: number, lon: number, population: number | null = 5000, lodging: EngineTown["lodging"] = null): EngineTown => ({
  id,
  name,
  point: { ...pt(lat, lon), population },
  population,
  lodging,
});

export const ageLimited = (minAge: number, rule: "hard" | "advice" = "hard") => readSuitability({ minAge, rule, provenance: "test" });

/** Central Ontario: a start, three base towns and seven places (one far, one closed in winter, one with an age rule). */
export const ONT = {
  start: pt(43.6532, -79.3832), // the Toronto hub, a public point
  towns: [
    mkTown("ca-on-huntsville", "Huntsville", 45.3269, -79.2168, 19816, 2),
    mkTown("ca-on-dwight", "Dwight", 45.3289, -79.0033, 1000, 1),
    mkTown("ca-on-bracebridge", "Bracebridge", 45.0418, -79.3077, 16010, 2),
  ],
  places: [
    mkPlace("place/arrowhead", 45.3907, -79.2129, { kind: "lake", draw: "detour" }),
    mkPlace("route/lake-of-two-rivers-trail", 45.5788, -78.5195, { kind: "trail", visitMin: 120, draw: "journey" }),
    mkPlace("place/oxtongue-lake", 45.3606, -78.9246, { kind: "lake", visitMin: 60 }),
    mkPlace("place/dorset-tower", 45.2425, -78.8935, { kind: "viewpoint", visitMin: 45 }),
    mkPlace("place/ragged-falls", 45.3897, -78.9123, { kind: "waterfall", visitMin: 40, draw: "local" }),
    mkPlace("place/parliament-hill", 45.4236, -75.7009, { kind: "sight", visitMin: 120 }), // about 4 h from the others
    mkPlace("place/zipline-park", 45.33, -79.1, { kind: "activity", visitMin: 120, suitability: ageLimited(12) }),
  ],
};

export const placesMap = (ps: readonly EnginePlace[]): Map<string, EnginePlace> => new Map(ps.map((p) => [p.ref, p]));

/** A build body: near mode from the hub by default, two adults, standard pace, July. */
export function mkBuild(picks: readonly (string | { ref: string; must: boolean })[], over: Partial<PlanBuildInput> = {}): PlanBuildInput {
  return {
    where: { mode: "near", start: { kind: "hub", id: "toronto" }, driveLimitMin: 240 },
    nights: 2,
    pace: "standard",
    moves: "balanced",
    month: 7,
    picks: picks.map((p) => (typeof p === "string" ? { ref: p, must: false } : p)),
    bases: [],
    edits: [],
    origin: null,
    party: { adults: 2, children: [], walkKm: null },
    ...over,
  };
}

export function mkInput(build: PlanBuildInput, over: Partial<EngineInput> = {}): EngineInput {
  return {
    build,
    places: placesMap(ONT.places),
    towns: ONT.towns,
    start: build.where.mode === "near" ? ONT.start : null,
    gateway: null,
    tz: "America/Toronto",
    drive: EMPTY_DRIVE,
    ...over,
  };
}

/** A full Places row for the candidate tests (the P8 allowlist), from a few fields. */
export function mkRow(ref: string, lat: number | null, lon: number | null, over: Partial<PlaceRow> = {}): PlaceRow {
  const slug = ref.split("/").pop()!;
  return {
    id: slug, slug, name: slug.replace(/-/g, " "), kind: "lake", kindLabel: "Lake", legacyKind: null, country: "CA", country_name: "Canada",
    region: "ontario", region_name: "Ontario", regionAliases: ["ontario", "Ontario", "ON", "CA-ON"], area: "", area_name: "", lat, lon, km: null,
    gain_m: null, elevation_m: null, season: [5, 6, 7, 8, 9, 10], kid_fit: "", tags: [], image: null, trips: [], honesty: [],
    completeness: { level: "usable", label: "Usable" }, statsState: null, researched: true, type: null, effort: null, kids_from: null,
    kids_basis: null, time_band: "1-2h", price_band: null, booking: null, flags: [], walk_band: null, shape: null, best_time: null, badge: null,
    ref, approx: false, nearTown: null,
    ...over,
  };
}

/** A seeded generator for property tests (mulberry32): the TEST draws inputs from it; the engine itself never draws. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
