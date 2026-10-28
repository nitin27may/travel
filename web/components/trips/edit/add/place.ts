// The places the add picker offers (STEP2-E3): a light list row from the catalogue, never a whole record (P8), turned into the
// timeline's own candidate so the scheduler places it exactly as it places a published place. Pure.
import { ADD_NEARBY_KM } from '@travel/core/config/nearby.ts';
import { haversineM } from '@travel/core/geo/distance.ts';
import type { Point } from '@travel/core/schedule/types.ts';
import { kindOf, type AddCandidate } from '@/components/trips/timeline/model';

/** The fields of a Places list row the picker reads. */
export interface Found {
  slug: string;
  name: string;
  /** a catalogue kind: trail, lake, viewpoint, waterfall, sight, town, area, activity, lift, stay, eatery */
  kind: string;
  kindLabel: string;
  lat: number | null;
  lon: number | null;
  km: number | null;
  gainM: number | null;
  /** "Banff National Park" or the area's name; empty when the row has none */
  area: string;
  kidFit: string;
  /** the youngest age the place suits, when known */
  kidsFrom: number | null;
  flags: string[];
  season: number[];
}

/**
 * A park, area, stay or eatery is never a stop (TB-PIN R1; SW-014): a park is a place to be in, a stay is a base, and meals are the
 * scheduler's own. The picker never offers them, whatever the list returns.
 */
export const NOT_A_STOP: ReadonlySet<string> = new Set(['area', 'stay', 'eatery']);
export const isStop = (f: Pick<Found, 'kind'>): boolean => !NOT_A_STOP.has(f.kind);

/** The picker's candidate for a row, with the distance from where the day is. */
export function candidateOf(f: Found, km: number | null): AddCandidate {
  const k = kindOf(f.kind);
  const hasStats = f.km !== null || f.gainM !== null;
  return {
    key: f.slug, name: f.name, kind: k.kind, sub: k.sub, placeSlug: f.slug, point: f.lat !== null && f.lon !== null ? { lat: f.lat, lon: f.lon } : null, durationMin: null,
    durationRange: null, stats: hasStats ? { distanceKm: f.km, gainM: f.gainM } : null, label: f.kindLabel, km, group: 'nearby',
  };
}

/** Straight-line km between two points, one decimal. */
export const kmBetween = (a: Point, b: Point): number => Math.round(haversineM(a, b) / 100) / 10;

/** The bounding box `[west, south, east, north]` of a circle of `km` round `p`, for a list query (the near API answers `not_available` until N2). */
export function bboxAround(p: Point, km: number = ADD_NEARBY_KM): string {
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.max(0.05, Math.cos((p.lat * Math.PI) / 180)));
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  return [clamp(p.lon - dLon, 180), clamp(p.lat - dLat, 90), clamp(p.lon + dLon, 180), clamp(p.lat + dLat, 90)].map((n) => n.toFixed(4)).join(',');
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
/** The compass point from `a` to `b`. */
export function bearingOf(a: Point, b: Point): (typeof COMPASS)[number] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  const deg = (Math.atan2(y, x) * 180) / Math.PI + 360;
  return COMPASS[Math.round((deg % 360) / 45) % 8]!;
}
