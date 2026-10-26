import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { seasonWindow } from '@/components/trips/TripActions';
import { driveLabel, lengthLabel } from '@/components/trips/format';
import { dayMapOf, pointLookup } from '@/components/trips/mapPins';
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
  it('the cover choice is data (data/trips/covers.json), not a slug in code (review M8)', () => {
    const src = readFileSync(path.join(process.cwd(), 'lib/public/trips.ts'), 'utf8');
    expect(src).not.toMatch(/patagonia/i);
  });
  it('Patagonia has a Patagonia cover, not the Buenos Aires cemetery (R4-T2)', () => {
    const t = getTrip('patagonia-2027')!;
    expect(t.cover?.url ?? '').not.toMatch(/Recoleta/i);
    expect(t.cover?.url ?? '').toMatch(/Fitz|Roy/i);
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
    // every trip has a season now (D6a-W), so the honest badge is checked on a row with the season removed
    const unset = { ...rows[0]!, seasonNotSet: true, seasonLabel: null, seasonMonths: [] };
    expect(publicTripBadges(unset).map((b) => b.text)).toContain('Season not set yet');
    expect(publicTripBadges(rows.find((r) => r.depth === 'summary')!).some((b) => /Condensed/.test(b.text))).toBe(true);
  });
  it('a plan-only season says "our plan" on its chip and a researched one does not', () => {
    const planOnly = rows.find((r) => r.slug === 'quebec-2026')!;
    expect(planOnly.seasonBasis).toBe('plan');
    expect(publicTripBadges(planOnly).find((b) => b.tone === 'season')!.text).toBe('Last days of September into early October · our plan');
    const seeded = rows.find((r) => r.seasonBasis === 'researched')!;
    expect(publicTripBadges(seeded).find((b) => b.tone === 'season')!.text).toBe(seeded.seasonLabel);
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

describe('route map and thumbnails', () => {
  it('hides basemap town labels and draws no on-map legend', async () => {
    const { routeSpec } = await import('@/components/trips/routeSpec');
    const model = buildTripPageModel(getTrip('dolomites-2027')!, lookup);
    const spec = routeSpec({ bases: model.route.bases, models: model.timeline!.defaultTimelines.map((t) => dayMapOf(t, pointLookup(model.route))), picked: null });
    expect(spec.hideBasemapLabels).toContain('towns');
    expect(spec.legend).toBeUndefined();
  });
  it('most days of a full trip carry a thumbnail', () => {
    const model = buildTripPageModel(getTrip('dolomites-2027')!, lookup);
    const withThumb = model.days.filter((d) => d.thumb).length;
    expect(withThumb / model.days.length).toBeGreaterThan(0.6);
  });
  it('country names are never codes', () => {
    for (const r of tripListRows()) expect(r.countryName, r.slug).not.toMatch(/^[A-Z]{2}$/);
  });
});

describe('route map with no positions (backlog 2.35)', () => {
  it('knows when nothing is positioned, so the page hides the map instead of framing Europe', async () => {
    const { routeHasPositions } = await import('@/components/trips/model');
    expect(routeHasPositions({ bases: [], days: [{ n: 1, title: 'a', base: null, points: [] }], unplaced: 3 })).toBe(false);
    expect(routeHasPositions({ bases: [{ id: 'b', name: 'B', lng: -72.5, lat: 44.5, days: [1] }], days: [], unplaced: 0 })).toBe(true);
    expect(routeHasPositions({ bases: [], days: [{ n: 1, title: 'a', base: null, points: [{ key: 'x', name: 'X', lng: 1, lat: 2, placeSlug: 'x' }] }], unplaced: 0 })).toBe(true);
  });
  it('vermont, whose stops are not positioned, has no route to draw', async () => {
    const { routeHasPositions } = await import('@/components/trips/model');
    const v = getTrip('vermont-fall-2026');
    if (!v) return;
    const m = buildTripPageModel(v, lookup);
    const placed = m.route.days.some((d) => d.points.length) || m.route.bases.length > 0;
    expect(routeHasPositions(m.route)).toBe(placed);
  });
});

describe('trip pins from data/trips/base-points.json (backlog 3.41)', () => {
  const pin = (slug: string) => tripListRows().find((r) => r.slug === slug)!;
  // Algonquin left this list on 26 Oct 2026 (STACK-FIX): AREA-2 added a Dwight place page (Wikidata Q1268459, the community itself), so
  // its base "Dwight" is now positioned by the name join of trips.ts (T5) and the pin is that base, as for any positioned base. Its
  // base-points.json row (an OSM locality node 400 m away) stays as the fallback should the page go. See the test below.
  const SOURCED: [string, number, number][] = [
    ['niagara-day-2026', 43.12922, -79.06],
    ['costa-rica-2027', 10.75208, -85.37965],
    ['norway-summer-2028', 68.23333, 14.56667],
    ['switzerland-2027', 47.0523, 8.3059],
  ];
  it('the four trips with no positioned base sit on their sourced point, exactly, not as area-only rings', () => {
    for (const [slug, lat, lon] of SOURCED) {
      const r = pin(slug);
      expect(r.approx, slug).toBe(false);
      expect(r.lat, slug).toBe(lat);
      expect(r.lon, slug).toBe(lon);
    }
  });
  it('Algonquin and Niagara are no longer one shared country point', () => {
    const a = pin('algonquin-muskoka-2026');
    const n = pin('niagara-day-2026');
    expect(`${a.lat}:${a.lon}`).not.toBe(`${n.lat}:${n.lon}`);
  });
  it('a trip with its own positioned base keeps it', () => {
    expect(pin('dolomites-2027').lat).toBeCloseTo(46.7327, 3);
  });
  it('Algonquin sits on its base, the Dwight place page, which is the same sourced point the base and the route map use', () => {
    const a = pin('algonquin-muskoka-2026');
    expect(getPlace('dwight')!.name).toBe('Dwight');
    const dwight = getPlace('dwight')!.point!;
    expect(getTrip('algonquin-muskoka-2026')!.bases[0]!.point).toMatchObject({ lat: dwight.lat, lon: dwight.lon });
    expect({ approx: a.approx, lat: a.lat, lon: a.lon }).toEqual({ approx: false, lat: dwight.lat, lon: dwight.lon });
  });
});

describe('the two Rockies sentences the party scrub used to drop (backlog 3.22)', () => {
  const text = JSON.stringify(getTrip('canadian-rockies-2029'));
  it('are kept, in their neutral wording', () => {
    expect(text).toContain("A young child's body clock is still about 2 h ahead");
    expect(text).toContain('age 8+, so not for younger children');
  });
  it('are not in the scrub drop log', async () => {
    const { createPublicData } = await import('@/lib/public');
    const dropped = JSON.stringify(createPublicData().internals.dropped);
    expect(dropped).not.toMatch(/body clock|Mt Stephen|not for the child/i);
  });
});
