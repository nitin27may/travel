// STEP2-E6: the person's own trip as files and paper. The removed stop is absent from the print, the calendar and the other files; the added
// place and the notes are present; the privacy scan finds nothing beyond the person's own download rules; the Stops tab rows follow the days.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { privacyHits } from '@travel/core/privacy/detect.ts';
import { nearHome } from '@travel/core/privacy/home.ts';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { TripPrintView } from '@/components/actions/TripPrintView';
import { entryOfRow, noActionsWhy, ownSections, rowJoin } from '@/components/trips/edit/stops/useOwnStops';
import type { CategoryRowModel } from '@/components/trips/model';
import { buildTripPageModel } from '@/components/trips/model';
import { buildTripExport } from '@/lib/export/build.server';
import { tripCsv } from '@/lib/export/csv';
import { buildGpx } from '@/lib/export/gpx';
import { buildKml } from '@/lib/export/kml';
import { ownIcs, ownModel, ownTripOf, stopEntries } from '@/lib/export/own';
import type { TimelineSession } from '@/lib/export/timelineState';
import { getPlace, getTrip } from '@/lib/public';
import { addDays, compact } from '@travel/core/export/dates.ts';
import { copy } from '../trip-edit/helpers';
import { parseIcs } from './helpers';

const SLUG = 'canadian-rockies-2029';
const trip = getTrip(SLUG)!;
const data = buildTripExport(trip);
const page = buildTripPageModel(trip, (s) => { const p = getPlace(s); return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null; }, []);
const profile = trip.schedule!.defaultProfile;
const plain = scheduleTrip(trip.days.map((d) => d.scheduleInput!), profile);

const day = 3;
const visits = (tls: DayTimeline[], n: number) => stopEntries(tls.find((t) => t.day === n)!);
const removed = visits(plain, day).find((e) => e.at?.placeSlug)!;
const second = visits(plain, day).filter((e) => e.at?.placeSlug)[1]!;
const ADDED = 'Test Added Viewpoint';

/** The person's days: the removed stop gone, one place added (from the first visit's shape), as the scheduler would answer. */
const edited: DayTimeline[] = plain.map((t) => {
  const entries = t.entries.filter((e) => e.id !== removed.id);
  if (t.day !== day) return { ...t, entries };
  const base = visits(plain, day)[0]!;
  const add: TimelineEntry = { ...base, id: 'add-test-added-viewpoint', title: ADDED, addedBy: 'visitor', sourceItemId: 'add-test-added-viewpoint', start: '17:00', end: '17:45', durationMin: 45, at: { name: ADDED, placeSlug: 'test-added-viewpoint', point: null } };
  return { ...t, entries: [...entries, add] };
});
const base = (copyToPlanDraft(copy({ slug: SLUG, title: 'Canadian Rockies', start: '2029-09-08', adults: 2, children: [10], overrides: {} })) as { success: true; data: PlanDraft }).data;
// the person's document: the stop removed on Day 3
const draft: PlanDraft = { ...base, template: { ...base.template!, removed: [{ day, item: removed.id, op: 'o-removed-1' }] } };
const NOTE = 'Ask about the parking pass';
const DAYNOTE = 'Leave early for the pass';
const own = ownTripOf({
  doc: draft, slug: SLUG, title: 'Canadian Rockies', ourTitle: 'Canadian Rockies', party: { adults: 2, children: [10] }, days: page.timeline!.days,
  addables: (k) => (k === 'test-added-viewpoint' ? { name: ADDED, kind: 'visit', sub: 'viewpoint', label: 'Viewpoint', placeSlug: k, point: null, durationMin: 45 } : undefined),
});
const withNotes = { ...own, noteOf: (e: TimelineEntry) => (e.id === second.id ? NOTE : ''), dayNote: (n: number) => (n === day ? DAYNOTE : '') };
const session: TimelineSession = { slug: SLUG, profile, defaults: profile, overrides: {}, added: [], timelines: edited, sunPoints: {}, route: page.route };
const model = ownModel(data, session, withNotes);

describe('the own trip model', () => {
  it('has the person\'s stops: the removed one absent, the added one present, in the page\'s order', () => {
    const names = model.stops.map((s) => s.name);
    expect(names).not.toContain(removed.title);
    expect(names).toContain(ADDED);
    const d3 = model.stops.filter((s) => s.day === day);
    expect(d3[d3.length - 1]!.name).toBe(ADDED);
    expect(model.stops.map((s) => s.order)).toEqual(model.stops.map((_, i) => i));
    // the added place has its place page, and a published stop keeps its area and links
    expect(d3.at(-1)!.links[0]).toMatch(/\/places\/test-added-viewpoint\/$/);
  });
  it('names the header the way the spec says', () => {
    expect(own.header).toMatch(/^Your copy of Canadian Rockies · Sat 8 Sep 2029 · 2 adults, 1 child$/);
  });
});

describe('the print view of your own trip', () => {
  const html = renderToStaticMarkup(TripPrintView({ data: model, session, own: withNotes }));
  const text = html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
  it('prints the edited days: the removed stop absent, the added place present, the notes included', () => {
    const sec = html.split('<section').find((s) => s.includes(`Day ${day}:`))!;
    const rows = [...sec.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, ''));
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.some((r) => r.includes(removed.title.replace(/'/g, '&#x27;').replace(/&/g, '&amp;')))).toBe(false);
    expect(sec).toContain(ADDED);
    expect(sec).toContain(`Your note: ${NOTE}`);
    expect(sec).toContain(`Your note on this day: ${DAYNOTE}`);
    expect(html).toContain('Your copy of Canadian Rockies');
  });
  it('prints Bookings after the days (Q305), never Photos or Stops', () => {
    const lastDay = html.lastIndexOf('class="print-model-day"');
    const book = html.indexOf('aria-label="Book ahead"');
    if (data.bookings.length) expect(book).toBeGreaterThan(lastDay);
    expect(text).not.toMatch(/\bPhotos\b/);
    expect(html).not.toContain('Stops');
  });
});

describe('the calendar of your own trip', () => {
  const ics = ownIcs(data, session, withNotes, new Date(Date.UTC(2026, 9, 28)));
  it('carries the added place and the note, and not the removed stop', () => {
    const ev = parseIcs(ics.text).events;
    const titles = ev.map((e) => e.get('SUMMARY'));
    expect(titles).toContain(ADDED);
    expect(titles).not.toContain(removed.title);
    expect(ev.find((e) => e.get('SUMMARY') === second.title)!.get('DESCRIPTION')).toContain(`Your note: ${NOTE}`);
    expect(ev.some((e) => (e.get('UID') ?? '').includes(`-${removed.id}@`))).toBe(false);
    expect(ev.some((e) => e.get('DTSTART') === '20290910')).toBe(true); // Day 3 of a trip starting 8 Sep
  });
  it('counts its events', () => {
    expect(ics.summary).toMatch(/^\d+ all-day events, \d+ timed$/);
  });
});

describe('the other files of your own trip', () => {
  it('CSV, GPX and KML hold the edited stops', () => {
    const csv = tripCsv(model);
    expect(csv).toContain(ADDED);
    expect(csv).not.toContain(removed.title);
    for (const xml of [buildGpx({ title: model.title, url: model.url, waypoints: model.waypoints, lines: model.lines, skipped: model.skipped }).xml, buildKml({ title: model.title, url: model.url, waypoints: model.waypoints, lines: model.lines, skipped: model.skipped }).xml]) {
      expect(xml).not.toContain(removed.title);
    }
  });
});

describe('privacy: no field beyond the person\'s own download rules', () => {
  const html = renderToStaticMarkup(TripPrintView({ data: model, session, own: withNotes }));
  const ics = ownIcs(data, session, withNotes).text;
  const PRIVATE = /height_cm|weight_kg|age_years|citizenship|confirmation|contact|price_paid|insurer|passport|household/i;
  const src = { title: withNotes.routeTitle, url: model.url, waypoints: model.waypoints, lines: model.lines, skipped: model.skipped };
  const gpx = buildGpx(src).xml;
  const kml = buildKml(src).xml;
  it('the print, the calendar, the CSV and the route files pass the scan and name no household field', () => {
    // the calendar is scanned too (review STEP2-ES ES-012: a clock time before a road name is no longer read as an address)
    for (const body of [html.replace(/<[^>]+>/g, ' '), tripCsv(model), JSON.stringify(model), ics, gpx, kml]) {
      expect(privacyHits(body)).toEqual([]);
      expect(body).not.toMatch(PRIVATE);
    }
    // the calendar is dated by the person's own start and holds no other date: every date in it lies inside the trip's days
    const dates = parseIcs(ics).events.flatMap((e) => [e.get('DTSTART'), e.get('DTEND')]).map((v) => (v ?? '').slice(0, 8));
    expect(dates.length).toBeGreaterThan(0);
    const last = compact(addDays('2029-09-08', data.days.length));
    for (const d of dates) expect(d >= '20290908' && d <= last, d).toBe(true);
    // the party is words (no ages), and the children's age is not in any file
    expect(`${html}${ics}${tripCsv(model)}`).not.toMatch(/\b10 years|age 10\b/);
  });
  it('no point of the GPX or the KML is near the home point', () => {
    const pts = [
      ...[...gpx.matchAll(/lat="(-?[\d.]+)" lon="(-?[\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])] as const),
      ...[...kml.matchAll(/<coordinates>([^<]+)<\/coordinates>/g)].flatMap((m) => m[1]!.trim().split(/\s+/).map((c) => c.split(',').map(Number)).map(([lon, lat]) => [lat!, lon!] as const)),
    ];
    expect(pts.length).toBeGreaterThan(10);
    for (const [lat, lon] of pts) expect(nearHome(lat, lon), `${lat},${lon}`).toBe(false);
  });
  it('the route files name the public trip, never the person\'s own title (ES-010)', () => {
    const mine = ownTripOf({ doc: draft, slug: SLUG, title: 'Rockies with Emma and Leo', ourTitle: 'Canadian Rockies, 14 nights', party: { adults: 2, children: [10] }, days: page.timeline!.days, addables: () => undefined });
    expect(mine.routeTitle).toBe('Your copy of Canadian Rockies');
    expect(mine.title).toBe('Rockies with Emma and Leo');
    const files = [buildGpx({ ...src, title: mine.routeTitle }).xml, buildKml({ ...src, title: mine.routeTitle }).xml];
    for (const f of files) {
      expect(f).toContain('Your copy of Canadian Rockies');
      expect(f).not.toContain('Emma');
    }
  });
});

describe('the Stops tab rows follow the days', () => {
  const addable = (k: string) => (k === 'test-added-viewpoint' ? { name: ADDED, kind: 'visit' as const, sub: 'viewpoint', label: 'Viewpoint' } : undefined);
  const before = page.sections.flatMap((s) => s.rows).filter((r) => r.placeSlug);
  const gone = page.sections.flatMap((s) => s.rows).find((r) => r.placeSlug === removed.at!.placeSlug)!;
  it('an untouched trip lists every row it had', () => {
    const same = ownSections(page.sections, plain, addable, () => false);
    expect(same.map((s) => s.count)).toEqual(page.sections.map((s) => s.count));
  });
  it('a removed stop is not listed, an added place is, in its category', () => {
    const on = ownSections(page.sections, edited, addable, own.gone);
    const rows = on.flatMap((s) => s.rows);
    // the removed place may still be on another day (a place visited twice); then it keeps those days only
    const still = edited.some((t) => t.entries.some((e) => e.at?.placeSlug === gone.placeSlug));
    expect(own.gone(gone.placeSlug!)).toBe(true);
    expect(rows.some((r) => r.placeSlug === gone.placeSlug)).toBe(still);
    // every other row stays: the plan lists the places of every version, not only the chosen one
    expect(rows.filter((r) => r.placeSlug && r.placeSlug !== gone.placeSlug && r.placeSlug !== 'test-added-viewpoint').length).toBe(before.filter((r) => r.placeSlug !== gone.placeSlug).length);
    const add = on.find((s) => s.id === 'sights')!.rows.find((r) => r.placeSlug === 'test-added-viewpoint')!;
    expect(add).toMatchObject({ name: ADDED, days: [day] });
    expect(on.find((s) => s.id === 'sights')!.count).toBe(on.find((s) => s.id === 'sights')!.rows.length);
    expect(before.length).toBeGreaterThan(0);
  });
});

describe('the Stops tab rows without a place page, and the tab count', () => {
  const row = (over: Partial<CategoryRowModel>): CategoryRowModel => ({ key: 'k', name: 'Row', kind: 'sight', placeSlug: null, days: [], time: null, area: null, detail: null, nights: null, bookRule: null, bookNote: null, ...over });
  const canEdit = (e: TimelineEntry) => !!e.sourceItemId;
  it('a stay or a logistics row is joined to no day and says why it has no actions', () => {
    const stay = row({ key: 'stay:banff-1', kind: 'stay', name: 'Banff' });
    const logi = row({ key: 'logistics:pass', kind: 'booking', name: 'Parks Canada pass' });
    expect(rowJoin(stay)).toBeNull();
    expect(rowJoin(logi)).toBeNull();
    expect(entryOfRow(stay, plain, canEdit)).toBeNull();
    expect(noActionsWhy(stay)).toMatch(/^Stays follow your dates/);
    expect(noActionsWhy(logi)).toMatch(/^Travel and booking rows/);
  });
  it('a row with no place page is joined to the day stop of the same name; a place on no day has no actions and says so', () => {
    const named = visits(plain, day).find((e) => !e.at?.placeSlug);
    const area = row({ key: `sight:${named?.title}`, name: named?.title ?? 'none' });
    if (named) expect(entryOfRow(area, plain, canEdit)?.e.id).toBe(named.id);
    const absent = row({ key: 'sight:nowhere', name: 'Nowhere in particular' });
    expect(entryOfRow(absent, plain, canEdit)).toBeNull();
    expect(noActionsWhy(absent)).toMatch(/Not a stop on any day/);
  });
  it('the tab count is the rows left: one fewer after a removal, one more after an add', () => {
    const total = (secs: { rows: unknown[] }[]) => secs.reduce((n, s) => n + s.rows.length, 0);
    const none = ownSections(page.sections, plain, addable0, () => false);
    const on = ownSections(page.sections, edited, addable0, own.gone);
    expect(total(none)).toBe(total(page.sections));
    expect(total(on)).toBe(total(none) - (edited.some((t) => t.entries.some((e) => e.at?.placeSlug === removed.at!.placeSlug)) ? 0 : 1) + 1);
  });
});
const addable0 = (k: string) => (k === 'test-added-viewpoint' ? { name: ADDED, kind: 'visit' as const, sub: 'viewpoint', label: 'Viewpoint' } : undefined);
