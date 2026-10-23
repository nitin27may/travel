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
import { dayBases, type DayMap } from './mapPins';
import type { RouteBase } from './routeSpec';

type Leg = TripLegs['legs'][number];

/** `stop:<day>:<place slug>` names the place; a pin made from a bare position (`<lng>,<lat>`) names none. */
const placeKey = (pinId: string): string[] => {
  const slug = pinId.split(':')[2];
  return slug && !slug.includes(',') ? [`place:${slug}`] : [];
};

/** Geometry by the map's leg id (`leg:<day>:<n>`, `leg:<day>:end`) for every step of every day that a routed leg covers. */
export function legGeometry(legs: readonly Leg[], models: readonly DayMap[], bases: readonly RouteBase[], slugOf: (stopKey: string) => string | null = () => null): Record<string, LngLat[]> {
  const norm = (k: string): string => {
    const s = k.startsWith('base:') ? null : slugOf(k);
    return s ? `place:${s}` : k;
  };
  const byPair = new Map<string, Leg>();
  for (const l of legs) if (l.geometry && !byPair.has(`${l.day}|${norm(l.from)}|${norm(l.to)}`)) byPair.set(`${l.day}|${norm(l.from)}|${norm(l.to)}`, l);
  const out: Record<string, LngLat[]> = {};
  if (!byPair.size) return out;
  for (const m of models) {
    if (!m.pins.length) continue;
    const { morning, night } = dayBases([...bases], m.day);
    const chain: { id: string; keys: string[] }[] = [
      ...(morning ? [{ id: '', keys: [`base:${morning.id}`] }] : []),
      ...m.pins.map((p) => ({ id: `leg:${m.day}:${p.n}`, keys: [...placeKey(p.id), ...p.entryIds] })),
      ...(night ? [{ id: `leg:${m.day}:end`, keys: [`base:${night.id}`] }] : []),
    ];
    for (let i = 1; i < chain.length; i++) {
      const [x, y] = [chain[i - 1]!, chain[i]!];
      for (const a of x.keys) {
        for (const b of y.keys) {
          const fwd = byPair.get(`${m.day}|${a}|${b}`);
          const back = fwd ? null : byPair.get(`${m.day}|${b}|${a}`);
          const leg = fwd ?? back;
          const line = leg?.geometry ? decodePolyline5(leg.geometry) : null;
          if (!line || line.length < 2 || out[y.id]) continue;
          out[y.id] = back ? [...line].reverse() : line;
        }
      }
    }
  }
  return out;
}

/** True when at least one leg carries a geometry: the map then shows the credit. */
export const hasRoutedLegs = (geometry: Record<string, LngLat[]>): boolean => Object.keys(geometry).length > 0;
