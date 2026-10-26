// The trip export as the page shows it (review SHOULD-7, PL2): with the page's timeline, a stop or a point that belongs to a version or a plan
// the page is not showing is left out, so the counts in the menu are the file's own counts. Without the timeline the model is whole.
// Each kept stop's time is the page's time for the chosen profile, worded as the print words it (the CSV time rule, core/src/export/csv.ts;
// BACKLOG 15.46), in the timeline's order, once per timeline row (a place that several versions list is one row, as on paper).
// Bookings are the trip's, not a version's: they stay whole, and a stop's own window goes with its stop (MUST-6).
// Pure: the same function can run on the server when the API serves an export (P9).
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';
import { printTime } from '@/components/actions/TripPrintView';
import type { TimelineSession } from './timelineState';
import type { ExportStop, TripExport } from './types';

type PageSession = Pick<TimelineSession, 'timelines'> & Partial<Pick<TimelineSession, 'display'>>;

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

/** The timeline row a stop is: the print's own match (the place), then the title for a stop with no place page (an airport). */
function entryOf(s: ExportStop, tl: DayTimeline): { e: TimelineEntry; at: number } | null {
  const rows = tl.entries.map((e, at) => ({ e, at })).filter(({ e }) => !e.insideOf);
  return (s.placeSlug ? rows.find(({ e }) => e.at?.placeSlug === s.placeSlug) : null) ?? rows.find(({ e }) => e.title === s.name) ?? null;
}

export function forPage(model: TripExport, session: PageSession | null): TripExport {
  if (!session) return model;
  const by = placesOf(session);
  const kept = model.stops.filter((s) => {
    const day = by.get(s.day);
    return !day || (s.placeSlug ? day.slugs.has(s.placeSlug) : day.titles.has(s.name));
  });
  // the time the page shows: the displayed days (zone lines and "about" applied) when the page published them, else the plain timelines
  const shown = new Map((session.display ?? session.timelines).map((t) => [t.day, t]));
  const timed = kept.map((s, i) => {
    const tl = shown.get(s.day);
    if (!tl) return { s, rank: Infinity, i, own: false };
    const hit = entryOf(s, tl);
    // a day with versions lists a place once per version that has it; the shown version's own copy is the one the file keeps
    return { s: { ...s, time: hit ? printTime(hit.e, tl.blocks) : null }, rank: hit?.at ?? Infinity, i, own: s.lane === `Lane ${tl.variant.key}` };
  });
  // the file's order is the page's: day, then the timeline's order, then the plan's order for a stop the timeline does not hold
  timed.sort((a, b) => a.s.day - b.s.day || a.rank - b.rank || Number(b.own) - Number(a.own) || a.i - b.i);
  // one row per row of the page: a place the timeline holds once is one stop, as the print prints it once
  const seen = new Set<string>();
  const once = timed.filter(({ s, rank }) => {
    if (rank === Infinity) return true;
    const k = `${s.day}:${rank}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const stops = once.map(({ s }, order) => ({ ...s, order }));
  // a stop waypoint's id is `<role>:<day>:<place slug>[:th|:pN]`; a base is the trip's, not a day's version
  const waypoints = model.waypoints.filter((w) => {
    if (w.role === 'base' || w.role === 'place' || w.day === null) return true;
    const day = by.get(w.day);
    return !day || day.slugs.has(w.id.split(':')[2] ?? '');
  });
  return { ...model, stops, waypoints };
}
