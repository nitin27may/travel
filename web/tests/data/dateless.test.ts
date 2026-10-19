import { describe, expect, it } from 'vitest';
import { DATE_TEXT, DropLog, relativeSun, sunRange, undated, undatedSentences } from '@/lib/public/dateless';
import { CATEGORIES } from '@/lib/public/types';
import { realData } from './support';

describe('date detection', () => {
  it.each([
    '2027-07-13', 'Tue 15 Jun 2027', 'Opens Tue 15 Jun', 'closes about 13 September', '10-12 Oct', 'Jun 15', 'February 2027', 'Thursday 15', '1st May',
  ])('flags %s', (t) => expect(DATE_TEXT.test(t)).toBe(true));
  it.each([
    'mid-July to end of August', 'observed in 2026: colours peaked in late September', 'Market on Saturdays only', 'Leave by 08:10', 'EUR 40, 2026 price', 'Day 3 of 14', 'Sunrise about 05:30 to 06:00',
  ])('keeps %s', (t) => expect(DATE_TEXT.test(t)).toBe(false));

  it('logs what it drops and keeps the undated sentences', () => {
    const log = new DropLog();
    expect(undated('Opens 15 Jun.', 'x', log)).toBeNull();
    expect(undatedSentences('Walk clockwise. Closed on 8 Oct 2026. Take water.', 'y', log)).toBe('Walk clockwise. Take water.');
    expect(log.items.map((i) => i.where)).toEqual(['x', 'y']);
  });
});

describe('sun times as a season range (core/src/sun)', () => {
  it('turns one day into a range for the season months', () => {
    const range = sunRange(46.69, 12.08, 'Europe/Rome', [7, 8]);
    expect(range).not.toBeNull();
    const out = relativeSun('Sunrise 05:32; alpenglow first', range);
    expect(out).toMatch(/^Sunrise about 0[45]:\d\d to 0[56]:\d\d in this window; alpenglow first$/);
  });
});

const ISO = /\d{4}-\d{2}-\d{2}/;
const d = realData();

function strings(v: unknown, out: string[] = [], key = ''): string[] {
  if (typeof v === 'string') { if (!/^(url|sourceUrl|licenceUrl|file|legacyUrl|slug|key|id|placeSlug|baseId|foldedInto)$/.test(key)) out.push(v); }
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out, key));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) strings(x, out, k);
  return out;
}

describe('public trips are dateless templates', () => {
  it('no trip output carries an ISO date, a weekday plus date, or a day and month', () => {
    const hits: string[] = [];
    // photo captions, authors and credits are Commons metadata, not trip content
    for (const t of d.internals.trips) {
      const { gallery: _g, cover: _c, ...rest } = t;
      void [_g, _c];
      for (const s of strings(rest)) if (ISO.test(s) || DATE_TEXT.test(s)) hits.push(`${t.slug}: ${s.slice(0, 100)}`);
    }
    for (const c of d.listTrips()) for (const s of strings({ ...c, cover: null })) if (ISO.test(s) || DATE_TEXT.test(s)) hits.push(`${c.slug} card: ${s.slice(0, 100)}`);
    expect(hits).toEqual([]);
  });

  it('has no date-valued keys', () => {
    const keys = new Set<string>();
    const walk = (v: unknown) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); } };
    // the timeline's own `start` and `end` are clock times of a day ("07:30"), not trip dates; the string checks above cover their values
    walk(d.internals.trips.map(({ schedule: _s, days, ...t }) => ({ ...t, days: days.map(({ scheduleInput: _i, ...x }) => x) })));
    for (const k of ['date', 'dates', 'start', 'end', 'startDate', 'endDate']) expect(keys.has(k), k).toBe(false);
  });

  it('every public trip has a season, or says the season is not set yet', () => {
    for (const t of d.listTrips()) {
      if (t.season) {
        expect(t.seasonNotSet).toBe(false);
        expect(t.season.months.length).toBeGreaterThan(0);
        expect(t.season.label.length).toBeGreaterThan(0);
      } else expect(t.seasonNotSet).toBe(true);
    }
    expect(d.listTrips().some((t) => t.seasonNotSet)).toBe(true); // the six without research say so
  });

  it('booking windows are rules, never dates', () => {
    const rules = d.getTrip('dolomites-2027')!.categories.logistics.filter((r) => r.bookRule);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].bookRule).toMatchObject({ daysBefore: 30, dayN: 3 });
    expect(CATEGORIES).toContain('logistics');
  });
});
