import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { tagChips } from '@/components/trips/tags/chips';
import { hikeLabel, hubBandOf, kidsLabel, lengthLine } from '@/components/trips/tags/labels';
import { tripListRows } from '@/app/trips/rows';
import { createPublicData, listTrips } from '@/lib/public';
import { activitiesTag, activityIdsOf, aroundTag, highlightsTag, hikeEffortTag, hikeTag, kidsFromTag, lengthTag, perDayTag, shapeTag, strollerTag } from '@/lib/public/tags';
import type { DayVariant, ScheduleDayInput, ScheduleItem } from '@travel/core/schedule/types.ts';
import type { PickedItem } from '@/lib/public/tags';
import { fromHubsOf, tagLabels } from '@/lib/public/world';
import type { PublicDay } from '@/lib/public/types';
import { travelRoot } from '@/lib/data/root';

const cards = listTrips();
const rows0 = tripListRows();
const bySlug = (slug: string) => cards.find((c) => c.slug === slug)!;
const day = (n: number, over: Partial<PublicDay> = {}): PublicDay => ({ n, title: '', baseId: null, base: null, driveMin: null, driveIsEstimate: false, summary: null, items: [], tracks: null, scheduleInput: null, variants: [], know: [], summaryProse: null, light: null, ...over });
const titem = (title: string, over: Partial<ScheduleItem> = {}): ScheduleItem => ({
  id: title, kind: 'trail', sub: null, title, placeSlug: null, point: null, rule: null, durationMin: 60, durationRange: null, durationSource: 'plan', stats: { distanceKm: 2, gainM: 50 },
  start: null, needs: null, window: null, checkinMin: null, optional: false, note: null, minAge: null, minAgeRule: null, needsDaylight: false, honesty: [], ...over,
});
const variant = (key: DayVariant['key'], items: ScheduleItem[], over: Partial<DayVariant> = {}): DayVariant => ({ key, label: key, audience: 'any', relation: 'alternative', items, rank: 1, ...over });
const sday = (n: number, variants: DayVariant[]): ScheduleDayInput => ({ day: n, kind: 'normal', tz: 'UTC', base: null, nextBase: null, sunPoint: null, sunWindow: null, variants, legs: [], start: null, origin: null, homeBy: null, splitNote: null });

describe('each tag is a pure function', () => {
  it('length: the short classes, then the 4+ bands', () => {
    expect([0, 1, 2, 3, 5, 12, 20].map(lengthTag)).toEqual(['day', 'overnight', 'weekend', 'long-weekend', '4-8', '9-14', '15+']);
    expect(lengthTag(null)).toBeNull();
  });
  it('hike effort: stroll and easy are easy, hard and technical are strenuous', () => {
    expect(['stroll', 'easy', 'moderate', 'hard', 'technical', 'strenuous', null, 'weird'].map((e) => hikeTag(e))).toEqual(['easy', 'easy', 'moderate', 'strenuous', 'strenuous', 'strenuous', null, null]);
  });
  it('shape: one base, or a road trip from three bases; two bases are neither', () => {
    expect([0, 1, 2, 3, 6].map(shapeTag)).toEqual([null, 'one-base', null, 'road-trip', 'road-trip']);
  });
  it('driving per day: bands from the average of the days that drive, with ≈ when any is estimated', () => {
    expect(perDayTag([day(1, { driveMin: 30 }), day(2, { driveMin: 50 })])).toEqual({ band: 'u1', approx: false });
    expect(perDayTag([day(1, { driveMin: 90, driveIsEstimate: true }), day(2, { driveMin: null })])).toEqual({ band: '1-2', approx: true });
    expect(perDayTag([day(1, { driveMin: 150 })]).band).toBe('2-3');
    expect(perDayTag([day(1, { driveMin: 200 })]).band).toBe('3+');
    expect(perDayTag([day(1, { driveMin: null }), day(2, { driveMin: 0 })])).toEqual({ band: null, approx: false });
  });
  it('getting around: from the logistics rows', () => {
    const row = (name: string, kind = 'booking') => ({ name, kind });
    expect(aroundTag([row('Car hire · Venice airport', 'car'), row('Flight · Toronto to Venice', 'flight')])).toEqual(['rental-car']);
    expect(aroundTag([row('Camper van pickup in Reykjavik')])).toEqual(['camper-van']);
    expect(aroundTag([row('Rack railway to Zermatt'), row('Guided glacier tour')])).toEqual(['tours', 'train']);
    expect(aroundTag([row('Flight to Calgary', 'flight')])).toEqual([]);
  });
  it('stroller days: the easiest variant of each day; friendly when no day has a "no" or a gap, else n of N', () => {
    const days = [sday(1, [variant('main', [titem('A')])]), sday(2, [variant('main', [titem('B')])]), sday(3, [variant('main', [])])];
    expect(strollerTag(days, () => 'yes')).toEqual({ all: true });
    expect(strollerTag(days, (i) => (i.title === 'B' ? 'no' : 'yes'))).toEqual({ all: false, n: 2, of: 3 });
    // a gap never passes: both walking days fail, the day with no walking passes
    expect(strollerTag(days, () => null)).toEqual({ all: false, n: 1, of: 3 });
    expect(strollerTag([sday(1, [variant('main', [titem('A')])])], () => 'no')).toBeNull();
    // the easiest variant is the one written for an easy day, else the lowest rank
    const split = sday(1, [variant('A', [titem('Hard')], { rank: 3 }), variant('C', [titem('Easy')], { rank: 1, audience: 'easy' })]);
    expect(strollerTag([split], (i) => (i.title === 'Hard' ? 'no' : 'yes'))).toEqual({ all: true });
    expect(strollerTag([], () => 'yes')).toBeNull();
  });
  it('kids from N: the lowest age that fits every day on known data; a gap is never a fit', () => {
    const adultsHike = titem('Adults hike', { minAge: 8, minAgeRule: 'plan' });
    const known = () => true;
    const days = [sday(1, [variant('main', [titem('Walk')])]), sday(2, [variant('A', [adultsHike], { rank: 2 }), variant('B', [titem('Family walk')], { rank: 1, audience: 'family' })])];
    expect(kidsFromTag(days, known)).toMatchObject({ age: 0, fitAge: 0 });
    expect(kidsFromTag([sday(1, [variant('main', [adultsHike])])], known)).toMatchObject({ age: 8, decider: 'Adults hike' });
    expect(kidsFromTag([sday(1, [variant('main', [titem('Too old', { minAge: 18, minAgeRule: 'hard' })])])], known).age).toBeNull();
    expect(kidsFromTag([], known).age).toBeNull();
    // a trail whose known effort is above what the age can do is not a fit at that age (FE 4 needs age 10 or more)
    const strenuous = [sday(1, [variant('main', [titem('Steep')])])];
    expect(kidsFromTag(strenuous, known, () => 4).age).toBe(10);
    expect(kidsFromTag(strenuous, known, () => 2).age).toBe(0);
    // the scheduler says age 0 fits, but nothing is known about the second item: no number at all, never 0
    const gap = kidsFromTag(days, (i) => i.title !== 'Family walk' && i.title !== 'Walk');
    expect(gap.age).toBeNull();
    expect(gap.fitAge).toBe(0);
    expect(gap.unknown.map((u) => u.item).sort()).toEqual(['Family walk', 'Walk']);
  });
  it('hike effort: the maximum known family effort in the family variant; an adults-only variant never sets it', () => {
    const days = [
      sday(1, [variant('main', [titem('Easy'), titem('Hard')])]),
      sday(2, [variant('A', [titem('Scramble')], { rank: 3, audience: 'adults' }), variant('B', [titem('Stroll')], { rank: 2, audience: 'family' })]),
      sday(3, [variant('main', [{ ...titem('Visit'), kind: 'visit' }])]),
    ];
    const fe = (m: Record<string, number>) => (i: ScheduleItem) => m[i.title] ?? null;
    expect(hikeEffortTag(days, fe({ Easy: 2, Hard: 4, Scramble: 5, Stroll: 1 }))).toMatchObject({ value: 'strenuous', decider: 'Hard (day 1, variant main, FE 4)' });
    expect(hikeEffortTag(days, fe({ Easy: 2, Hard: 3, Scramble: 5, Stroll: 1 })).value).toBe('moderate');
    expect(hikeEffortTag(days, fe({ Easy: 1, Hard: 2, Scramble: 5 })).value).toBe('easy');
    // a trail with no effort on record is left out and counted, not taken as easy
    expect(hikeEffortTag(days, fe({ Easy: 2 }))).toMatchObject({ value: 'easy', unknown: 2 });
    expect(hikeEffortTag(days, fe({})).value).toBeNull();
  });
});

describe('activities and highlights come from anchors and highlights only', () => {
  const pick = (name: string, type: string, over: Partial<PickedItem> = {}): PickedItem => ({ name, type, draw: 0, day: 1, anchor: true, ...over });
  it('maps a capture type to a canonical tag id', () => {
    expect(activityIdsOf('water.body.lake', 'Moraine Lake')).toEqual(['lake']);
    expect(activityIdsOf('water.falls.waterfall', 'Takakkaw Falls')).toEqual(['waterfall']);
    expect(activityIdsOf('nature.trail.hike', 'Plain of Six Glaciers')).toEqual(['glaciers', 'hiking']);
    expect(activityIdsOf('culture.heritage.landmark', 'Geysir')).toEqual([]);
    expect(activityIdsOf('access.park.lot', 'A lot')).toEqual([]);
  });
  it('a filler adds no tag: only the picks given are read, and every tag id is in tags.json', () => {
    const labels = tagLabels(travelRoot());
    const tags = activitiesTag([pick('Moraine Lake', 'water.body.lake')], (id) => labels.get(id) ?? null);
    expect(tags).toEqual([{ id: 'lake', label: 'Lake' }]);
    for (const c of cards) for (const t of c.tags.activities) expect(labels.has(t.id), `${c.slug} ${t.id}`).toBe(true);
  });
  it('highlights: up to two anchors by draw then day, a route and its payoff counted once', () => {
    const picks = [
      pick('Moraine Lake', 'water.body.lake', { draw: 0, day: 5 }),
      pick('Moraine Lake walk', 'nature.trail.walk', { draw: 0, day: 5 }),
      pick('Icefields Parkway', 'wheels.drive.scenic_drive', { draw: 0, day: 3 }),
      pick('Lake Louise', 'water.body.lake', { draw: 1, day: 1 }),
      pick('Filler', 'nature.trail.hike', { anchor: false }),
    ];
    expect(highlightsTag(picks)).toEqual(['Icefields Parkway', 'Moraine Lake']);
  });
});

describe('the real trips', () => {
  it('Rockies: derived tags, with activities from anchors and highlights', () => {
    const t = bySlug('canadian-rockies-2029').tags;
    expect(t.countries).toEqual(['ca']);
    expect(t.continents).toEqual(['North America']);
    expect(t.length).toBe('9-14');
    expect(t.shape).toBe('road-trip');
    expect(t.around).toContain('rental-car');
    expect(t.activities.map((a) => a.id)).toEqual(expect.arrayContaining(['lake', 'waterfall', 'glaciers', 'hiking']));
    expect(t.highlights).toHaveLength(2);
    expect(t.hike).not.toBeNull();
  });
  it('Dolomites: Italy, nights, kids from the scheduler and highlights', () => {
    const t = bySlug('dolomites-2027').tags;
    expect(t.countries).toEqual(['it']);
    expect(t.continents).toEqual(['Europe']);
    expect(t.kidsFrom).toBeGreaterThanOrEqual(0);
    expect(t.highlights[0]).toBe('Tre Cime di Lavaredo loop');
    expect(t.when).toEqual([7, 8]);
  });
  it('Patagonia: South America, strenuous', () => {
    const t = bySlug('patagonia-2027').tags;
    expect(t.continents).toEqual(['South America']);
    expect(['moderate', 'strenuous']).toContain(t.hike);
    expect(t.activities.map((a) => a.id)).toContain('glaciers');
  });
  it('an overview trip gets Where, Length and When only, and no fake zeros', () => {
    for (const c of cards.filter((x) => x.depth === 'overview')) {
      const t = c.tags;
      expect(t.countries.length, c.slug).toBeGreaterThan(0);
      expect(t.length, c.slug).not.toBeNull();
      expect({ kids: t.kidsFrom, hike: t.hike, stroller: t.stroller, activities: t.activities, highlights: t.highlights, around: t.around, perDay: t.perDay, shape: t.shape }, c.slug).toEqual({ kids: null, hike: null, stroller: null, activities: [], highlights: [], around: [], perDay: null, shape: null });
      const row = tripListRows([c])[0]!;
      expect(tagChips(row).suit, c.slug).toEqual([]);
      expect(tagChips(row).tags.every((x) => ['where', 'length'].includes(x.key)), c.slug).toBe(true);
    }
  });
  it('every card carries a length class that agrees with its nights', () => {
    for (const c of cards) expect(c.lengthClass === null, c.slug).toBe(c.nights === null);
  });
});

describe('Kids from N says what it rests on', () => {
  it('never shows less than the data proves: the plan raised to the fit age when gaps are counted as passes', () => {
    for (const c of cards.filter((x) => x.tags.kidsBasis === 'floor')) expect(c.tags.kidsFrom, c.slug).toBeGreaterThan(0);
    const utah = bySlug('utah-five-parks').tags;
    const dolo = bySlug('dolomites-2027').tags;
    expect(utah.kidsFrom).toBeGreaterThanOrEqual(10);
    expect(dolo.kidsFrom).toBeGreaterThanOrEqual(10);
    expect(utah.kidsBasis).toBe('floor');
  });
  it('the chip, the tooltip and the table cell carry the basis', () => {
    expect(kidsLabel(8, 'plan').text).toBe('Kids from 8 · our plan');
    expect(kidsLabel(10, 'floor').text).toBe('Kids from 10 · checked');
    expect(kidsLabel(0, 'computed').text).toBe('All ages · checked');
    for (const r of rows0.filter((x) => x.ageFit !== null)) {
      const k = tagChips(r).suit.find((c) => c.key === 'kids')!;
      expect(k.label, r.slug).toMatch(/ · (our plan|checked)$/);
      expect(k.aria, r.slug).toContain(kidsLabel(r.ageFit as number, r.kidsBasis).why);
    }
  });
});

describe('the card chips', () => {
  const rows = tripListRows();
  it('at most two suitability chips, and every chip links to the filtered list', () => {
    for (const r of rows) {
      const { suit, tags } = tagChips(r);
      expect(suit.length, r.slug).toBeLessThanOrEqual(2);
      for (const c of [...suit, ...tags]) expect(c.href, `${r.slug} ${c.key}`).toMatch(/^\/trips\/\?[a-z]+=[^&]+$/);
    }
  });
  it('Kids from 7 opens the list for a child of 8 (the nearest standard age at or above)', () => {
    const r = { ...rows[0]!, ageFit: 7, kidsBasis: 'plan' as const, hike: null as null };
    expect(tagChips(r).suit[0]).toMatchObject({ label: 'Kids from 7 · our plan', href: '/trips/?kid=8' });
  });
  it('the mono line says what kind of trip it is', () => {
    const base = rows.find((r) => r.depth === 'full')!;
    expect(lengthLine({ ...base, lengthClass: 'day', nights: 0, days: 1, fromHubMin: 85, fromHubApprox: false })).toBe('Day trip · from Toronto 1 h 25');
    expect(lengthLine({ ...base, lengthClass: 'day', nights: 0, days: 1, fromHubMin: 85, fromHubApprox: true })).toBe('Day trip · from Toronto ≈1 h 25');
    expect(lengthLine({ ...base, lengthClass: 'weekend', nights: 2, days: 3, fromHubMin: null })).toBe('2 nights · a weekend');
    expect(lengthLine({ ...base, lengthClass: 'multi-day', nights: 13, days: 14, fromHubMin: null, region: 'Dolomites' })).toBe('13 nights · 14 days · Dolomites');
  });
});

describe('the hub matrix', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  it('is empty while data/outings/from-hubs.json does not exist', () => {
    expect(cards.every((c) => c.fromHubs.length === 0)).toBe(true);
  });
  it('reads a fixture file, skipping malformed rows', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'hubs-'));
    dirs.push(root);
    mkdirSync(path.join(root, 'data', 'outings'), { recursive: true });
    writeFileSync(path.join(root, 'data', 'outings', 'from-hubs.json'), JSON.stringify({ trips: { 'niagara-day-2026': [{ hub: 'toronto', minutes: 85, km: 130, basis: 'routed', fetched: '2026-10-18' }, { hub: 'toronto', minutes: 'x' }] } }));
    expect(fromHubsOf(root, 'niagara-day-2026')).toEqual([{ hub: 'toronto', minutes: 85, km: 130, basis: 'routed', fetched: '2026-10-18' }]);
    expect(fromHubsOf(root, 'other')).toEqual([]);
  });
  it('bands: under 1 h, 1-2 h, 2-3 h, 3 h and more', () => {
    expect([30, 59, 60, 119, 120, 179, 180, 400].map((m) => hubBandOf(m).n)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('Hike effort says what it rests on, and never undercuts the plan', () => {
  it('shows the plan\'s word when unknown trails could make the known maximum too low', () => {
    for (const c of cards.filter((x) => x.depth !== 'overview' && x.tags.hike)) {
      const t = c.tags;
      expect(['computed', 'plan'], c.slug).toContain(t.hikeBasis);
    }
    const rockies = bySlug('canadian-rockies-2029').tags;
    // 7+ family trails have no effort on record: "easy" computed from the rest must not replace the plan's "moderate"
    expect(rockies.hike).toBe('moderate');
    expect(rockies.hikeBasis).toBe('plan');
  });
  it('the chip carries the same two words as Kids', () => {
    expect(hikeLabel('moderate', 'plan').text).toBe('Hike effort: moderate · our plan');
    expect(hikeLabel('strenuous', 'computed').text).toBe('Hike effort: strenuous · checked');
  });
});

describe('a renamed capture record keeps its trip stop and its trail effort (backlog 3.40)', () => {
  const data = createPublicData();
  const STOP = 'Angels Landing chains view or Scout Lookout';
  const utah = data.getTrip('utah-five-parks')!;
  const stop = utah.days.flatMap((d) => d.items).find((i) => i.name === STOP)!;
  it('the stop still joins its place, now named for what the record covers, by capture ref', () => {
    expect(stop).toBeTruthy();
    expect(stop.placeSlug).not.toBeNull();
    expect(data.getPlace(stop.placeSlug!)?.name).toBe('Scout Lookout (Angels Landing chains view)');
  });
  it('the trail effort survives: the list row keeps its effort and the Hike effort tag still rests on this stop', () => {
    const card = data.listPlaces().find((p) => p.slug === stop.placeSlug)!;
    expect(card.bands.effort).not.toBeNull();
    const report = data.internals.tagReport.find((r) => r.trip === 'utah-five-parks' && r.field === 'hike')!;
    expect(report.computed).toBe('moderate');
    expect(report.decider).toContain(STOP);
    expect(bySlug('utah-five-parks').tags.hikeBasis).toBe('computed');
  });
  it('a stop that is not listed in data/trips/stop-refs.json still joins by name', () => {
    const named = utah.days.flatMap((d) => d.items).find((i) => i.name === 'Riverside Walk')!;
    expect(named.placeSlug).not.toBeNull();
  });
});
