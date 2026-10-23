// The routed legs of a trip as export lines (TRP2b, Q46): one `route:` line per leg that has a geometry, in day order, named by its two stops.
// The browser joins these to the trip's export model when a KML or GPX is made; nothing is stored in the model, so the page and the API's
// export carry no geometry (P8: a trip page does not grow by its routes). A leg the privacy guard refused has no geometry and so no line.
import type { TripLegs } from '@travel/core/schema/api/index.ts';
import { decodePolyline5 } from '@/lib/map/polyline';
import type { ExportLine, TripExport } from './types';

const TITLE_MODE = { drive: 'drive', walk: 'walk' } as const;

/** The name of a stop key of the trip detail: a day item's id, or `base:<id>`. */
function namer(model: TripExport): (key: string) => string {
  const stops = new Map(model.stops.map((s) => [s.id, s.name]));
  // a base waypoint's id is `base:<day>:<base id>`
  const bases = new Map(model.waypoints.filter((w) => w.role === 'base').map((w) => [w.id.split(':').slice(2).join(':'), w.name]));
  return (key) => (key.startsWith('base:') ? (bases.get(key.slice(5)) ?? 'the base') : (stops.get(key) ?? 'a stop'));
}

export function routeLines(legs: Pick<TripLegs, 'legs'> | null, model: TripExport): ExportLine[] {
  if (!legs) return [];
  const name = namer(model);
  const out: ExportLine[] = [];
  for (const l of legs.legs) {
    const line = l.geometry ? decodePolyline5(l.geometry) : null;
    if (!line || line.length < 2) continue;
    out.push({
      ref: `route:${model.slug}:${l.day}:${out.length + 1}`,
      label: `Day ${l.day}: ${name(l.from)} to ${name(l.to)} (${TITLE_MODE[l.mode]}, ${l.km} km, ${l.minutes} min)`,
      exportable: true,
      licence: 'ODbL',
      geometry: line.map((p) => [p.lng, p.lat]),
    });
  }
  return out;
}
