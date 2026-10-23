// Trip legs (D-E5, API-3; store.ts A34): the routed road and path legs of ONE trip, read when its map mounts, never inside getTrip, so
// the trip detail and the trip page HTML do not grow (P2, P8). Two shapes live here:
//   - `tripLegsFile`: the data file data/schedules/legs/<trip>.json (`trip-legs/2`; `trip-legs/1` is read too), written by the legs
//     fetcher (web/scripts/legs-ors.mjs, TRP2b) and never served as it is: its `from`/`to` are the fetcher's own pair keys;
//   - `tripLegs`: what the API answers, keyed by the PUBLIC stop keys of getTrip's detail, so no private or prototype id is served.
// The geometry is a Google encoded polyline at precision 5 (1e-5 degree, about 1 m), simplified to about 30 m by the fetcher. The
// encoder and decoder below are the one definition; the privacy detector decodes every `geometry` string with it (detect.ts).
import { z } from "zod";
import { apiDate, apiSlug } from "./common.ts";
import { API_LIMITS } from "./limits.ts";
import { movedTrip, tripRefId } from "./trip.ts";

export const LEG_MODES = ["drive", "walk"] as const;
export const LEG_PROFILES = ["driving-car", "foot-hiking"] as const;

/** Polyline characters: every 5-bit chunk is offset by 63, so a valid string holds only `?` (63) to `~` (126). */
export const POLYLINE5_RE = /^[\x3F-\x7E]+$/;
export const encodedPolyline = z
  .string()
  .min(2)
  .max(API_LIMITS.tripLegs.polylineChars)
  .regex(POLYLINE5_RE)
  .meta({ description: "Google encoded polyline, precision 5 (lat then lon per vertex, 1e-5 degrees); decode with decodePolyline5" });

const PRECISION = 1e5;

function encodeValue(v: number): string {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let out = "";
  while (n >= 0x20) {
    out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>>= 5;
  }
  return out + String.fromCharCode(n + 63);
}

/** Encodes `[lon, lat]` pairs (the GeoJSON order every other geometry here uses) as a precision-5 polyline. */
export function encodePolyline5(points: readonly (readonly [number, number])[]): string {
  let lat = 0;
  let lon = 0;
  let out = "";
  for (const [x, y] of points) {
    const la = Math.round(y * PRECISION);
    const lo = Math.round(x * PRECISION);
    out += encodeValue(la - lat) + encodeValue(lo - lon);
    lat = la;
    lon = lo;
  }
  return out;
}

/** Decodes a precision-5 polyline to `[lon, lat]` pairs; null when the string is not a well-formed polyline (a truncated chunk, an odd count, a value off the globe). */
export function decodePolyline5(s: string): [number, number][] | null {
  if (!POLYLINE5_RE.test(s)) return null;
  const values: number[] = [];
  let shift = 0;
  let acc = 0;
  for (let i = 0; i < s.length; i++) {
    const b = s.charCodeAt(i) - 63;
    acc |= (b & 0x1f) << shift;
    shift += 5;
    if (b < 0x20) {
      values.push(acc & 1 ? ~(acc >> 1) : acc >> 1);
      acc = 0;
      shift = 0;
    } else if (shift > 30) return null;
  }
  if (shift !== 0 || values.length % 2 !== 0) return null;
  const out: [number, number][] = [];
  let lat = 0;
  let lon = 0;
  for (let i = 0; i < values.length; i += 2) {
    lat += values[i]!;
    lon += values[i + 1]!;
    const y = lat / PRECISION;
    const x = lon / PRECISION;
    if (Math.abs(y) > 90 || Math.abs(x) > 180) return null;
    out.push([x, y]);
  }
  return out;
}

// ---- the data file ------------------------------------------------------------------------------------------------------------

const fileLegShape = {
  /** the fetcher's pair keys (never served; the store maps them to stop keys) */
  from: z.string().min(1).max(120),
  to: z.string().min(1).max(120),
  profile: z.enum(LEG_PROFILES),
  mode: z.enum(LEG_MODES),
  km: z.number().min(0),
  minutes: z.number().min(0),
};

/** `trip-legs/1` (km and minutes only): the Dolomites file of 19 Oct 2026. Readers accept it; writers write /2. */
export const tripLegsFileV1 = z.strictObject({
  schema: z.literal("trip-legs/1"),
  trip: apiSlug,
  fetched: apiDate,
  attribution: z.string().min(1),
  legs: z.array(z.strictObject(fileLegShape)),
});

/** `trip-legs/2`: /1 plus an optional encoded polyline per leg and the simplification tolerance used. */
export const tripLegsFileV2 = z.strictObject({
  schema: z.literal("trip-legs/2"),
  trip: apiSlug,
  fetched: apiDate,
  /** the routing service and the map data licence, verbatim in every answer (ORS; OpenStreetMap contributors, ODbL) */
  attribution: z.string().min(1),
  /** the Douglas-Peucker tolerance the geometry was simplified with, in metres (about 30) */
  simplifiedM: z.number().positive().optional(),
  legs: z.array(z.strictObject({ ...fileLegShape, geometry: encodedPolyline.optional() })),
});

export const tripLegsFile = z.discriminatedUnion("schema", [tripLegsFileV1, tripLegsFileV2]);

// ---- the API answer -----------------------------------------------------------------------------------------------------------

/**
 * A stop key of getTrip's detail: a day item's `id` (`days[].items[].id` or a track item's), or `base:<base id>` for a base
 * (`bases[].id`). The map matches its own pins by these, so a leg names no place by a private key.
 */
export const legStopKey = z.string().min(1).max(120);

/**
 * One routed leg. Only legs the file routes are listed; a pair the map draws with no leg here is a straight-line estimate, dashed
 * and labelled (T5). `geometry` is null when the file has none for the pair, or when the town guard's line rule refused it
 * (`safeGeometry`, store.ts A33): the leg then draws dashed too, with its km and minutes kept.
 */
export const tripLeg = z.strictObject({
  day: z.int().min(0),
  from: legStopKey,
  to: legStopKey,
  mode: z.enum(LEG_MODES),
  km: z.number().min(0),
  minutes: z.number().min(0),
  geometry: encodedPolyline.nullable(),
});

/**
 * `TripLegs` (tripLegs): one public trip's routed legs in day order, then the order of the day's stops. At most API_LIMITS.tripLegs.max
 * legs (more is `too_large`). `attribution` is the file's line and must be shown wherever a leg's geometry is drawn (ODbL).
 */
export const tripLegs = z.strictObject({
  ref: tripRefId,
  slug: apiSlug,
  legs: z.array(tripLeg),
  attribution: z.string(),
  /** the day the legs were fetched, or null when the trip has no legs file */
  fetched: apiDate.nullable(),
});

/** What tripLegs returns: the legs, or where a retired trip slug moved (handler 308, the query kept: store.ts A32). */
export const tripLegsLookup = z.union([tripLegs, movedTrip]);

export const tripLegsInput = z.strictObject({ slug: apiSlug });

export type TripLegsFile = z.infer<typeof tripLegsFile>;
export type TripLeg = z.infer<typeof tripLeg>;
export type TripLegs = z.infer<typeof tripLegs>;
export type TripLegsLookup = z.infer<typeof tripLegsLookup>;
