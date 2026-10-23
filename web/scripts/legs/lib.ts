// The pure parts of the legs fetcher (TRP2b, D-E5): no network, no key. Shared by scripts/legs-ors.mjs (which fetches) and the unit tests.
// A `trip-legs/2` file is a RESULT of the script: nothing here is meant to be edited by hand, and `checkLegsFile` is what says it was not.
import { decodePolyline5, encodePolyline5, tripLegsFile } from '@travel/core/schema/api/legs.ts';
import { API_LIMITS } from '@travel/core/schema/api/limits.ts';
import { lineClearOfHome } from '@travel/core/privacy/towns.ts';
import { simplifyLine } from '../tracks-osm.mjs';

/** Douglas-Peucker tolerance for a stored route line, in metres (store.ts A34: "about 30 m"). */
export const LEG_SIMPLIFY_M = 30;
/** The most polyline characters one trip's legs may hold in total (API3-R-13: about 400,000). */
export const TRIP_LEGS_MAX_CHARS = 400_000;
export const LEGS_ATTRIBUTION = 'Road times and route lines from OpenRouteService (openrouteservice.org), route data from OpenStreetMap contributors (ODbL).';

export interface Pt { lat: number; lng: number }
/** One consecutive pair of stops the trip route model asks a leg for, under the file's own pair keys. */
export interface RoutePair { from: string; to: string; a: Pt; b: Pt; label: string }

export const unordered = (a: string, b: string): string => [a, b].sort().join('|');

/** A route more than this many times the straight line, over a longer pair, is a data problem (a closed road, a wrong pin) and is not drawn as a route. */
export const MAX_CIRCUITY = 5;
export const LONG_PAIR_MIN = 10;

/** The pairs the fetcher could not route and says so: `data/schedules/legs/<trip>.unrouted.json`, written by the script, read by `--check`. */
export interface UnroutedFile { schema: 'trip-legs-unrouted/1'; trip: string; pairs: { from: string; to: string; reason: string }[] }

/** A route line simplified to about 30 m and re-encoded, widened until it fits one leg's character cap. */
export function simplifyPolyline(encoded: string, tolM: number = LEG_SIMPLIFY_M): { geometry: string; tolM: number } | null {
  const pts = decodePolyline5(encoded);
  if (!pts || pts.length < 2) return null;
  let tol = tolM;
  for (let i = 0; i < 12; i++) {
    const out = encodePolyline5(simplifyLine(pts, tol));
    if (out.length <= API_LIMITS.tripLegs.polylineChars) return { geometry: out, tolM: tol };
    tol *= 1.5;
  }
  return null;
}

/** How many legs of a file carry a geometry the privacy guard would refuse to serve (a vertex within the household radius). Only the count is ever printed. */
export function refusedGeometries(legs: readonly { geometry?: string }[]): number {
  return legs.filter((l) => l.geometry !== undefined && !lineClearOfHome(l.geometry)).length;
}

export interface LegsReport { problems: string[]; legs: number; routed: number; chars: number; missing: RoutePair[]; refused: number }

/**
 * Validates a legs file with no network: the Zod schema, the contract's caps, the total size, that no served geometry would be refused, and
 * coverage of the route model's pairs (a missing pair is a problem; a leg for a pair the route model no longer asks for is a problem too,
 * because a stale leg would never be drawn). `pairs` is null when only the file itself is checked.
 */
export function checkLegsFile(raw: unknown, slug: string, pairs: readonly RoutePair[] | null, unrouted: UnroutedFile | null = null): LegsReport {
  const problems: string[] = [];
  const parsed = tripLegsFile.safeParse(raw);
  if (!parsed.success) {
    return { problems: [`does not parse as trip-legs/1 or /2: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`], legs: 0, routed: 0, chars: 0, missing: [], refused: 0 };
  }
  const f = parsed.data;
  if (f.trip !== slug) problems.push(`names trip "${f.trip}", expected "${slug}"`);
  if (f.legs.length > API_LIMITS.tripLegs.max) problems.push(`${f.legs.length} legs is over the cap of ${API_LIMITS.tripLegs.max}`);
  const legs = f.legs as { from: string; to: string; geometry?: string }[];
  const chars = legs.reduce((n, l) => n + (l.geometry?.length ?? 0), 0);
  if (chars > TRIP_LEGS_MAX_CHARS) problems.push(`${chars} polyline characters is over the total cap of ${TRIP_LEGS_MAX_CHARS}`);
  const seen = new Set<string>();
  for (const l of legs) {
    const k = unordered(l.from, l.to);
    if (seen.has(k)) problems.push(`pair ${l.from} / ${l.to} appears twice`);
    seen.add(k);
    if (l.geometry && !decodePolyline5(l.geometry)) problems.push(`leg ${l.from} -> ${l.to} has a geometry that does not decode`);
  }
  const refused = refusedGeometries(legs);
  if (refused > 0) problems.push(`${refused} leg geometr${refused === 1 ? 'y' : 'ies'} within the household radius: the file must not hold them`);
  const known = new Set((unrouted?.pairs ?? []).map((p) => unordered(p.from, p.to)));
  const missing = pairs ? pairs.filter((p) => !seen.has(unordered(p.from, p.to)) && !known.has(unordered(p.from, p.to))) : [];
  if (unrouted && unrouted.trip !== slug) problems.push(`the unrouted list names trip "${unrouted.trip}", expected "${slug}"`);
  for (const k of known) if (seen.has(k)) problems.push('a pair is both routed and listed as unrouted');
  if (pairs) {
    const asked = new Set(pairs.map((p) => unordered(p.from, p.to)));
    if ([...known].some((k) => !asked.has(k))) problems.push('the unrouted list names a pair the route model does not ask for');
    const wanted = new Set(pairs.map((p) => unordered(p.from, p.to)));
    const stale = legs.filter((l) => !wanted.has(unordered(l.from, l.to))).length;
    if (stale) problems.push(`${stale} leg(s) are for pairs the route model does not ask for`);
    if (missing.length) problems.push(`${missing.length} of ${pairs.length} pairs have no leg`);
    if (f.schema === 'trip-legs/2' && missing.length === 0) {
      const bare = legs.filter((l) => !l.geometry).length;
      if (bare) problems.push(`${bare} leg(s) have no geometry`);
    }
  }
  return { problems, legs: legs.length, routed: legs.filter((l) => l.geometry).length, chars, missing, refused };
}
