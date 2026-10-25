// Routed legs onto the route map's lines (D-E5, TRP2b). The API names a leg by the PUBLIC stop keys of the trip detail: a day item's id, or
// `base:<id>`. The map draws a line per step of a day's chain (morning base, the numbered pins, night base), so a chain step takes the
// geometry of the API leg between the same two stops, in either direction (the API answers a pair once). A step with no such leg gets no
// entry and is drawn as the dashed estimate. Lives in the map's own chunk.
//
// The scheduler names its entries by its own ids, not the detail's item ids, so a stop is matched by its PLACE: the detail item's `placeSlug`
// (`slugOf`) against the slug the pin was made from (`stop:<day>:<slug>`). A stop key `slugOf` does not know (a base, or an id used as it is)
// is matched by itself.
import type { TripLegs } from '@travel/core/schema/api/index.ts';
import { decodePolyline5 } from '@/lib/map/polyline';
import type { LngLat } from '@/lib/map/types';
import { dayBases, type DayMap, type PointOf } from './mapPins';
import type { RouteBase } from './routeSpec';

type Leg = TripLegs['legs'][number];

/** `stop:<day>:<place slug>` names the place; a pin made from a bare position (`<lng>,<lat>`) names none. */
const placeKey = (pinId: string): string[] => {
  const slug = pinId.split(':')[2];
  return slug && !slug.includes(',') ? [`place:${slug}`] : [];
};

/** A routed leg's path, in the direction of the chain step, and how it is travelled. */
export interface RoutedPath { path: LngLat[]; mode: 'drive' | 'walk' }

/** One drawn step of a day's chain that a stored leg covers: the map's leg id, the two ends, the leg, and its path in the step's direction. */
export interface RoutedStep { id: string; day: number; from: string; to: string; leg: Leg; path: LngLat[]; mode: 'drive' | 'walk' }

/**
 * THE join between the stored legs and a day's chain (map and export both read it, P9). A step is two consecutive chain members (morning base,
 * the numbered pins in timeline order, night base); it is routed when a stored leg joins the same two stops, in either direction. A leg
 * that joins two stops of the day which are not consecutive in the timeline is no step and is never returned, so a file never carries a
 * drive the day does not make. A leg with an end that is not a chain member (an airport, an unplaced stop) is not a step either: the map
 * has no pin for it, and the export follows the map exactly.
 */
export function routedSteps(legs: readonly Leg[], models: readonly DayMap[], bases: readonly RouteBase[], slugOf: (stopKey: string) => string | null = () => null, pointOf: PointOf = () => null): RoutedStep[] {
  const norm = (k: string): string => {
    const s = k.startsWith('base:') ? null : slugOf(k);
    return s ? `place:${s}` : k;
  };
  const byPair = new Map<string, Leg>();
  for (const l of legs) if (l.geometry && !byPair.has(`${l.day}|${norm(l.from)}|${norm(l.to)}`)) byPair.set(`${l.day}|${norm(l.from)}|${norm(l.to)}`, l);
  const out: RoutedStep[] = [];
  if (!byPair.size) return out;
  for (const m of models) {
    if (!m.pins.length) continue;
    const { morning, night } = dayBases([...bases], m.day);
    const chain: { id: string; name: string; keys: string[] }[] = [
      ...(morning ? [{ id: '', name: morning.name, keys: [`base:${morning.id}`] }] : []),
      ...m.pins.map((p) => ({ id: `leg:${m.day}:${p.n}`, name: p.name, keys: [...placeKey(p.id), ...p.entryIds] })),
      ...(night ? [{ id: `leg:${m.day}:end`, name: night.name, keys: [`base:${night.id}`] }] : []),
    ];
    // Identity beyond the same place: a leg end is also this pin when its place has exactly the pin's catalogue coordinates (the Rockies key
    // a stop by its place and by its trail page, two records at one point). Exact equality only: no name match, no distance, no invented point.
    const here = new Set<string>();
    for (const l of legs) if (l.day === m.day) for (const k of [l.from, l.to]) { const sl = k.startsWith('base:') ? null : slugOf(k); if (sl) here.add(sl); }
    const sameSpot = (at: LngLat): string[] => [...here].filter((sl) => { const q = pointOf(sl); return !!q && q.lng === at.lng && q.lat === at.lat; }).map((sl) => `place:${sl}`);
    for (const c of chain) {
      const pin = m.pins.find((p) => `leg:${m.day}:${p.n}` === c.id);
      if (pin) c.keys.push(...sameSpot(pin.at).filter((k) => !c.keys.includes(k)));
    }
    const done = new Set<string>();
    for (let i = 1; i < chain.length; i++) {
      const [x, y] = [chain[i - 1]!, chain[i]!];
      for (const a of x.keys) {
        for (const b of y.keys) {
          const fwd = byPair.get(`${m.day}|${a}|${b}`);
          const back = fwd ? null : byPair.get(`${m.day}|${b}|${a}`);
          const leg = fwd ?? back;
          const line = leg?.geometry ? decodePolyline5(leg.geometry) : null;
          if (!line || line.length < 2 || done.has(y.id)) continue;
          done.add(y.id);
          out.push({ id: y.id, day: m.day, from: x.name, to: y.name, leg: leg!, path: back ? [...line].reverse() : line, mode: leg!.mode });
        }
      }
    }
  }
  return out;
}

/** Geometry by the map's leg id (`leg:<day>:<n>`, `leg:<day>:end`) for every step of every day that a routed leg covers. */
export function legGeometry(legs: readonly Leg[], models: readonly DayMap[], bases: readonly RouteBase[], slugOf: (stopKey: string) => string | null = () => null, pointOf: PointOf = () => null): Record<string, RoutedPath> {
  const out: Record<string, RoutedPath> = {};
  for (const s of routedSteps(legs, models, bases, slugOf, pointOf)) out[s.id] = { path: s.path, mode: s.mode };
  return out;
}

/** True when at least one leg carries a geometry: the map then shows the credit. */
export const hasRoutedLegs = (geometry: Record<string, RoutedPath>): boolean => Object.keys(geometry).length > 0;
