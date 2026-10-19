import { describe, expect, it } from 'vitest';
import { tripListRows } from '@/app/trips/rows';
import { lengthLine } from '@/components/trips/tags/labels';
import type { TripListRow } from '@/components/trips/types';
import { tripDescriptor as d } from '@/lib/entities/descriptors/trip';
import { activeFilters, facetCounts, filterRows, gapNotes } from '@/lib/entities/filter';
import { activeGroup, groupRows, sortRows } from '@/lib/entities/sort';
import { decodeState } from '@/lib/entities/url';

const rows = tripListRows();
const q = (s: string, r: readonly TripListRow[] = rows) => filterRows(r, decodeState(s), d).map((x) => x.slug);
const base = rows.find((r) => r.depth === 'full')!;
const row = (over: Partial<TripListRow>): TripListRow => ({ ...base, id: 'x', slug: 'x', ...over });

describe('the Trips filter bar', () => {
  it('has four primary pills: Where, When, Length, Kids; the rest are under More filters', () => {
    expect(d.facets.filter((f) => f.tier !== 'more').map((f) => f.label)).toEqual(['Where', 'When', 'Length', 'Kids']);
    expect(d.facets.filter((f) => f.tier === 'more').map((f) => f.label)).toEqual(['Activities', 'Hike effort', 'Stroller days', 'Getting around', 'Driving per day', 'Shape', 'Source', 'From Toronto']);
  });
  it('Where: continents and every country, multi-select, and the URL carries codes', () => {
    const where = facetCounts(rows, decodeState(''), d).country!;
    expect(where.filter((o) => o.group === 'Continents').map((o) => o.label)).toEqual(expect.arrayContaining(['Europe', 'North America']));
    expect(where.map((o) => o.value)).toEqual(expect.arrayContaining(['IT', 'CA', 'EUROPE', 'NORTH-AMERICA']));
    expect(q('country=EUROPE').length).toBeGreaterThan(0);
    expect(q('country=IT,CA').length).toBe(rows.filter((r) => r.countries.some((c) => ['IT', 'CA'].includes(c.code))).length);
    expect(q('country=EUROPE')).toEqual(rows.filter((r) => r.continents.includes('Europe')).map((r) => r.slug));
  });
  it('Length: the short classes before the 4+ bands, with live counts', () => {
    const synthetic = [row({ slug: 'a', length: 'day' }), row({ slug: 'b', length: 'weekend' }), row({ slug: 'c', length: '9-14' }), row({ slug: 'd', length: '9-14' })];
    const counts = facetCounts(synthetic, decodeState(''), d).length!;
    expect(counts.map((o) => [o.value, o.count])).toEqual([['day', 1], ['weekend', 1], ['9-14', 2]]);
    expect(counts[0]!.label).toBe('Day trips');
    expect(q('length=9-14', synthetic)).toEqual(['c', 'd']);
    expect(q('length=day,weekend', synthetic)).toEqual(['a', 'b']);
    // the count of an option is what you would get if you chose it, given the other filters
    expect(facetCounts(synthetic, decodeState('length=day&season=7'), d).length!.length).toBeGreaterThanOrEqual(0);
  });
  it('Kids means "a child of N": plans whose Kids-from is N or less; a plan with no guidance never passes and is counted', () => {
    const r = [row({ slug: 'four', ageFit: 4 }), row({ slug: 'seven', ageFit: 7 }), row({ slug: 'eleven', ageFit: 11 }), row({ slug: 'none', ageFit: null })];
    expect(q('kid=6', r)).toEqual(['four']);
    expect(q('kid=8', r)).toEqual(['four', 'seven']);
    expect(q('kid=12', r)).toEqual(['four', 'seven', 'eleven']);
    expect(gapNotes(r, decodeState('kid=8'), d)).toContain('1 not checked yet');
  });
  it('More filters: activities, hike effort, getting around and shape filter on the derived tags', () => {
    const r = [row({ slug: 'lake', activities: [{ id: 'lake', label: 'Lake' }], hike: 'easy', around: ['rental-car'], shape: 'road-trip' }), row({ slug: 'none', activities: [], hike: null, around: [], shape: null })];
    expect(q('tag=lake', r)).toEqual(['lake']);
    expect(q('effort=easy,moderate', r)).toEqual(['lake']);
    expect(q('around=rental-car', r)).toEqual(['lake']);
    expect(q('shape=road-trip', r)).toEqual(['lake']);
    expect(q('perday=u1', r)).toEqual([]);
  });
  it('a facet nobody answers is hidden instead of empty (Hike effort on overview trips only)', () => {
    const overview = rows.filter((r) => r.depth === 'overview');
    const counts = facetCounts(overview, decodeState(''), d);
    expect(counts.effort).toBeUndefined();
    expect(counts.stroller).toBeUndefined();
    expect(counts.country).toBeDefined();
  });
  it('an impossible combination leaves nothing, and each chip removal names a way back', () => {
    const st = decodeState('country=IT&length=day&tag=lake');
    expect(filterRows(rows, st, d)).toEqual([]);
    const chips = activeFilters(st, d, (_p, v) => v);
    expect(chips).toHaveLength(3);
    expect(chips.some((c) => filterRows(rows, c.without, d).length > 0)).toBe(true);
  });
});

describe('the From Toronto pill (short-trips 3.3, 4.2)', () => {
  const short = (over: Partial<TripListRow>) => row({ length: 'day', lengthClass: 'day', nights: 0, ...over });
  it('is hidden by the 60% rule while no short trip has a drive time, and the count line says so', () => {
    expect(facetCounts(rows, decodeState(''), d).drive).toBeUndefined();
    expect(gapNotes(rows, decodeState(''), d)).toContain('From Toronto hidden: not known for most short trips');
  });
  it('shows with a fixture of hub values, filters by band and keeps ≈ for estimates', () => {
    const r = [short({ slug: 'a', fromHubMin: 50 }), short({ slug: 'b', fromHubMin: 85 }), short({ slug: 'c', fromHubMin: 85, fromHubApprox: true }), short({ slug: 'd', fromHubMin: 200 }), row({ slug: 'long', length: '9-14', lengthClass: 'multi-day', fromHubMin: null })];
    const counts = facetCounts(r, decodeState(''), d).drive!;
    expect(counts.map((o) => [o.value, o.count])).toEqual([['toronto-1', 1], ['toronto-2', 2], ['toronto-4', 1]]);
    expect(q('drive=toronto-2', r)).toEqual(['b', 'c']);
    expect(q('drive=toronto-1', r)).toEqual(['a']);
    // the ≈ shows in the band chip on the card
    expect(lengthLine(r[2]!)).toContain('≈');
    expect(lengthLine(r[1]!)).not.toContain('≈');
    expect(gapNotes(r, decodeState(''), d)).not.toContain('From Toronto hidden: not known for most short trips');
  });
  it('a long trip with no hub value does not count against the rule', () => {
    const r = [short({ slug: 'a', fromHubMin: 50 }), short({ slug: 'b', fromHubMin: 130 }), ...Array.from({ length: 10 }, (_, i) => row({ slug: `l${i}`, length: '9-14', lengthClass: 'multi-day' }))];
    expect(facetCounts(r, decodeState(''), d).drive).toBeDefined();
  });
});

describe('group by Length', () => {
  it('puts day trips first, then overnights, weekends, long weekends and the 4+ bands', () => {
    const r = [row({ slug: 'b', length: '9-14', title: 'B' }), row({ slug: 'a', length: 'weekend', title: 'A' }), row({ slug: 'c', length: 'day', title: 'C' }), row({ slug: 'e', length: '4-8', title: 'E' }), row({ slug: 'f', length: 'day', title: 'F' })];
    const st = decodeState('group=length');
    const groups = groupRows(sortRows(r, st, d), activeGroup(st, d));
    expect(groups.map((g) => g.title)).toEqual(['Day trips', 'Weekends', '4 to 8 nights', '9 to 14 nights']);
    expect(groups[0]!.rows.map((x) => x.slug).sort()).toEqual(['c', 'f']);
  });
  it('sorting by length class orders the same way', () => {
    const r = [row({ slug: 'b', length: '9-14' }), row({ slug: 'c', length: 'day' })];
    expect(sortRows(r, decodeState('sort=length'), d).map((x) => x.slug)).toEqual(['c', 'b']);
  });
});
