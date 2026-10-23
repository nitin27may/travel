// The one great-circle module (CONS-2; EXECUTION-PLAN 5.3). Every TypeScript caller that needs a distance, a bearing or a time band
// imports it from here; tools/geo.py mirrors it and tools/tests/test_geo_parity.py pins the two to one table
// (core/test/geo/pairs.json). The earth radius is written here and nowhere else (the `earth-radius` rule of tools/cons/hardcode_scan.py).
//
// Pure: no I/O, no framework, no clock. Points are `{ lat, lon }` in degrees, longitude positive east.
// Type-only: the zod-bearing contract file stays out of the client bundle (the const below is checked against it by its type).
import type { BEARINGS } from "../schema/api/nearby.ts";

export interface LatLon {
  lat: number;
  lon: number;
}

/** Mean earth radius in km (IUGG, 6371.0088). */
export const EARTH_RADIUS_KM = 6371.0088;

const RAD = Math.PI / 180;
const POINTS: typeof BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Great-circle distance in km. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Great-circle distance in metres. */
export function haversineM(a: LatLon, b: LatLon): number {
  return haversineKm(a, b) * 1000;
}

/** Eight-point compass bearing from `from` to `to` (initial great-circle bearing, nearby spec 5.1). */
export function bearing8(from: LatLon, to: LatLon): (typeof BEARINGS)[number] {
  const y = Math.sin((to.lon - from.lon) * RAD) * Math.cos(to.lat * RAD);
  const x = Math.cos(from.lat * RAD) * Math.sin(to.lat * RAD) - Math.sin(from.lat * RAD) * Math.cos(to.lat * RAD) * Math.cos((to.lon - from.lon) * RAD);
  const deg = (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
  return POINTS[Math.round(deg / 45) % 8]!;
}

/** A box in degrees. `west > east` means it crosses the antimeridian. */
export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** The box that holds every point of a circle of `radiusKm` around `centre` (a prefilter: it may include corners the circle misses). */
export function bboxOf(centre: LatLon, radiusKm: number): Bbox {
  const dLat = radiusKm / EARTH_RADIUS_KM / RAD;
  const south = Math.max(-90, centre.lat - dLat);
  const north = Math.min(90, centre.lat + dLat);
  if (north >= 90 || south <= -90) return { west: -180, south, east: 180, north };
  const dLon = Math.min(180, dLat / Math.cos(Math.max(Math.abs(south), Math.abs(north)) * RAD));
  if (dLon >= 180) return { west: -180, south, east: 180, north };
  const wrap = (x: number): number => (x < -180 ? x + 360 : x > 180 ? x - 360 : x);
  return { west: wrap(centre.lon - dLon), south, east: wrap(centre.lon + dLon), north };
}

/** True when the box holds the point (the antimeridian case included). */
export function bboxHas(box: Bbox, p: LatLon): boolean {
  if (p.lat < box.south || p.lat > box.north) return false;
  return box.west <= box.east ? p.lon >= box.west && p.lon <= box.east : p.lon >= box.west || p.lon <= box.east;
}

/** True when the circle of `radiusKm` around `centre` can touch the box: the nearest point of the box is within the radius. */
export function circleMeetsBbox(centre: LatLon, radiusKm: number, box: Bbox): boolean {
  if (bboxHas(box, centre)) return true;
  const lat = Math.min(box.north, Math.max(box.south, centre.lat));
  const inLon = box.west <= box.east ? centre.lon >= box.west && centre.lon <= box.east : centre.lon >= box.west || centre.lon <= box.east;
  if (inLon) return haversineKm(centre, { lat, lon: centre.lon }) <= radiusKm;
  return Math.min(haversineKm(centre, { lat, lon: box.west }), haversineKm(centre, { lat, lon: box.east })) <= radiusKm;
}
