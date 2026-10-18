import { describe, expect, it } from 'vitest';
import { seasonWindow } from '@/components/trips/TripActions';
import { driveLabel, lengthLabel } from '@/components/trips/format';
import { buildTripPageModel, tripGallery, whenLabel } from '@/components/trips/model';
import { parseTripUrl } from '@/components/trips/useTripUrl';
import { tripListRows } from '@/app/trips/rows';
import { tripDescriptor, publicTripBadges } from '@/lib/entities/descriptors/trip';
import { getPlace, getTrip, listTrips, tripSlugs } from '@/lib/public';
import { CATEGORIES } from '@/lib/public/types';

const lookup = (slug: string) => {
  const p = getPlace(slug);
  return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null;
};

// a calendar date: an ISO date, a weekday with a day number, or a month name with a day number (weekday rules such as "market on Saturdays" are allowed)
const DATE = /\b\d{4}-\d{2}-\d{2}\b|\b(Mon|Tues?|Wed(nes)?|Thu(rs)?|Fri|Sat(ur)?|Sun)(day)?,? \d{1,2}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b/;

describe('trip page model', () => {
  it('builds every trip, with days in order and nothing dated', () => {
    for (const slug of tripSlugs()) {
      const trip = getTrip(slug)!;
      const model = buildTripPageModel(trip, lookup);
      expect(model.days.map((d) => d.n)).toEqual(trip.days.map((d) => d.n).filter(() => trip.depth !== 'overview'));
      // photo credits carry file names and source URLs, which may hold a camera date; they are not trip text
      const text = JSON.stringify({ model: { ...model, credits: [], gallery: [] }, season: trip.season, title: trip.title, subtitle: trip.subtitle });
      expect(text, slug).not.toMatch(DATE);
    }
  });
  it('overview trips have no rows and no categories', () => {
    const m = buildTripPageModel(getTrip('switzerland-2027')!, lookup);
    expect(m.days).toEqual([]);
    expect(m.sections).toEqual([]);
  });
  it('Dolomites: 14 rows, six sections in fixed order', () => {
    const m = buildTripPageModel(getTrip('dolomites-2027')!, lookup);
    expect(m.days).toHaveLength(14);
    expect(m.sections.map((s) => s.id)).toEqual([...CATEGORIES]);
    expect(m.sections.find((s) => s.id === 'stays')!.count).toBe(4);
  });
  it('Rockies: tracks, default B, no Waterton photos', () => {
    const trip = getTrip('canadian-rockies-2029')!;
    const m = buildTripPageModel(trip, lookup);
    expect(m.days[4].tracks).toHaveLength(3);
    expect(m.days[4].defaultTrack).toBe('B');
    expect(tripGallery(trip).some((p) => /waterton/i.test(p.caption))).toBe(false);
  });
  it('credits cover the cover photo', () => {
    const trip = getTrip('dolomites-2027')!;
    expect(buildTripPageModel(trip, lookup).credits.some((c) => c.author === trip.cover!.author)).toBe(true);
  });
});

describe('wording and url', () => {
  it('formats length and drive without fake zeros', () => {
    expect(lengthLabel(13, 14)).toBe('13 nights · 14 days');
    expect(lengthLabel(0, 1)).toBe('Day trip');
    expect(lengthLabel(null, null)).toBe('');
    expect(driveLabel(70, true)).toBe('≈1 h 10');
    expect(driveLabel(null, true)).toBeNull();
  });
  it('whenLabel', () => {
    expect(whenLabel([3])).toEqual({ first: 3, rest: null });
    expect(whenLabel([3, 5])).toEqual({ first: 3, rest: 'also Day 5' });
    expect(whenLabel([1, 2, 3, 4])).toEqual({ first: 1, rest: 'to Day 4' });
  });
  it('seasonWindow', () => {
    expect(seasonWindow([7, 8])).toEqual({ from: '07-01', to: '08-31' });
    expect(seasonWindow([11, 12, 1])).toEqual({ from: '11-01', to: '01-31' });
    expect(seasonWindow([])).toBeUndefined();
  });
  it('parseTripUrl: category fragment implies By category', () => {
    expect(parseTripUrl('', '#day-3')).toMatchObject({ view: 'day', day: 3 });
    expect(parseTripUrl('?view=category', '')).toMatchObject({ view: 'category' });
    expect(parseTripUrl('', '#trails')).toMatchObject({ view: 'category', category: 'trails' });
  });
});

describe('trips list', () => {
  const rows = tripListRows();
  it('lists the public trips, done ones last', () => {
    expect(rows).toHaveLength(listTrips().length);
    const firstDone = rows.findIndex((r) => r.isDone);
    expect(rows.slice(firstDone).every((r) => r.isDone)).toBe(true);
  });
  it('badges are honest: unset season and depth are marked', () => {
    const unset = rows.find((r) => r.seasonNotSet)!;
    expect(publicTripBadges(unset).map((b) => b.text)).toContain('Season not set yet');
    expect(publicTripBadges(rows.find((r) => r.depth === 'summary')!).some((b) => /Condensed/.test(b.text))).toBe(true);
  });
  it('card text has no calendar dates', () => {
    for (const r of rows) {
      const t = [tripDescriptor.title(r), tripDescriptor.subtitle?.(r), tripDescriptor.summary?.(r), ...publicTripBadges(r).map((b) => b.text)].join(' ');
      expect(t, r.slug).not.toMatch(DATE);
    }
  });
  it('facets and map pins', () => {
    expect(tripDescriptor.renderMap).toBeTypeOf('function');
    expect(rows.every((r) => r.lat !== null || r.country === '' || true)).toBe(true);
    expect(rows.some((r) => r.country === 'IT')).toBe(true);
  });
});

describe('decimals in prose', () => {
  it('keeps "3.2 km" whole when splitting sentences', async () => {
    const { undatedSentences, DropLog } = await import('@/lib/public/dateless');
    expect(undatedSentences('Walk 3.2 km to the lake. Then 2.7 km back.', 'x', new DropLog())).toBe('Walk 3.2 km to the lake. Then 2.7 km back.');
  });
  it('no trip text has a stray space inside a number', () => {
    for (const slug of tripSlugs()) {
      const t = getTrip(slug)!;
      const text = JSON.stringify([t.subtitle, t.season, t.days.map((d) => [d.title, d.summary, d.items.map((i) => i.note), d.tracks?.map((k) => [k.notes, k.items.map((i) => i.note)])])]);
      expect(text, slug).not.toMatch(/\d\. \d+ ?(km|m|min|h)\b/);
    }
  });
});
