// Which stops of a day are pins on the route map, and in what order (map note 4.1). Pure and small: the day list needs it for the number badges,
// so it is in the page's start JS; everything that draws lives in the map's own chunk (routeSpec.ts).
import type { DayTimeline } from '@travel/core/schedule/types.ts';
import type { LngLat } from '@/lib/map/types';

/** A road or a drive is a line stored as a point: it is never a pin (note 4.1, T5). */
const ROAD = /\b(?:scenic drive|drive|parkway|highway|hwy|road)\b/i;
export const isRoadLike = (name: string): boolean => ROAD.test(name);

/** Two stops within the same 4-decimal cell (about 11 m) are one spot. */
export const cellOf = (p: LngLat): string => `${p.lng.toFixed(4)},${p.lat.toFixed(4)}`;

export interface DayPin {
  /** 1-based, in the order of the day list. */
  n: number;
  id: string;
  at: LngLat;
  name: string;
  /** The timeline entries that stand on this spot. */
  entryIds: string[];
}
export interface DayMap {
  day: number;
  pins: DayPin[];
  /** entry id -> pin number, for every entry that has a pin. */
  entryPin: Map<string, number>;
  /** Stop entries with no position: they get no pin, no number and no line vertex. */
  unplaced: { id: string; name: string }[];
  /** How many stops are not on the map. Equals `unplaced.length`, except for a plain plan that only knows the count. */
  missing: number;
}

const STOP_KINDS = new Set(['visit', 'trail']);

/** Where a place is: the route model's point for its page, from the catalogue. The scheduler's entries carry a point only for a place the visitor added. */
export type PointOf = (placeSlug: string | null) => LngLat | null;

/** Every placed stop of the route model by place slug, for `dayMapOf`. */
export function pointLookup(route: { days: { points: { placeSlug: string | null; lng: number; lat: number }[] }[] }): PointOf {
  const by = new Map<string, LngLat>();
  for (const d of route.days) for (const p of d.points) if (p.placeSlug && !by.has(p.placeSlug)) by.set(p.placeSlug, { lng: p.lng, lat: p.lat });
  return (slug) => (slug ? by.get(slug) ?? null : null);
}

/** The pins of one scheduled day. The number is the order of the timeline entry, never the route model's order. */
export function dayMapOf(tl: Pick<DayTimeline, 'day' | 'entries'>, pointOf: PointOf): DayMap {
  const pins: DayPin[] = [];
  const byCell = new Map<string, DayPin>();
  const entryPin = new Map<string, number>();
  const unplaced: DayMap['unplaced'] = [];
  for (const e of tl.entries) {
    if (!STOP_KINDS.has(e.kind) || e.insideOf) continue;
    // a road is a stop of kind visit (a scenic drive); a trail is never one, whatever its name says
    if (e.kind === 'visit' && isRoadLike(e.title)) continue;
    const at = pointOf(e.at?.placeSlug ?? null) ?? (e.at?.point ? { lng: e.at.point.lon, lat: e.at.point.lat } : null);
    if (!at) {
      // a place the visitor added has no position record to wait for, so it is not counted as missing
      if (e.addedBy !== 'visitor') unplaced.push({ id: e.id, name: e.title });
      continue;
    }
    const c = cellOf(at);
    let pin = byCell.get(c);
    if (!pin) {
      pin = { n: pins.length + 1, id: `stop:${tl.day}:${e.at?.placeSlug ?? c}`, at, name: e.title, entryIds: [] };
      pins.push(pin);
      byCell.set(c, pin);
    }
    pin.entryIds.push(e.id);
    entryPin.set(e.id, pin.n);
  }
  return { day: tl.day, pins, entryPin, unplaced, missing: unplaced.length };
}

/** The same for a plan with no schedule: the route model's points, in order (a road is skipped). */
export function dayMapFromRoute(d: { n: number; points: { key: string; name: string; lng: number; lat: number }[]; unplaced?: number }): DayMap {
  const pins: DayPin[] = [];
  const seen = new Set<string>();
  for (const p of d.points) {
    const at = { lng: p.lng, lat: p.lat };
    const c = cellOf(at);
    if (seen.has(c) || isRoadLike(p.name)) continue;
    seen.add(c);
    pins.push({ n: pins.length + 1, id: `stop:${d.n}:${p.key}`, at, name: p.name, entryIds: [] });
  }
  return { day: d.n, pins, entryPin: new Map(), unplaced: [], missing: d.unplaced ?? 0 };
}

/** The key the day list uses for one entry. */
export const entryKey = (day: number, id: string): string => `${day}|${id}`;

/** Where the family slept the night before (the morning base) and where it sleeps (the night base). The route model only holds bases that have a point. */
export function dayBases<B extends { days: number[] }>(bases: B[], n: number): { morning: B | undefined; night: B | undefined } {
  return { morning: bases.find((b) => b.days.includes(n - 1)), night: bases.find((b) => b.days.includes(n)) };
}

// ---- the link between a row of the day list and a pin on the map -------------------------------------------------------------------------
export type MapEvent = { type: 'hover'; pin: string | null } | { type: 'ring'; pin: string };
const subs = new Set<(e: MapEvent) => void>();
let pending: { e: MapEvent; at: number } | null = null;

/** Plain events, no React state: a hover on a row must not re-render the day list. */
export const mapBus = {
  on(fn: (e: MapEvent) => void): () => void {
    subs.add(fn);
    return () => { subs.delete(fn); };
  },
  emit(e: MapEvent): void {
    if (e.type === 'ring' && !subs.size) pending = { e, at: Date.now() };
    subs.forEach((f) => f(e));
  },
  /** A ring asked for while the map was not there yet (the phone sheet was closed): the map takes it once, if it is fresh. */
  takePending(maxAgeMs = 4000): MapEvent | null {
    const p = pending;
    pending = null;
    return p && Date.now() - p.at < maxAgeMs ? p.e : null;
  },
};
