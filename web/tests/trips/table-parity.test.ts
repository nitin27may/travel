// UXB-5 (spec trip-and-places-ux-fixes 7.4): the Table view says what the CSV and the print say. "Stops only" is the file's rows: same day, same
// time words, same names, in the same order, for the profiles the spec names.
import { describe, expect, it } from 'vitest';
import { forTimeline, PRINTED_KINDS, printTime } from '@travel/core/export/plan.ts';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import { DEFAULT_PROFILE, type Profile } from '@travel/core/schedule/types.ts';
import { buildTripExport } from '@/lib/export/build.server';
import { getTrip } from '@/lib/public';
import { flightEntries, localEntries } from '@/components/trips/timeline/marks';
import { lastStart } from '@/components/trips/timeline/DayTimeline';
import { rowsOf, shownEntries, type RowContext } from '@/components/trips/timeline/tableRows';
import { buildTimelineModel } from '@/components/trips/timeline/model';

const PROFILES: Record<string, Profile> = {
  default: DEFAULT_PROFILE,
  'family-6 relaxed': { ...DEFAULT_PROFILE, party: 'family', youngest: 6, pace: 'relaxed' },
};
const CASES: [string, number][] = [['canadian-rockies-2029', 4], ['dolomites-2027', 3]];

const ctx = (items: RowContext['items'] = new Map()): RowContext => ({ areaOf: () => null, distance: (km) => `${km} km`, elevation: (m) => `${m} m`, lastStart, items });

describe.each(CASES)('%s day %i', (slug, day) => {
  const trip = getTrip(slug)!;
  const model = buildTripExport(trip);
  const tlModel = buildTimelineModel(trip, new Map())!;
  const dayModel = tlModel.days.find((d) => d.n === day)!;
  describe.each(Object.entries(PROFILES))('%s', (_n, profile) => {
    const timelines = scheduleTrip(trip.days.map((d) => d.scheduleInput!), profile);
    // the page's display timeline (a zone line, a flight), as DayTables builds it
    const display = timelines.map((t) => {
      const d = tlModel.days.find((x) => x.n === t.day);
      return { ...t, entries: localEntries(flightEntries(t.entries, d?.flight), d?.zone) };
    });
    const tl = display.find((t) => t.day === day)!;
    const file = forTimeline(model, { timelines, display }).stops.filter((s) => s.day === day);

    it('Stops only is the print\'s rows: a visit or a walk, not inside another, with the entry\'s own title and the print\'s time words', () => {
      const rows = rowsOf(tl, 'stops', ctx());
      const printed = tl.entries.filter((e) => PRINTED_KINDS.has(e.kind) && !e.insideOf);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.map((r) => [r.time, r.name])).toEqual(printed.map((e) => [printTime(e, tl.blocks), e.title]));
    });
    it('every row of the exported file is a row of the table at the same time and in the same order', () => {
      // the file lists a stop by the plan\'s name and leaves out a timeline row that has no stop (an offer such as the Ice Explorer); it never has a row the table lacks
      const times = rowsOf(tl, 'stops', ctx()).map((r) => r.time);
      let at = 0;
      for (const s of file) {
        const hit = times.indexOf(s.time ?? '', at);
        expect(hit, `${s.name} at ${s.time}`).toBeGreaterThanOrEqual(0);
        at = hit + 1;
      }
    });
    it('Everything is the whole timeline in order, and Stops only is a subset of it', () => {
      const all = rowsOf(tl, 'all', ctx());
      expect(all.length).toBe(tl.entries.length);
      const ids = all.map((r) => r.id);
      expect(rowsOf(tl, 'stops', ctx()).every((r) => ids.includes(r.id))).toBe(true);
      expect(shownEntries(tl, 'all')).toBe(tl.entries);
    });
    it('times are the print\'s words: a suggested time has its tilde and no fixed time has one', () => {
      for (const r of rowsOf(tl, 'all', ctx())) {
        const e = tl.entries.find((x) => x.id === r.id)!;
        if (e.block || tl.blocks) continue;
        if (e.time.confidence === 'suggested') expect(r.time).toMatch(/^~\d\d:\d\d/);
        if (e.time.confidence === 'fixed') expect(r.time).toMatch(/^\d\d:\d\d/);
      }
    });
    it('a drive row carries its duration and distance in Takes and is marked as a leg', () => {
      const legs = rowsOf(tl, 'all', ctx()).filter((r) => r.leg);
      expect(legs.length).toBeGreaterThan(0);
      expect(legs.every((r) => /\d+ min|\d+ h/.test(r.takes) && r.quiet)).toBe(true);
    });
  });
  it('the day is named by its model', () => {
    expect(dayModel.title.length).toBeGreaterThan(0);
  });
});
