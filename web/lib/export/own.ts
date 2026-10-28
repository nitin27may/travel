// The person's own trip as files and paper (STEP2-E6; edit-mode-spec 14). Everything is built on the device from the timelines the page shows
// for the person's document (the session the trip page publishes): a stop the person removed is not in them, a place they added is, a stop they
// moved is on its new day. The published export model supplies only what the timeline cannot (a stop's area, links, licensed point, book-ahead
// line); no call is made with the person's data. Loaded on demand (the shell's publish, the export menu), never in the page's start code.
import { buildIcs, icsEventCount, NoCalendarError } from '@travel/core/export/ics.ts';
import { PRINTED_KINDS, printTime } from '@travel/core/export/plan.ts';
import { partyShortText } from '@travel/core/trips/partyWords.ts';
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { dayNoteKey } from '@/components/trips/edit/day/dayOps';
import { categoryOf } from '@/lib/public/taxonomy';
import { noteKeyOf } from '@/lib/trip-edit/stopOps';
import { formatDate } from './dates';
import { fileName, saveFile } from './download';
import { nameKey, placeKindOf, type OwnAddable, type OwnTrip } from './ownState';
import type { TimelineSession } from './timelineState';
import type { ExportDay, ExportStop, ExportWaypoint, TripExport } from './types';

export { NoCalendarError };

/** The own trip for the document: its notes, its header line, the places it added. Pure. */
export function ownTripOf(a: {
  doc: PlanDraft;
  slug: string;
  title: string;
  ourTitle: string | null;
  party: { adults: number; children: number[] };
  /** The published days with the items of each version: a removed stop is found here by its id. */
  days: readonly { n: number; input: { variants: readonly { items: readonly { id: string; title?: string; placeSlug?: string | null }[] }[] } }[];
  addables: (placeSlug: string) => OwnAddable | undefined;
}): OwnTrip {
  const { doc } = a;
  const copy = !!doc.template;
  // the catalogue names a trip with its length ("Canadian Rockies, 14 nights"); the header says the trip's name
  const ours = a.ourTitle?.replace(/,\s*\d+ nights?$/, '') ?? null;
  const lead = copy ? (ours ? `Your copy of ${ours}` : 'Your copy') : 'Your trip';
  const gone = new Set<string>();
  const goneNames = new Set<string>();
  const slugsOf = (n: number | string): string[] => {
    const day = typeof n === 'number' ? a.days.find((d) => d.n === n) : undefined;
    return day ? day.input.variants.flatMap((v) => v.items.flatMap((it) => (it.placeSlug ? [it.placeSlug] : []))) : [];
  };
  const namesOf = (n: number | string): string[] => {
    const day = typeof n === 'number' ? a.days.find((d) => d.n === n) : undefined;
    return day ? day.input.variants.flatMap((v) => v.items.flatMap((it) => (!it.placeSlug && it.title ? [nameKey(it.title)] : []))) : [];
  };
  for (const r of doc.template?.removed ?? []) {
    const day = a.days.find((d) => d.n === r.day);
    for (const v of day?.input.variants ?? []) for (const it of v.items) if (it.id === r.item) { if (it.placeSlug) gone.add(it.placeSlug); else if (it.title) goneNames.add(nameKey(it.title)); }
  }
  // a dropped day takes its stops with it unless they moved to another day (then a day still holds them and they are listed)
  for (const x of doc.template?.days ?? []) if (x.kind === 'drop') {
    for (const slug of slugsOf(x.day)) gone.add(slug);
    for (const k of namesOf(x.day)) goneNames.add(k);
  }
  const header = [lead, doc.start ? formatDate(doc.start) : null, partyShortText(a.party)].filter(Boolean).join(' · ');
  return {
    slug: a.slug,
    title: a.title,
    header,
    routeTitle: lead,
    start: doc.start ?? null,
    gone: (slug) => gone.has(slug),
    goneName: (k) => goneNames.has(k),
    noteOf: (e) => (copy ? (doc.template!.notes[noteKeyOf(doc, e)] ?? '') : ''),
    dayNote: (n) => (copy ? (doc.template!.notes[dayNoteKey(doc, n)] ?? '') : ''),
    addable: a.addables,
  };
}

/** The rows a day prints and exports: its visits and walks, or on a day with none its travel (every entry but the start and the check-out). */
export function stopEntries(tl: DayTimeline): TimelineEntry[] {
  const own = tl.entries.filter((e) => !e.insideOf);
  const visits = own.filter((e) => PRINTED_KINDS.has(e.kind));
  return visits.length ? visits : own.filter((e) => e.kind !== 'start' && e.kind !== 'checkout');
}

const originOf = (url: string): string => {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
};

/**
 * The export model of the person's trip: days, stops and waypoints from the timelines on the page, in the page's order and with its words
 * for time. The published model's stop is joined by place (same day first) for the facts the timeline lacks; a place with no published
 * stop (one the person added) gets its name, its kind and its place page from the add list, and no point when the add list has no licensed one.
 */
export function ownModel(data: TripExport, session: Pick<TimelineSession, 'timelines' | 'display' | 'route'>, own: OwnTrip): TripExport {
  const tls = [...(session.display ?? session.timelines)].sort((x, y) => x.day - y.day);
  const origin = originOf(data.url);
  const pool = data.stops.map((s) => ({ s, used: false }));
  const take = (slug: string | null, day: number): ExportStop | null => {
    if (!slug) return null;
    const free = pool.filter((p) => !p.used && p.s.placeSlug === slug);
    const hit = free.find((p) => p.s.day === day) ?? free[0];
    if (!hit) return null;
    hit.used = true;
    return hit.s;
  };
  const routeDays = new Map((session.route?.days ?? []).map((d) => [d.n, d]));
  const days: ExportDay[] = tls.map((t) => {
    const r = routeDays.get(t.day);
    const pub = data.days.find((d) => d.n === t.day);
    return { n: t.day, title: r?.title ?? pub?.title ?? '', base: r ? r.base : (pub?.base ?? null) };
  });
  const stops: ExportStop[] = [];
  for (const tl of tls) {
    for (const e of stopEntries(tl)) {
      const slug = e.at?.placeSlug ?? null;
      const src = take(slug, tl.day);
      const add = slug && !src ? own.addable(slug) : undefined;
      const mine = own.noteOf(e);
      const kind = src?.kind ?? (add ? placeKindOf(add) : e.kind);
      stops.push({
        day: tl.day,
        order: stops.length,
        id: e.id,
        name: /^Drive on to /.test(e.title) ? 'Drive on' : e.title,
        kind,
        category: src?.category ?? categoryOf(kind as Parameters<typeof categoryOf>[0]) ?? null,
        area: src?.area ?? null,
        time: printTime(e, tl.blocks),
        durationMin: e.durationMin > 0 ? e.durationMin : null,
        lane: src?.lane ?? null,
        note: mine || e.time.note || src?.note || null,
        placeSlug: slug,
        links: src?.links ?? (slug && origin ? [`${origin}/places/${slug}/`] : []),
        point: src?.point ?? null,
        ...(src?.bookAhead ? { bookAhead: src.bookAhead } : {}),
      });
    }
  }
  // the stops are the page's; a trailhead or a car park stays when its stop does, a base and a place page point are the trip's own
  const slugs = new Set(stops.flatMap((s) => (s.placeSlug ? [s.placeSlug] : [])));
  const rebuilt: ExportWaypoint[] = stops.flatMap((s) =>
    s.point && s.placeSlug
      ? [{ id: `stop:${s.day}:${s.placeSlug}`, name: s.name, kind: s.kind, role: 'stop' as const, day: s.day, note: null, url: s.links[0] ?? null, point: s.point }]
      : [],
  );
  const kept = data.waypoints.filter((w) => w.role === 'base' || w.role === 'place' || w.day === null || ((w.role === 'trailhead' || w.role === 'parking') && slugs.has(w.id.split(':')[2] ?? '')));
  const seen = new Set<string>();
  const waypoints = [...kept, ...rebuilt].filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true)));
  return { ...data, title: own.title, days, stops, waypoints, nights: days.length === data.days.length ? data.nights : Math.max(0, days.length - 1) };
}

/** The days the calendar file carries: the page's timelines, each stop's own note added to its event. */
export function ownTimelines(session: Pick<TimelineSession, 'timelines'>, own: OwnTrip): DayTimeline[] {
  return session.timelines.map((t) => ({
    ...t,
    entries: t.entries.map((e) => {
      const note = own.noteOf(e);
      return note ? { ...e, time: { ...e.time, note: [e.time.note, `Your note: ${note}`].filter(Boolean).join('. ') } } : e;
    }),
  }));
}

/** The ICS text of the edited trip and what it holds, for the toast and the menu. Throws NoCalendarError for an overview and Error when the trip is undated. */
export function ownIcs(data: TripExport, session: Pick<TimelineSession, 'timelines' | 'display' | 'route' | 'sunPoints'>, own: OwnTrip, now: Date = new Date()): { text: string; summary: string } {
  if (!own.start) throw new Error('The trip has no start date');
  const model = ownModel(data, session, own);
  const timeline = { timelines: ownTimelines(session, own), sunPoints: session.sunPoints, full: false };
  const c = icsEventCount(model, timeline);
  return { text: buildIcs(model, own.start, now, timeline), summary: `${c.allDay} all-day events${c.timed ? `, ${c.timed} timed` : ''}` };
}

/** Saves the calendar file of the person's trip. */
export function downloadOwnIcs(data: TripExport, session: Parameters<typeof ownIcs>[1], own: OwnTrip): { name: string; summary: string } {
  const r = ownIcs(data, session, own);
  const name = fileName(data.slug, 'ics');
  saveFile(name, 'ics', r.text);
  return { name, summary: r.summary };
}
