// The trip export as a timeline shows it (review SHOULD-7, PL2; TRP-GL-C review F2 to F4). One function for every path that writes a trip
// file with times: the browser's Export menu (web/lib/export/plan.ts `forPage`, with the page's chosen profile) and the API (the trip's
// default profile, BACKLOG 15.223a), so the two cannot word a time differently (P9: one data boundary).
//
// With a timeline, a stop or a point that belongs to a version or a plan the timeline does not show is left out, so the counts in the menu
// are the file's own counts. Each kept stop is matched ONE TO ONE to a row of the shown day: a place visited twice in a day (out and back,
// morning and sunset) keeps both rows, and a place that several versions list is one row, as on paper. Each kept stop's time is the
// timeline's time worded as the print words it (`printTime`; the CSV time rule, csv.ts), and `order` is renumbered in the timeline's
// order, which the CSV and the print keep. Bookings are the trip's, not a version's: they stay whole. Without a timeline the model is
// returned as it is. Pure: no browser, no page.
import type { DayTimeline, TimelineEntry } from '../schedule/types.ts';
import type { ExportStop, TripExport } from './types.ts';

/** The days a timeline holds: `display` is the same days with the page's display marks applied (a zone line, a flight-tied "about"). */
export interface ExportTimeline {
  timelines: DayTimeline[];
  display?: DayTimeline[];
}

/**
 * The time as the page words it: "~08:45" for a suggested time (T3: never shown as fixed), "about 08:45" tied to the sun, "07:30 PT" over
 * a time-zone line, the part of the day on a condensed plan ("Morning"). The print view (web/components/actions/TripPrintView.tsx) must
 * say exactly this; web/tests/export/trip-routes.test.ts pins the two until TRP-GL imports this one (review F8).
 */
export function printTime(e: TimelineEntry, blocks: boolean): string | null {
  if (blocks) return e.block ?? null;
  if (e.block) return e.block;
  const clock = e.time.confidence === 'suggested' ? `~${e.start}` : e.time.confidence === 'anchored' ? `about ${e.start}` : e.start;
  return `${clock}${e.tz.length <= 3 ? ` ${e.tz}` : ''}`;
}

/** The place slugs and titles the timeline puts on each day (any entry, inside another or not). */
function placesOf(timelines: readonly DayTimeline[]): Map<number, { slugs: Set<string>; titles: Set<string> }> {
  const by = new Map<number, { slugs: Set<string>; titles: Set<string> }>();
  for (const t of timelines) {
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

type Placed = { s: ExportStop; i: number; own: boolean; at: number; e: TimelineEntry | null };

/** The kinds of entry the print lays out as a row (web/components/actions/TripPrintView.tsx `rowsOf`): a visit and a walk. */
export const PRINTED_KINDS: ReadonlySet<TimelineEntry['kind']> = new Set(['visit', 'trail']);

/**
 * One day's stops matched to the day's rows, one to one. A stop with a place takes the next free row the print prints for that place (a
 * visit or a walk, never the coffee break or the free time the scheduler puts at the same place before it); with none, the first entry at
 * that place of any kind; with no entry at its place at all, the next free row with its name (an airport). The shown version's own copy
 * is served first. A stop whose rows are all taken is a second copy of the same row (another version's or another track's), and is left
 * out; a stop no row names is kept, untimed, after the timed rows.
 */
function matchDay(stops: { s: ExportStop; i: number }[], tl: DayTimeline): Placed[] {
  const rows = tl.entries.map((e, at) => ({ e, at })).filter(({ e }) => !e.insideOf);
  const used = new Set<string>();
  const own = (s: ExportStop) => s.lane === `Lane ${tl.variant.key}`;
  const queue = [...stops].sort((a, b) => Number(own(b.s)) - Number(own(a.s)) || a.i - b.i);
  const out: Placed[] = [];
  for (const { s, i } of queue) {
    const atPlace = s.placeSlug ? rows.filter(({ e }) => e.at?.placeSlug === s.placeSlug) : [];
    const printed = atPlace.filter(({ e }) => PRINTED_KINDS.has(e.kind));
    const pool = printed.length ? printed : atPlace.length ? atPlace.slice(0, 1) : rows.filter(({ e }) => e.title === s.name);
    if (!pool.length) {
      out.push({ s, i, own: own(s), at: Infinity, e: null });
      continue;
    }
    const free = pool.find(({ e }) => !used.has(e.id));
    if (!free) continue;
    used.add(free.e.id);
    out.push({ s, i, own: own(s), at: free.at, e: free.e });
  }
  return out;
}

/** The model as the timeline shows it (see the file header). `null` returns the model unchanged. */
export function forTimeline(model: TripExport, session: ExportTimeline | null): TripExport {
  if (!session) return model;
  const by = placesOf(session.timelines);
  const shown = new Map((session.display ?? session.timelines).map((t) => [t.day, t]));
  const kept = model.stops
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => {
      const day = by.get(s.day);
      return !day || (s.placeSlug ? day.slugs.has(s.placeSlug) : day.titles.has(s.name));
    });
  const days = [...new Set(kept.map(({ s }) => s.day))];
  const placed = days.flatMap((d): Placed[] => {
    const mine = kept.filter(({ s }) => s.day === d);
    const tl = shown.get(d);
    // a day the timeline does not hold keeps its stops as the plan has them, with the plan's own time
    if (!tl) return mine.map(({ s, i }) => ({ s, i, own: false, at: Infinity, e: null }));
    return matchDay(mine, tl).map((p) => ({ ...p, s: { ...p.s, time: p.e ? printTime(p.e, tl.blocks) : null } }));
  });
  // the file's order is the timeline's: day, then the row's place in the day, then the plan's order for a stop the timeline does not hold
  placed.sort((a, b) => a.s.day - b.s.day || a.at - b.at || Number(b.own) - Number(a.own) || a.i - b.i);
  const stops = placed.map(({ s }, order) => ({ ...s, order }));
  // a stop waypoint's id is `<role>:<day>:<place slug>[:th|:pN]`; a base is the trip's, not a day's version
  const waypoints = model.waypoints.filter((w) => {
    if (w.role === 'base' || w.role === 'place' || w.day === null) return true;
    const day = by.get(w.day);
    return !day || day.slugs.has(w.id.split(':')[2] ?? '');
  });
  return { ...model, stops, waypoints };
}
