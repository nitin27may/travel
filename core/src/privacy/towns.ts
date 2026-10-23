// THE TOWN GUARD (D-E3 as amended by store.ts A33; owner decision Q87, 23 Oct 2026: safe geometry, not exclusion). The towns layer,
// `near(city=)`, the nearby block's towns and the globe's city outlines serve every town of the gazetteer. A town whose centre or outline
// lies within the household radius would make respond()'s detector answer 500 for exactly that town, and iterating town ids would then
// find it (audit GB-A-8). So every town passes through these functions at LOAD (the dataset or towns loader, before any store holds it:
// store.ts A18), and no town is ever treated by name.
//
// Rules, generic over every town; this file names no town and must never name one (the start sheet's grep check):
//   1. A centre outside the radius is served as it is.
//   2. A centre inside the radius is replaced by the town's alternative public point (its Wikidata point) when that is outside the
//      radius; otherwise by the point at a FIXED offset from the centre: 2 x radius + radius / 4 due north (then east, west, south). The
//      triangle inequality puts that point outside the radius wherever home lies inside it, so the moved centre does not depend on where
//      home is. A rule such as "the nearest point just outside the radius" is refused: from the public centre and the moved one an
//      observer could solve for the home point (A33).
//   3. An outline or line with any coordinate within the radius (in either axis order, as the detector reads it) is not served: an
//      outline becomes the ring (`geometry: null`, like a town OSM has no polygon for), a leg is drawn as a dashed estimate.
//   4. Nothing marks a guarded town: the row keeps the public gazetteer fields only, with no flag, so the layer cannot be read for which
//      town was moved. `moved` below is for the loader's count line, never for output.
// The privacy detector exempts a towns row's id and name, and the near or city chip label (detect.ts, the typed exemption), so the home
// town's NAME may appear where any town's name appears; its coordinates never do.
import { HOME_RADIUS_KM } from "../config/nearby.ts";
import { EARTH_RADIUS_KM, haversineKm, type LatLon } from "../geo/distance.ts";
import { decodePolyline5, POLYLINE5_RE } from "../schema/api/legs.ts";
import { nearHome } from "./home.ts";

/** How the towns layer treats a town whose centre lies within the household radius. */
export type TownPolicy = "safe-geometry" | "exclude";

/**
 * Owner decision Q87: serve the town with safe geometry. `"exclude"` is the one-line switch the start sheet promised: a guarded town is
 * then left out of the layer (`safeTown` returns null), so `city=<its id>` answers `not_found` like any unknown id.
 */
export const TOWN_POLICY: TownPolicy = "safe-geometry";

/** A centre the guard moved: in kilometres from the town's own centre (2 x radius + radius / 4: outside the radius wherever home is inside it). */
export const guardOffset = (): number => 2 * HOME_RADIUS_KM + HOME_RADIUS_KM / 4;

/** Bearings tried for the fixed offset, in order: north, east, west, south. */
const BEARINGS_DEG = [0, 90, 270, 180] as const;

const RAD = Math.PI / 180;

/** The point `km` from `from` along the initial great-circle bearing `deg`. */
function destination(from: LatLon, deg: number, km: number): LatLon {
  const d = km / EARTH_RADIUS_KM;
  const th = deg * RAD;
  const p1 = from.lat * RAD;
  const l1 = from.lon * RAD;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th));
  const l2 = l1 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  const lon = ((((l2 / RAD + 540) % 360) + 360) % 360) - 180;
  return { lat: p2 / RAD, lon };
}

export interface SafeTownInput {
  lat: number;
  lon: number;
  /** the town's alternative public point (its Wikidata coordinate), or null */
  alt?: LatLon | null;
}

export interface SafeTown {
  lat: number;
  lon: number;
  /** true when the centre was replaced: for the loader's count only, never served (rule 4) */
  moved: boolean;
}

/**
 * The centre to serve for a town (rules 1, 2), or null when TOWN_POLICY is `"exclude"` and the town is guarded. Pure apart from the
 * household point, which it only asks about through `nearHome()`.
 */
export function safeTown(t: SafeTownInput): SafeTown | null {
  if (!nearHome(t.lat, t.lon)) return { lat: t.lat, lon: t.lon, moved: false };
  if (TOWN_POLICY === "exclude") return null;
  if (t.alt && !nearHome(t.alt.lat, t.alt.lon)) return { lat: t.alt.lat, lon: t.alt.lon, moved: true };
  const km = guardOffset();
  for (const deg of BEARINGS_DEG) {
    const p = destination(t, deg, km);
    if (!nearHome(p.lat, p.lon) && haversineKm(t, p) > km - 1e-6) return { lat: p.lat, lon: p.lon, moved: true };
  }
  // unreachable while the centre is inside the radius (triangle inequality); a broken geo module must not serve the centre
  throw new Error("town guard: no centre outside the household radius");
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
/** The detector's own test (detect.ts): a pair is near home in either axis order. */
const pairNear = (a: number, b: number): boolean => nearHome(a, b) || nearHome(b, a);

/**
 * True when no coordinate of a geometry lies within the household radius (rule 3). Reads GeoJSON-style nested coordinate arrays (any
 * depth, either axis order, an optional height), `{lat, lon}` objects, and encoded polylines (a string of polyline characters).
 */
export function safeGeometry(g: unknown): boolean {
  if (g === null || g === undefined) return true;
  if (typeof g === "string") {
    if (!POLYLINE5_RE.test(g)) return true;
    const pts = decodePolyline5(g);
    return !pts || !pts.some(([x, y]) => pairNear(x, y));
  }
  if (Array.isArray(g)) {
    if ((g.length === 2 || g.length === 3) && isNum(g[0]) && isNum(g[1])) return !pairNear(g[0], g[1]);
    return g.every(safeGeometry);
  }
  if (typeof g === "object") {
    const o = g as Record<string, unknown>;
    if (isNum(o.lat) && isNum(o.lon) && nearHome(o.lat, o.lon)) return false;
    return Object.values(o).every(safeGeometry);
  }
  return true;
}

/** An outline or line to serve: the geometry itself when `safeGeometry` holds, else null (the ring, or a dashed estimate). */
export function safeOutline<G>(g: G | null): G | null {
  return g !== null && safeGeometry(g) ? g : null;
}
