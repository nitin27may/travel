import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadWorld } from '@travel/core/capture/records.ts';
import { bookingCounts, tripBookings } from '@travel/core/export/bookings.ts';
import { tripPark } from '@travel/core/schema/api/index.ts';
import { attachEntry, tripPlaces, type EntryContext } from '@/lib/public/entry';
import { CATEGORIES, type CategoryItem, type PublicTrip } from '@/lib/public/types';
import { put, scope, scratchRoot } from '../../../core/test/capture/helpers';

// PA-W: the web adapter's half of protected-area entry (spec 6.1 to 6.3). A Rockies-shaped trip over the core fixture parks (the same records
// core/test/parks pins): the park lines, the derived Book ahead rows and what a mapped legacy row becomes. The real trips are in
// booking-refs.test.ts and the built scans.
const FIX = fileURLToPath(new URL('../../../core/test/fixtures/', import.meta.url));
const root = scratchRoot({ 'data/suitability/scope.json': scope([]) });
for (const [dir, lane] of [['graph/valid', 'graph-fixture'], ['parks', 'parks-fixture']] as const) {
  for (const n of readdirSync(join(FIX, dir)).filter((f) => f.endsWith('.json'))) put(root, `data/capture/${lane}/${n}`, JSON.parse(readFileSync(join(FIX, dir, n), 'utf8')));
}
const world = loadWorld(root);

const FOLDER = 'canadian-rockies-sept-2029';
const slugOf = (ref: string): string => ref.replace(/^(?:place|part\/place)\//, '').replace(/#/g, '-');
/** every record with a page is a place page named by its ref; a base is found by its name, like the real adapter does */
const pages = (() => {
  const refBySlug = new Map<string, string>();
  const slugByRef = new Map<string, string>();
  const byName = new Map<string, string[]>();
  for (const [ref, { rec }] of world.cap) {
    if (!/^(?:place|part\/place)\//.test(ref) || ref.startsWith('part/place/') && !/nature\.protected/.test(rec.type)) continue;
    refBySlug.set(slugOf(ref), ref);
    slugByRef.set(ref, slugOf(ref));
    const n = String(rec.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    byName.set(n, [...(byName.get(n) ?? []), slugOf(ref)]);
  }
  return { refBySlug, slugByRef, byCaptureRef: new Map<string, string>([...slugByRef]), byName };
})();

const item = (id: string, slug: string) => ({ id, name: slug, kind: 'sight', subkind: null, category: 'sights', foldedInto: null, placeSlug: slug, time: null, variant: null, durationMin: null, note: null, stats: null, access: null });
const day = (n: number, ...slugs: string[]) => ({ n, title: `Day ${n}`, baseId: null, base: null, driveMin: null, driveIsEstimate: true, summary: null, items: slugs.map((s, i) => item(`${n}-${i}`, s)), tracks: null, scheduleInput: null, variants: [], know: [], summaryProse: null, light: null });
const row = (id: string, name: string, days: number[], note: string | null = null): CategoryItem => ({
  key: `logistics:${id}`, category: 'logistics', name, kind: 'booking', placeSlug: null, days, time: null, areaLabel: null, detail: null, nights: null, bookRule: null, bookNote: note,
});

function trip(): PublicTrip {
  const categories = Object.fromEntries(CATEGORIES.map((c) => [c, [] as CategoryItem[]])) as PublicTrip['categories'];
  categories.logistics = [
    row('pass-discovery', 'Parks Canada Discovery Pass or daily entry', [1, 2], 'For a 2-week trip across 4 parks the annual family pass is likely cheaper.'),
    row('shuttle', 'Parks Canada Lake Louise / Moraine Lake shuttle', [8, 9, 10, 11]),
    row('roam', 'Moraine Lake Road private vehicle ban and Roam options', [11]),
    row('ohara', "Lake O'Hara day-use bus (lottery)", [9]),
    row('kananaskis-pass', 'Kananaskis Conservation Pass', [12, 13, 14, 15]),
    row('lakeshore', 'Lake Louise Lakeshore parking', [10], 'Do not plan to drive to the Lakeshore lot.'),
    row('rental-car', 'Calgary rental car', [1, 15], 'Reserve with free cancellation once lodging is booked.'),
  ];
  return {
    slug: 'canadian-rockies-2029', depth: 'full', season: { months: [9] },
    days: [
      day(3, 'johnston-canyon'), day(4, 'vermilion-lakes'), day(5, 'johnston-canyon'), day(6, 'vermilion-lakes'), day(7, 'maligne-lake'), day(8, 'maligne-lake'),
      day(9, 'yoho-national-park-lake-ohara', 'emerald-lake'), day(10, 'lake-louise'), day(11, 'moraine-lake'), day(12, 'marble-canyon', 'kananaskis-lakes'),
      day(13, 'kananaskis-lakes'), day(14, 'kananaskis-lakes'), day(15, 'kananaskis-lakes'),
    ],
    bases: [
      { id: 'town', name: 'Town hotel', nights: 4, days: [3, 4, 5, 6], point: null },
      { id: 'lodge', name: 'Lake lodge', nights: 2, days: [9, 10, 11], point: null },
    ],
    categories,
  } as unknown as PublicTrip;
}
const ctx = (refs: unknown): EntryContext => {
  put(root, 'data/trips/booking-refs.json', { schema: 'trip-booking-refs/1', trips: { [FOLDER]: refs } });
  return { root, world, pages };
};
const MAP = {
  'pass-discovery': 'offer/operator/parks-canada#discovery-pass',
  shuttle: { ref: 'offer/place/moraine-lake#shuttle-seat', days: [10, 11] },
  roam: 'offer/place/moraine-lake#super-pass',
  ohara: 'offer/place/yoho-national-park#lake-ohara-day-use-bus',
  'kananaskis-pass': 'offer/place/kananaskis-country#conservation-pass',
  lakeshore: 'offer/place/lake-louise#parking',
};

describe('attachEntry: the park lines', () => {
  const t = trip();
  const r = attachEntry([t], ctx(MAP));
  it('fills `parks` with the spec line for Banff and the pass it names, in the order first entered', () => {
    expect(r.missing).toEqual([]);
    const banff = t.parks!.find((p) => p.name === 'Banff National Park')!;
    expect(banff.line).toBe('Banff National Park, days 3 to 6 and 9 to 11: entry fee each day, or the Discovery Pass covers it (also Jasper, Yoho and Kootenay on this trip)');
    expect(banff.slug).toBe('banff-national-park');
    expect(banff.coveredBy).toBe('Discovery Pass');
    expect(t.parks!.map((p) => p.name)[0]).toBe('Banff National Park');
  });
  it('every park is a valid API TripPark and carries no record ref', () => {
    for (const p of t.parks!) expect(tripPark.safeParse(p).success, p.name).toBe(true);
    expect(JSON.stringify(t.parks)).not.toMatch(/"(?:place|part|offer|legacy)\//);
  });
  it('a stop or base with no page is not a visit: the places of a trip are the pages that have a record', () => {
    expect(tripPlaces(trip(), world, pages).stops.every((s) => world.cap.has(s.ref))).toBe(true);
  });
});

describe('attachEntry: the Book ahead rows (6.3)', () => {
  const t = trip();
  attachEntry([t], ctx(MAP));
  const rows = tripBookings(Object.values(t.categories).flat());
  const by = (key: string) => rows.filter((b) => b.ref === key || b.ref.startsWith(`${key}:`));
  it('the Discovery Pass is a pass, bought any time before Day 1', () => {
    expect(by('logistics:pass-discovery')).toMatchObject([{ kind: 'pass', rule: 'Buy any time before Day 1', day: 1 }]);
  });
  it('the shuttle is one row per ridden day, the launch day then the rolling release, each with its own Day N', () => {
    const s = by('logistics:shuttle');
    expect(s.map((b) => [b.ref, b.kind, b.day, b.rule])).toEqual([
      ['logistics:shuttle:d10', 'booking', 10, 'Opens on a launch day each year, usually in April, at 08:00 local; then 2 days before Day 10 at 08:00 local'],
      ['logistics:shuttle:d11', 'booking', 11, 'Opens on a launch day each year, usually in April, at 08:00 local; then 2 days before Day 11 at 08:00 local'],
    ]);
    expect(s[0]!.name).toBe('Parks Canada Lake Louise / Moraine Lake shuttle');
  });
  it('the Roam batch, the Lake O\'Hara lottery and the Kananaskis pass say what their records say', () => {
    expect(by('logistics:roam')[0]).toMatchObject({ kind: 'booking', rule: 'Opens in a monthly batch about 35 days before the month, at 09:00 local' });
    expect(by('logistics:ohara')[0]).toMatchObject({ kind: 'booking', rule: 'Lottery: apply usually in March; seats left after the draw until 15:30 the day before Day 9' });
    expect(by('logistics:kananaskis-pass')[0]).toMatchObject({ kind: 'pass', rule: 'Buy by 23:59 on Day 12' });
  });
  it('lakeshore parking is a check; the rental car (no record) stays as it was', () => {
    expect(by('logistics:lakeshore')[0]).toMatchObject({ kind: 'check' });
    expect(by('logistics:rental-car')[0]).toMatchObject({ kind: 'booking', rule: null });
  });
  it('"N to book ahead" counts booking rows only: passes and checks are listed, never counted', () => {
    expect(bookingCounts(rows)).toMatchObject({ toBook: 5, pass: 2, check: 1 });
  });
  it('a row keeps its legacy key (never a capture ref) and no row carries a record ref or a dated folder', () => {
    expect(JSON.stringify(rows)).not.toMatch(/(?:offer|part)\/|legacy\/|sept-2029/);
  });
  it('a mapped id the trip does not have, or a record that does not exist, is reported and leaves the legacy row alone', () => {
    const t2 = trip();
    const r2 = attachEntry([t2], ctx({ 'no-such-row': 'offer/place/moraine-lake#shuttle-seat', roam: 'offer/place/nowhere#nothing' }));
    expect(r2.missing).toHaveLength(2);
    expect(t2.categories.logistics.some((x) => x.key === 'logistics:roam' && x.bookKind === undefined)).toBe(true);
  });
});
