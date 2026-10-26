// MUST-5: the print view prints what the page shows. Times are the scheduler's for the profile on the page, the version is the chosen one,
// "Lane" never appears, and "Not checked yet" is kept for a missing fact, not for every stop with no time.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import { DEFAULT_PROFILE, type Profile } from '@travel/core/schedule/types.ts';
import { localEntries } from '@/components/trips/timeline/marks';
import { fmtHM } from '@travel/core/schedule/rules.ts';
import { printTime } from '@travel/core/export/plan.ts';
import { TripPrintView, profileLine } from '@/components/actions/TripPrintView';
import { buildTripExport } from '@/lib/export/build.server';
import type { TimelineSession } from '@/lib/export/timelineState';
import { getTrip } from '@/lib/public';

const trip = getTrip('dolomites-2027')!;
const model = buildTripExport(trip);
const profile: Profile = { ...DEFAULT_PROFILE, party: 'family', youngest: 6 };
const session: TimelineSession = {
  slug: trip.slug, profile, defaults: DEFAULT_PROFILE, overrides: {}, added: [],
  timelines: scheduleTrip(trip.days.map((d) => d.scheduleInput!), profile), sunPoints: {},
};
const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('the print view', () => {
  const html = renderToStaticMarkup(TripPrintView({ data: model, session }));
  it('says who the plan is for, as the page says it', () => {
    expect(profileLine(profile)).toBe('Family, 6 · Standard');
    expect(html).toContain('Planned for Family, 6 · Standard');
  });
  it('prints the timeline\'s time for each stop of day 3, in the timeline\'s order', () => {
    const day3 = session.timelines.find((t) => t.day === 3)!.entries.filter((e) => ['visit', 'trail'].includes(e.kind) && !e.insideOf);
    expect(day3.length).toBeGreaterThan(0);
    const section = html.split('<section').find((s) => s.includes('Day 3:'))!;
    const printed = [...section.matchAll(/<li><b>(~?\d\d:\d\d) · <\/b>([^<]+)/g)].map((m) => [m[1], m[2]]);
    expect(printed.map((r) => r[0])).toEqual(day3.map((e) => printTime(e, false)));
    day3.forEach((e, i) => expect(printed[i]![1]).toContain(e.title.replace(/&/g, '&amp;').replace(/'/g, '&#x27;')));
  });
  it('never says Lane, prints no gap marker on a stop, and at most one link per stop', () => {
    expect(html).not.toMatch(/Lane [ABC]/);
    expect(text(html)).not.toMatch(/Not checked yet\|? ?· /);
    for (const li of html.split('<li>').slice(1)) expect((li.match(/class="print-model-link"/g) ?? []).length).toBeLessThanOrEqual(1);
  });
  it('credits the source and no map data it does not print', () => {
    expect(html).toContain('Source: Trip Plans');
    expect(html).not.toContain('OpenStreetMap');
  });
  it('without the page\'s timeline it lists the stops untimed, with no gap marker per stop', () => {
    const plain = renderToStaticMarkup(TripPrintView({ data: model }));
    expect(plain).not.toContain('Planned for');
    expect(plain).toContain('Day 3:');
    expect((plain.match(/Not checked yet/g) ?? []).length).toBeLessThan(3);
  });
});

describe('the print says what the page says (review B2)', () => {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
  const family4: Profile = { ...DEFAULT_PROFILE, party: 'family', youngest: 4 };
  const dolo4 = { ...session, profile: family4, timelines: scheduleTrip(trip.days.map((d) => d.scheduleInput!), family4) };
  const sectionOf = (html: string, day: number) => html.split('<section').find((s) => s.includes(`Day ${day}:`))!;
  it('Dolomites day 3, family-4: each row has the entry\'s own duration, in the page\'s formatter', () => {
    const html = renderToStaticMarkup(TripPrintView({ data: model, session: dolo4 }));
    const sec = sectionOf(html, 3);
    const stops = dolo4.timelines.find((t) => t.day === 3)!.entries.filter((e) => ['visit', 'trail'].includes(e.kind) && !e.insideOf);
    const longest = stops.reduce((a, b) => (b.durationMin > a.durationMin ? b : a));
    expect(longest.durationMin).toBeGreaterThan(240);
    expect(sec).toContain(` · ${fmtHM(longest.durationMin)}`);
    expect(sec).not.toContain('270 min');
    for (const e of stops) if (e.durationMin > 0) expect(sec).toContain(`${esc(e.title)}`);
  });
  it('every suggested time is printed with the page\'s "~", and no fixed time has one', () => {
    for (const s of [session, dolo4]) {
      const html = renderToStaticMarkup(TripPrintView({ data: model, session: s }));
      for (const t of s.timelines) {
        const sec = sectionOf(html, t.day);
        for (const e of t.entries.filter((x) => ['visit', 'trail'].includes(x.kind) && !x.insideOf)) {
          if (t.blocks) continue;
          expect(sec, `${t.day} ${e.title}`).toContain(`<b>${e.time.confidence === 'suggested' ? '~' : e.time.confidence === 'anchored' ? 'about ' : ''}${e.start}${e.tz.length <= 3 ? ` ${e.tz}` : ''} · </b>`);
        }
      }
    }
  });
  it('a time-zone day prints the page\'s local clock with its zone (Rockies day 6, Mount Robson: 07:30 PT)', () => {
    const rt = getTrip('canadian-rockies-2029')!;
    const raw = scheduleTrip(rt.days.map((d) => d.scheduleInput!), profile);
    const day = rt.days.find((d) => d.n === 6)!;
    const zone = day.zone!;
    expect(zone).toBeDefined();
    const display = raw.map((t) => (t.day === 6 ? { ...t, entries: localEntries(t.entries, zone) } : t));
    const rs: TimelineSession = { slug: rt.slug, profile, defaults: DEFAULT_PROFILE, overrides: {}, added: [], timelines: raw, display, sunPoints: {} };
    const sec = sectionOf(renderToStaticMarkup(TripPrintView({ data: buildTripExport(rt), session: rs })), 6);
    expect(sec).toMatch(/~07:30 PT · <\/b>Mount Robson/);
    expect(sec).not.toContain('~08:30');
  });
  it('a timeline note is printed with its stop', () => {
    const withNote = session.timelines.flatMap((t) => t.entries.filter((e) => ['visit', 'trail'].includes(e.kind) && !e.insideOf && e.time.note).map((e) => ({ t, e })))[0];
    expect(withNote).toBeDefined();
    const html = renderToStaticMarkup(TripPrintView({ data: model, session }));
    expect(sectionOf(html, withNote!.t.day)).toContain(esc(withNote!.e.time.note!));
  });
  it('a travel day (Dolomites day 14) prints no "Not checked yet"', () => {
    const html = renderToStaticMarkup(TripPrintView({ data: model, session }));
    const sec = sectionOf(html, 14);
    expect(sec).toContain('Day 14:');
    expect(sec).not.toContain('Not checked yet');
  });
  it('N2: the travel day prints the stretch break and the arrival, with their times, in timeline order', () => {
    const sec = sectionOf(renderToStaticMarkup(TripPrintView({ data: model, session })), 14);
    const tl = session.timelines.find((t) => t.day === 14)!;
    const want = tl.entries.filter((e) => !['start', 'checkout'].includes(e.kind) && !e.insideOf);
    expect(want.some((e) => e.kind === 'break')).toBe(true);
    const printed = [...sec.matchAll(/<li><b>([^<]+) · <\/b>([^<]+)/g)].map((m) => [m[1], m[2]]);
    expect(printed.map((r) => r[0])).toEqual(want.map((e) => printTime(e, tl.blocks)));
    expect(sec).toContain('12:00');
    expect(sec).toContain('At the airport');
    expect(sec).toContain('Stretch break');
    expect(sec.indexOf('Stretch break')).toBeLessThan(sec.indexOf('At the airport'));
  });
  it('MUST-6: the Book ahead section follows the meta line and lists each booking by its dateless rule; a stop shows its own', () => {
    // Dolomites carries dateless rules ("Opens 30 days before Day 3"); the Rockies rows are notes only until BACKLOG 15.223b
    const rm = model;
    expect(rm.bookings.some((b) => b.rule)).toBe(true);
    const withStop = { ...rm, stops: rm.stops.map((s, i) => (i === 0 ? { ...s, bookAhead: 'Opens 30 days before Day 1' } : s)) };
    const html = renderToStaticMarkup(TripPrintView({ data: withStop }));
    const at = html.indexOf('Book ahead</h2>');
    expect(at).toBeGreaterThan(html.indexOf('</p>'));
    expect(at).toBeLessThan(html.indexOf('Day 1:'));
    const book = html.slice(at, html.indexOf('</section>', at));
    for (const b of rm.bookings) expect(book).toContain(b.name.replace(/&/g, '&amp;').replace(/'/g, '&#x27;'));
    expect(book).toMatch(/Opens \d+ days? (before Day \d+|ahead)/);
    expect(text(book)).not.toMatch(/\b(19|20)\d\d\b/);
    expect(html).toContain('Book ahead: Opens 30 days before Day 1'); // under its stop
    expect(renderToStaticMarkup(TripPrintView({ data: { ...rm, bookings: [] } }))).not.toContain('Book ahead');
  });
  it('Rockies family-6: Athabasca Falls has the page\'s 25 min and its note', () => {
    const rt = getTrip('canadian-rockies-2029')!;
    const rm = buildTripExport(rt);
    const rs: TimelineSession = { slug: rt.slug, profile, defaults: DEFAULT_PROFILE, overrides: {}, added: [], timelines: scheduleTrip(rt.days.map((d) => d.scheduleInput!), profile), sunPoints: {} };
    const day = rs.timelines.find((t) => t.entries.some((x) => /Athabasca Falls/.test(x.title) && ['visit', 'trail'].includes(x.kind)))!;
    const e = day.entries.find((x) => /Athabasca Falls/.test(x.title) && ['visit', 'trail'].includes(x.kind))!;
    expect(e.durationMin).toBe(25);
    const sec = sectionOf(renderToStaticMarkup(TripPrintView({ data: rm, session: rs })), day.day);
    expect(sec).toContain(`${esc(e.title)}`);
    expect(sec).toContain(' · 25 min');
    if (e.time.note) expect(sec).toContain(esc(e.time.note));
  });
});
