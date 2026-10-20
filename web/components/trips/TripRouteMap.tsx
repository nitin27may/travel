'use client';

import { forwardRef, useMemo, useState, useSyncExternalStore } from 'react';
import { MapSurface } from '@/components/map/MapSurface';
import { registerPageFamily } from '@/lib/map/registry';
import type { Line, MapHandle, MapSpec, Pin } from '@/lib/map/types';
import type { RouteModel } from './model';

registerPageFamily('/trips/[slug]', 'maplibre');

// The key sits under the map, not on it: an on-map key covered the basemap's labels and, on a phone, the attribution.
const KEY = [
  { id: 'base', label: 'Base for the nights' },
  { id: 'stop', label: 'Stop' },
  { id: 'est', label: 'Straight line, not a route' },
  { id: 'pick', label: 'Numbered: the day shown' },
] as const;

const subscribePhone = (cb: () => void) => {
  const q = window.matchMedia('(max-width: 639px)');
  q.addEventListener('change', cb);
  return () => q.removeEventListener('change', cb);
};

/** Map key: always open from tablet up, one tap to open on a phone. */
export function RouteKey() {
  const phone = useSyncExternalStore(subscribePhone, () => window.matchMedia('(max-width: 639px)').matches, () => false);
  const [asked, setAsked] = useState(false);
  const open = !phone || asked;
  return (
    <div className="trip-map-key" data-print="hide">
      {phone ? (
        <button type="button" className="trip-map-key-toggle" aria-expanded={open} aria-controls="trip-map-key-list" onClick={() => setAsked((v) => !v)}>
          Map key
        </button>
      ) : null}
      <ul id="trip-map-key-list" className="trip-map-key-list" hidden={!open} aria-label="Map key">
        {KEY.map((k) => (
          <li key={k.id}>
            <span className="key-swatch" data-key={k.id} aria-hidden="true" />
            {k.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ids a map fit should cover for one picked day. */
export function dayFitIds(route: RouteModel, n: number): string[] {
  const day = route.days.find((d) => d.n === n);
  const ids = day ? day.points.map((_, i) => `pick:${n}:${i}`) : [];
  if (day && day.points.length > 1) ids.push(`day:${n}`);
  const base = route.bases.find((b) => b.days.includes(n));
  if (base) ids.push(`base:${base.id}`);
  return ids;
}

const cellOf = (p: { lng: number; lat: number }) => `${p.lng.toFixed(4)},${p.lat.toFixed(4)}`;

/**
 * The map for one picked day (or the whole trip). Rules:
 * - A leg is drawn only as a straight, dashed, neutral line, named "Straight line, not a route" in the key: the stored legs hold
 *   minutes and km but no road geometry, so no leg is solid. The solid amber `route-pick` style is for real route geometry only.
 * - Each stop of the picked day is numbered once, in the timeline's order (the route is ordered by `orderRoute`). Two stops on one
 *   spot (a trail and its trailhead place) draw one pin that keeps the first number, so no pin ever reads "2" twice.
 * - A stop with no position gets no pin, no number and no line vertex.
 */
export function routeSpec(route: RouteModel, picked: number | null): MapSpec {
  const pins: Pin[] = route.bases.map((b) => ({ id: `base:${b.id}`, at: { lng: b.lng, lat: b.lat }, style: 'base', label: b.name, days: b.days }));
  const lines: Line[] = [];
  const baseCells = new Set(route.bases.map(cellOf));
  // Cells a numbered pin occupies: other days' dots must not share one, or they merge into a count badge that reads like a number.
  const numbered = new Set<string>();
  const day = route.days.find((d) => d.n === picked);
  day?.points.forEach((p, i) => {
    const c = cellOf(p);
    if (numbered.has(c)) return;
    numbered.add(c);
    pins.push({ id: `pick:${day.n}:${i}`, at: { lng: p.lng, lat: p.lat }, style: 'stop-numbered', number: numbered.size, label: p.name, days: [day.n] });
  });
  const others = new Map<string, { at: { lng: number; lat: number }; days: number[]; key: string }>();
  for (const d of route.days) {
    const base = route.bases.find((b) => b.days.includes(d.n));
    const coords = [...(base ? [{ lng: base.lng, lat: base.lat }] : []), ...d.points.map((p) => ({ lng: p.lng, lat: p.lat }))];
    if (coords.length > 1) lines.push({ id: `day:${d.n}`, coords, style: 'straight-estimate' });
    if (d.n === picked) continue;
    for (const p of d.points) {
      const c = cellOf(p);
      if (numbered.has(c) || baseCells.has(c)) continue;
      const hit = others.get(c);
      if (!hit) others.set(c, { at: { lng: p.lng, lat: p.lat }, days: [d.n], key: p.key });
      else if (!hit.days.includes(d.n)) hit.days.push(d.n);
    }
  }
  for (const s of others.values()) pins.push({ id: `stop:${s.key}`, at: s.at, style: 'stop', days: s.days });
  return { pins, lines, fit: 'all', hideBasemapLabels: ['towns', 'regions'], selectedId: undefined };
}

/** The route map: every day's stops as 6 px dots, bases as signposts, straight estimate lines; the picked day is numbered. */
export const TripRouteMap = forwardRef<MapHandle, { route: RouteModel; picked: number | null; title: string }>(function TripRouteMap({ route, picked, title }, ref) {
  const spec = useMemo(() => routeSpec(route, picked), [route, picked]);
  return <MapSurface ref={ref} spec={spec} label={`Route map of ${title}`} className="trip-map-surface" />;
});
