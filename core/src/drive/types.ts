// The drive-time contract (driving-time-model.md 4 and 6.1; DT-C). Every drive figure the product shows is a DriveEstimate: minutes,
// km, a range when modelled, and the confidence and source that say how far to trust it (P6: the right metadata at the right moment).
// Types only: no runtime code, so a client chunk can import them for free.
//
// Privacy (spec 5.6, Q-DT4): a visitor's start point is a `VisitorDrivePoint`. It has no `key` and carries `visitor: true`, so the
// key builders of keys.ts (`writableLegKey`, `cellKey`) reject it at compile time; nothing typed here can turn it into a cache key or a
// stored row. A `PublicDrivePoint` carries a `CacheKey`, which only keys.ts can mint.
import type { DRIVE_TERRAINS } from "../config/drive.ts";

/** How far to trust a figure (spec 4.1). */
export const DRIVE_CONFIDENCES = ["routed", "authored", "modelled", "rough", "none"] as const;
export type DriveConfidence = (typeof DRIVE_CONFIDENCES)[number];

/** Where a figure came from: the plan's own minutes, an authored segment, the leg cache, a router, or the model. */
export const DRIVE_SOURCES = ["plan", "segment", "cache", "ors", "osrm", "model"] as const;
export type DriveSource = (typeof DRIVE_SOURCES)[number];

/** The chips a leg can carry (spec 4.4, 4.6). */
export const DRIVE_FLAGS = ["ferry", "border", "closed-season", "winter", "unpaved", "4x4", "no-road"] as const;
export type DriveFlag = (typeof DRIVE_FLAGS)[number];

/** The layers of spec 4.1, in the order `estimateDrive` tries them. */
export const DRIVE_LAYERS = ["override", "L0", "L1", "L2", "L3"] as const;
export type DriveLayer = (typeof DRIVE_LAYERS)[number];

/** The confidence each layer answers with when it has a value (L3 answers `rough` or `none`). */
export const LAYER_CONFIDENCE: Readonly<Record<DriveLayer, readonly DriveConfidence[]>> = {
  override: ["authored"],
  L0: ["routed"],
  L1: ["routed"],
  L2: ["modelled", "rough"],
  L3: ["rough", "none"],
};

export type DriveTerrain = (typeof DRIVE_TERRAINS)[number];
export type DriveVehicle = "car" | "4x4";

export interface DriveEstimate {
  /** integer minutes; null when there is no road */
  minutes: number | null;
  /** integer km; null when there is no road or it is unknown */
  km: number | null;
  /** [low, high] integer minutes; modelled and rough figures only */
  range: [number, number] | null;
  confidence: DriveConfidence;
  source: DriveSource;
  flags: DriveFlag[];
  /** the ORS and OSM line when routed; null for the model */
  attribution: string | null;
}

// ----- points and keys -----------------------------------------------------------------------------------------------------------------

declare const cacheKeyBrand: unique symbol;
/**
 * A leg cache key (spec 5.6): `r:<public alias>` for a catalogue point, `t:<geonameid>` for a town, `g:<geohash 6>` for any other
 * public point. Minted only by keys.ts (`aliasKey`, `townKey`, `cellKey`, `parseCacheKey`).
 */
export type CacheKey = string & { readonly [cacheKeyBrand]: "drive-cache-key" };
export type CacheKeyKind = "r" | "t" | "g";

/** What the model reads of a point. Longitude positive east (core/src/geo). */
export interface DrivePointBase {
  lat: number;
  lon: number;
  /** ISO 3166-1 alpha-2, upper case; null when unknown (the model then answers `rough`) */
  cc: string | null;
  /** ISO 3166-2 suffix (`AB`, `32`), upper case */
  sub?: string | null;
  /** an area id of the locations store (`CA/AB/banff-national-park`) */
  area?: string | null;
  /** the population of the town the point stands for, when it is one (city entry, spec 4.4) */
  population?: number | null;
}

/** A public point: a catalogue place, a town or a public cell. It may be cached. */
export interface PublicDrivePoint extends DrivePointBase {
  key: CacheKey;
  visitor?: never;
}

/** The visitor's own start: used inside one request and dropped. Never a key, never stored, never logged (Q-DT4). */
export interface VisitorDrivePoint extends DrivePointBase {
  key?: never;
  visitor: true;
}

export type DrivePoint = PublicDrivePoint | VisitorDrivePoint;

/** What the pure model accepts: any point, keyed or not (it never caches; segments match on an `r:` key when there is one). */
export type ModelPoint = DrivePointBase & { key?: CacheKey; visitor?: true };

// ----- options and the service contract -----------------------------------------------------------------------------------------------

/** The options of the pure model (L2): the trip month (1 to 12) and the vehicle. */
export interface ModelOptions {
  month?: number;
  vehicle?: DriveVehicle;
}

/** The options of `estimateDrive` (TB-L): the model's, plus whether a router may be asked (false: L0, then L2). */
export interface EstimateOptions extends ModelOptions {
  allowRouting: boolean;
}

/**
 * The server leg service (TB-L implements it as the server leg service, the only code that calls ORS). Matrices are at most
 * DRIVE_CACHE.matrixMax x DRIVE_CACHE.matrixMax.
 */
export interface DriveEstimator {
  estimateDrive(a: DrivePoint, b: DrivePoint, opts: EstimateOptions): Promise<DriveEstimate>;
  estimateDriveMatrix(sources: DrivePoint[], targets: DrivePoint[], opts: EstimateOptions): Promise<DriveEstimate[][]>;
}

/** One `leg_cache` row as the leg service may write it (spec 5.6). Both ends are CacheKeys: a visitor start cannot appear. */
export interface LegCacheRow {
  from_cell: CacheKey;
  to_cell: CacheKey;
  mode: "drive";
  profile: "driving-car";
  engine: "ors" | "osrm";
  engine_version: string | null;
  seconds: number;
  metres: number;
  flags: DriveFlag[];
}

/** Why the model answered as it did (`explainDrive`): every factor, for tests, the CLI and the "Estimated" sheet (P2). */
export interface DriveExplanation {
  straightKm: number;
  band: string;
  terrain: DriveTerrain;
  /** the profile rows used (`CA-AB`, `IT`), or null when the country has none */
  profiles: string[] | null;
  ruralKmh: number;
  /** the share of the leg read as motorway (0 to 1; RB-008) and the limit the speed starts from: rural plus that share of the gap */
  motorwayShare: number;
  limitKmh: number;
  detour: number;
  realisation: number;
  /** calibration factors applied (1 when the cell is uncalibrated) */
  kDetour: number;
  kSpeed: number;
  calibrationCell: string | null;
  roadKm: number;
  baseMinutes: number;
  modifiers: { name: string; minutes: number; note: string }[];
}
