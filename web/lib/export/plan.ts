// The trip export as the page shows it (review SHOULD-7, PL2): with the page's timeline, a stop or a point that belongs to a version or a plan
// the page is not showing is left out, so the counts in the menu are the file's own counts. Without the timeline the model is whole.
// Pure: the same function can run on the server when the API serves an export (P9).
import type { TimelineSession } from './timelineState';
import type { TripExport } from './types';

/** The place slugs and titles the chosen timeline puts on each day. */
function placesOf(session: Pick<TimelineSession, 'timelines'>): Map<number, { slugs: Set<string>; titles: Set<string> }> {
  const by = new Map<number, { slugs: Set<string>; titles: Set<string> }>();
  for (const t of session.timelines) {
    const slugs = new Set<string>();
    const titles = new Set<string>();
    for (const e of t.entries) {
      if (e.at?.placeSlug) slugs.add(e.at.placeSlug);
      titles.add(e.title);
    }
    by.set(t.day, { slugs, titles });
  }
  return by;
}

export function forPage(model: TripExport, session: Pick<TimelineSession, 'timelines'> | null): TripExport {
  if (!session) return model;
  const by = placesOf(session);
  const stops = model.stops.filter((s) => {
    const day = by.get(s.day);
    return !day || (s.placeSlug ? day.slugs.has(s.placeSlug) : day.titles.has(s.name));
  });
  // a stop waypoint's id is `<role>:<day>:<place slug>[:th|:pN]`; a base is the trip's, not a day's version
  const waypoints = model.waypoints.filter((w) => {
    if (w.role === 'base' || w.role === 'place' || w.day === null) return true;
    const day = by.get(w.day);
    return !day || day.slugs.has(w.id.split(':')[2] ?? '');
  });
  return { ...model, stops, waypoints };
}
