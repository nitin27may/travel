// The routed legs of a trip as export lines (TRP2b, Q46): one `route:` line per leg that has a geometry, in day order, named by its two stops.
// The browser joins these to the trip's export model when a KML or GPX is made; nothing is stored in the model, so the page and the API's
// export carry no geometry (P8: a trip page does not grow by its routes). A leg the privacy guard refused has no geometry and so no line.
import type { TripLegs } from '@travel/core/schema/api/index.ts';
import { routedSteps } from '@/components/trips/legGeometry';
import { dayMapOf, pointLookup } from '@/components/trips/mapPins';
import type { TimelineSession } from './timelineState';
import type { ExportLine, TripExport } from './types';

const TITLE_MODE = { drive: 'drive', walk: 'walk' } as const;

/**
 * The routes of the trip as the page shows it (review SHOULD-6, B1). One track per drawn step that a stored leg covers: the SAME join the map
 * uses (`routedSteps`: the day's chain of morning base, pins in timeline order, night base), so the file holds exactly the lines the map
 * draws as routes and never a drive the day does not make. A day with versions exports the chosen version's steps, named by it ("Day 8,
 * Family day: ..."). Legs with an end that is not a pin (the airport legs of a first or last day) are not in the file, as they are not on
 * the map. Without the page's timeline and route there is no way to know the order, so the file has no routes.
 */
export function routeLines(legs: Pick<TripLegs, 'legs'> | null, model: TripExport, session: Pick<TimelineSession, 'timelines' | 'route'> | null = null): ExportLine[] {
  if (!legs || !session?.route) return [];
  const route = session.route;
  const slugs = new Map(model.stops.flatMap((s) => (s.placeSlug ? [[s.id, s.placeSlug] as const] : [])));
  const pointOf = pointLookup(route);
  const maps = session.timelines.map((t) => dayMapOf(t, pointOf));
  const label = new Map(session.timelines.map((t) => [t.day, t.variant.key === 'main' ? null : t.variant.label]));
  const out: ExportLine[] = [];
  for (const s of routedSteps(legs.legs, maps, route.bases, (k) => slugs.get(k) ?? null, pointOf)) {
    out.push({
      ref: `route:${model.slug}:${s.day}:${out.length + 1}`,
      label: `Day ${s.day}${label.get(s.day) ? `, ${label.get(s.day)}` : ''}: ${s.from} to ${s.to} (${TITLE_MODE[s.mode]}, ${s.leg.km} km, ${s.leg.minutes} min)`,
      exportable: true,
      licence: 'ODbL',
      geometry: s.path.map((p) => [p.lng, p.lat]),
    });
  }
  return out;
}
