// The trip builder engine's inputs (trip-builder.md 4.2; task TB-E1). Types only, so a client re-flow (TB-E4) can import them for free.
//
// The engine is pure and synchronous: the caller (PlanService, TB-API) reads the catalogue, the towns layer and the leg cache first and
// hands the engine what it read. Nothing here is a coordinate of the visitor's home: a near-mode start is a public hub, airport or
// towns-layer town that the service resolved to a point (plan-draft.ts `planOrigin`), it is never keyed, never routed through the leg
// cache and never returned (the drive-key rule of core/src/drive/keys.ts: a visitor start is never a cell).
import type { DriveIndex } from "../drive/model.ts";
import type { Suitability } from "../schedule/types.ts";
import type { PlanBuildInput, PlanPointBasis } from "../schema/api/plan.ts";

/** A point the drive model reads (core/src/drive ModelPoint, without a cache key). Longitude positive east. */
export interface EnginePoint {
  lat: number;
  lon: number;
  /** ISO 3166-1 alpha-2, upper case; null when unknown (the model then answers `rough`) */
  cc: string | null;
  sub?: string | null;
  area?: string | null;
  population?: number | null;
}

export type DrawTier = "journey" | "detour" | "local";

/** One catalogue place as the engine reads it: what a Places row carries, plus the optional facts a richer source adds. */
export interface EnginePlace {
  ref: string;
  slug: string;
  name: string;
  /** PLACE_KINDS (`trail`, `lake`, ...) */
  kind: string;
  /** the capture type id, or null */
  type: string | null;
  /** tag ids */
  tags: string[];
  /**
   * The point the drive model reads: the row's exact point, or the one the service located by PLAN_POINT_BASES (RB-003: a town's gazetteer
   * town, the record's own point its page holds back, the place's car park or trailhead, the record a part belongs to; never an approximate
   * pin). Null: no location yet (TB_UNKNOWN, "We do
   * not have a location for this yet"); the candidates never offer such a place.
   */
  point: EnginePoint | null;
  /** RB-003: where `point` comes from; absent: the row's exact point or none */
  pointBasis?: PlanPointBasis;
  /** the canonical region slug and the country (upper case), for scoping */
  region: string | null;
  country: string | null;
  /** months the place is in season (1 to 12); empty: not known */
  season: number[];
  draw: DrawTier | null;
  /** completeness at the required tier (usable or complete) */
  complete: boolean;
  /** the suitability block the party reads; null: not checked yet (a gap is never a yes) */
  suitability: Suitability | null;
  /** minutes on site from data (`resolveDuration` input), or null for the type's rule */
  visitMin: number | null;
  /** a data range [low, high] in minutes (trails: resolved by pace) */
  visitRange: [number, number] | null;
  /** a trail's length and gain, for Naismith when it has no time */
  distanceKm: number | null;
  gainM: number | null;
  needsDaylight: boolean;
  /**
   * The refs of the areas (protected areas, zones) the place sits inside: the `within` closure of EG-Q, when the service has it. Absent:
   * not known, so the engine measures from the area's point (BUILDER_AREA.fallbackMemberKm). Present, even empty: the answer.
   */
  within?: readonly string[];
}

/** A candidate base: a towns-layer town (4.4). */
export interface EngineTown {
  /** towns-layer id (`ca-on-huntsville`) */
  id: string;
  name: string;
  point: EnginePoint;
  population: number | null;
  /** the lodging class 0 (none) to 3 (many) from OpenStreetMap counts (4.8, task TB-BL); null until measured */
  lodging: 0 | 1 | 2 | 3 | null;
}

/**
 * Routed minutes between two public points, read from the leg cache before the build (TB-L): keys are `routedKey(a, b)` of node ids
 * `p:<ref>` (a place) and `t:<town id>` (a town). A missing cell falls back to `modelDrive`, flagged as an estimate. The start is never
 * a node of this map.
 */
export type RoutedLegs = ReadonlyMap<string, number>;

/** Everything one build reads. */
export interface EngineInput {
  /** the build body (a draft's inputs plus the party), already parsed and checked by `planBuildRules` */
  build: PlanBuildInput;
  /** the picks' places, by ref; a pick absent here is a place we no longer list (TB_UNKNOWN) */
  places: ReadonlyMap<string, EnginePlace>;
  /** candidate base towns (at most BUILDER_PACK.baseTowns are scored); pinned or accepted bases must be among them to be used */
  towns: readonly EngineTown[];
  /** near mode: the start, resolved from `where.start` to its public point; null in trip mode */
  start: EnginePoint | null;
  /** trip mode: the arrival and departure point (`origin`, an airport's public point), or null when Getting there is not chosen */
  gateway: EnginePoint | null;
  /** the IANA zone the days are scheduled in (sun times, `core/src/sun`) */
  tz: string;
  /** the drive model's parameters (core/src/drive load.ts, or an in-memory index in tests) */
  drive: DriveIndex;
  /** routed cells, when the leg cache had them */
  routed?: RoutedLegs;
}
