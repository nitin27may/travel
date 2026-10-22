// Nearby, near mode and the towns layer (nearby-and-regions.md sections 4.2, 5.2, 5.3, 5.6). DEFINED here (API-1a), filled in phase E:
// until META-2 builds the towns layer, `near`, `towns` and a `city=` query answer `not_available` (contract cases K3, K4, K5, K15,
// K17 are pending with the task that fills them).
import { z } from "zod";
import { apiRef, apiSlug, apiTownId, paged } from "./common.ts";
import { PLACE_KINDS, placeQuery, placeRow } from "./place.ts";

/** Eight compass points, from the centre to the place (nearby spec 5.1). */
export const BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
/**
 * The time band of a distance (nearby spec 5.1): a walk under 1.2 km, then drive-time bands, never minutes until a routed matrix
 * exists. Every drive band is an estimate ("Drive time estimated" chip) unless `basis` is `routed`.
 */
export const NEAR_BANDS = ["walk", "lt15", "15-30", "30-60", "60-120"] as const;
/** Where a drive figure comes from: the timeline rule (an estimate) or a stored ORS matrix (short-trips 2.2). */
export const DRIVE_BASIS = ["estimate", "routed"] as const;

/** A near-mode centre token: `place:<slug>` or `area:<area id>` (nearby spec 5.3). A town centre is the `city` key, never a token. */
export const NEAR_TOKEN_RE = /^(?:place:[a-z0-9]+(?:-[a-z0-9]+)*|area:[a-z0-9][a-z0-9/-]*)$/;
export const nearToken = z.string().max(160).regex(NEAR_TOKEN_RE);

/** How distances were measured, for the count line and the honesty chip (case K17). */
export const nearBasis = z.strictObject({
  /** straight line between our own non-approximate points, never Google's (T5) */
  distance: z.literal("straight_line"),
  /** rows left out because their point is approximate: they count for Where, never for a distance */
  excludedApprox: z.int().min(0),
});

/** `NearQuery`: a centre (`near` token or `city` town id; `city` wins when both are set), a radius and any Places filter. */
export const nearQuery = z.strictObject({
  ...placeQuery.shape,
  near: nearToken.optional(),
  city: apiTownId.optional(),
  /** km; the store clamps anything above API_LIMITS.nearRadius.max to the max and says `clamped: true` */
  r: z.number().positive().optional(),
});

/** `NearRow`: a Places row plus where it lies from the centre. Every distance from a centre in this API is `distanceKm`. */
export const nearRow = z.strictObject({
  ...placeRow.shape,
  /** straight-line km from the centre (`km` is the row's trail length, so the distance has its own name) */
  distanceKm: z.number().min(0),
  bearing: z.enum(BEARINGS),
  band: z.enum(NEAR_BANDS),
  basis: z.enum(DRIVE_BASIS),
});

/** The centre a near answer is measured from. */
export const nearCentre = z.strictObject({
  kind: z.enum(["place", "area", "town"]),
  /** the token or town id that named it */
  key: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
});

/** One page of a near answer, nearest first, with the radius actually used. */
export const nearPage = z.strictObject({
  ...paged(nearRow).shape,
  centre: nearCentre,
  r: z.number().positive(),
  /** true when the asked radius was above the cap and was clamped to it (case K3) */
  clamped: z.boolean(),
  basis: nearBasis,
});

/** A town of the towns layer (nearby spec 5.6; rows `[id, name, lat, lon, pop, admin1, ascii]` of data/reference/towns/<cc>.json). */
export const town = z.strictObject({
  id: apiTownId,
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  pop: z.int().min(0).nullable(),
  /** lower-case ISO 3166-1 alpha-2 */
  cc: z.string().regex(/^[a-z]{2}$/),
  /** the canonical region slug (D-B3), or null when the country has none */
  region: z.string().nullable(),
  /** places within API_LIMITS.nearby.radius km under no filter, for the Where menu's city group */
  places: z.int().min(0).nullable(),
  /** distance and bearing from a `near` centre; null for a prefix lookup */
  distanceKm: z.number().min(0).nullable(),
  bearing: z.enum(BEARINGS).nullable(),
});

/**
 * `TownQuery`: either a centre and a radius (`near` or `city`, `r`), or a name prefix inside one region (`prefix`, `cc`, `region`).
 * A prefix with no region is `invalid_scope`: towns load by region, never the world (nearby spec 5.5).
 */
export const townQuery = z.strictObject({
  near: nearToken.optional(),
  city: apiTownId.optional(),
  r: z.number().positive().optional(),
  prefix: z.string().min(1).max(60).optional(),
  cc: z.string().regex(/^[a-zA-Z]{2}$/).optional(),
  region: z.string().min(1).max(120).optional(),
});

/** At most API_LIMITS.towns.max rows; `truncated` says more matched. */
export const townList = z.strictObject({ items: z.array(town), truncated: z.boolean() });

/** One place of the "Around here" block: the fields a card already shows (P8 allowlist). */
export const nearbyItem = z.strictObject({
  ref: apiRef,
  slug: apiSlug,
  name: z.string(),
  kind: z.enum(PLACE_KINDS),
  kindLabel: z.string(),
  distanceKm: z.number().min(0),
  bearing: z.enum(BEARINGS),
  band: z.enum(NEAR_BANDS),
  basis: z.enum(DRIVE_BASIS),
  badge: z.string().nullable(),
});

/**
 * `NearbyBlock` (nearbyForPlace): up to API_LIMITS.nearby.list places within API_LIMITS.nearby.radius km, nearest first, the count of
 * day trips out to API_LIMITS.nearby.dayTrips km (a link, not a list, P2), and the nearest towns. No block is drawn for a place with
 * no point or an approximate one (`state`), and approximate neighbours are never listed (case K17).
 */
export const nearbyBlock = z.strictObject({
  ref: apiRef,
  slug: apiSlug,
  state: z.enum(["ok", "no_point", "approx_point"]),
  radius: z.number().positive(),
  items: z.array(nearbyItem),
  /** rows within the radius beyond the list cap */
  more: z.int().min(0),
  dayTrips: z.strictObject({ count: z.int().min(0), r: z.number().positive() }),
  towns: z.array(z.strictObject({ id: apiTownId, name: z.string(), distanceKm: z.number().min(0), bearing: z.enum(BEARINGS) })),
  basis: nearBasis,
});

export type NearQuery = z.infer<typeof nearQuery>;
export type NearRow = z.infer<typeof nearRow>;
export type NearPage = z.infer<typeof nearPage>;
export type Town = z.infer<typeof town>;
export type TownQuery = z.infer<typeof townQuery>;
export type TownList = z.infer<typeof townList>;
export type NearbyBlock = z.infer<typeof nearbyBlock>;
export type NearbyItem = z.infer<typeof nearbyItem>;
