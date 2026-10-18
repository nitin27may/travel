import { describe, expect, it } from 'vitest';
import type { PlaceListRow } from '@/components/places/rows';
import { placeDescriptor as d } from '@/lib/entities/descriptors/place';
import { activeFilters, clearAll, facetCounts, filterRows } from '@/lib/entities/filter';
import { activeGroup, groupRows, sortRows } from '@/lib/entities/sort';
import { decodeState } from '@/lib/entities/url';
import { placeRows } from './places/support';

const rows: PlaceListRow[] = placeRows();
const count = (q: string) => filterRows(rows, decodeState(q), d).length;
const N = rows.length;

describe('places filter', () => {
  it('lists every public place (the 64 saved ones plus the researched Dolomites places) and shows them all with no filter', () => {
    expect(rows.filter((r) => r.legacyKind !== null)).toHaveLength(64);
    expect(N).toBeGreaterThan(64);
    expect(count('')).toBe(N);
  });

  it('filters by country, region (code, name or ISO) and area (slug or name)', () => {
    const ca = count('country=CA');
    expect(ca).toBeGreaterThan(0);
    expect(ca).toBeLessThan(N);
    const qc = count('country=CA&region=QC');
    expect(count('country=CA&region=Quebec')).toBe(qc);
    expect(count('country=CA&region=ca-qc')).toBe(qc);
    expect(count('country=CA&region=QC&area=charlevoix')).toBe(count('country=CA&region=QC&area=Charlevoix'));
  });

  it('ORs within a facet and ANDs across facets', () => {
    const lakes = count('kind=lake');
    const falls = count('kind=waterfall');
    expect(count('kind=lake,waterfall')).toBe(lakes + falls);
    expect(count('kind=lake&country=CA')).toBeLessThanOrEqual(lakes);
  });

  it('has no status facet, column, group or sort, and ignores an old status parameter', () => {
    expect(d.facets.map((f) => f.param)).not.toContain('status');
    expect(d.columns.map((c) => c.id)).not.toContain('status');
    expect(d.groupBy.map((g) => g.id)).not.toContain('status');
    expect(Object.keys(d.sorts)).not.toContain('status');
    expect(count('status=planned')).toBe(N);
    expect(count('status=visited,dropped')).toBe(N);
  });

  it('filters by public trip, and by "Not in a trip yet"', () => {
    const inTrip = rows.filter((r) => r.trips.length > 0);
    const none = rows.filter((r) => r.trips.length === 0);
    expect(inTrip.length).toBeGreaterThan(0);
    expect(count('trip=none')).toBe(none.length);
    const slug = inTrip[0].trips[0].slug;
    expect(count(`trip=${slug}`)).toBe(rows.filter((r) => r.trips.some((t) => t.slug === slug)).length);
    const counts = facetCounts(rows, decodeState(''), d).trip;
    expect(counts.at(-1)).toMatchObject({ value: 'none', label: 'Not in a trip yet', count: none.length });
    expect(d.facets.find((f) => f.param === 'trip')?.label).toBe('In a public trip');
  });

  it('matches every search word, case-insensitively', () => {
    expect(count('q=LAKE louise')).toBe(1);
    expect(count('q=Lavaredo')).toBeGreaterThan(0);
    expect(count('q=zzzzzz')).toBe(0);
  });

  it('filters by season month and kid fit', () => {
    expect(count('season=7')).toBeGreaterThan(0);
    expect(count('kid=strong-kid')).toBe(rows.filter((r) => r.kid_fit === 'strong-kid').length);
  });

  it('restricts to a set of ids and to a bbox', () => {
    expect(count(`ids=${rows[0].id},${rows[1].id}`)).toBe(2);
    const p = rows.find((r) => r.lat !== null)!;
    expect(count(`bbox=${p.lon! - 0.01},${p.lat! - 0.01},${p.lon! + 0.01},${p.lat! + 0.01}`)).toBeGreaterThanOrEqual(1);
    expect(count('bbox=0,0,1,1')).toBe(0);
  });

  it('facet counts ignore the facet being counted so a chip never leads to zero', () => {
    const counts = facetCounts(rows, decodeState('country=CA'), d);
    const countries = counts.country;
    expect(countries.length).toBeGreaterThan(1); // other countries still offered
    expect(countries.reduce((n, o) => n + o.count, 0)).toBe(N);
    const kinds = counts.kind;
    expect(kinds.reduce((n, o) => n + o.count, 0)).toBe(count('country=CA'));
  });

  it('keeps a selected value with no rows so it can be switched off', () => {
    const counts = facetCounts(rows, decodeState('country=CA&kind=lighthouse&region=ZZ'), d);
    expect(counts.region.find((o) => o.value === 'ZZ')?.count).toBe(0);
  });

  it('builds removable chips and clears all', () => {
    const state = decodeState('country=CA&kind=lake,park&q=x');
    const chips = activeFilters(state, d, (_p, v) => v);
    expect(chips.map((c) => c.key)).toEqual(['country:CA', 'kind:lake', 'kind:park']);
    expect(chips[1].without.facets.kind).toEqual(['park']);
    expect(chips[0].without.facets.country).toBeUndefined();
    expect(clearAll(state).q).toBe('');
    expect(Object.keys(clearAll(state).facets)).toHaveLength(0);
  });

  it('clearing a parent chip also drops the facets that depend on it', () => {
    const chips = activeFilters(decodeState('country=CA&region=QC&area=charlevoix'), d, (_p, v) => v);
    const country = chips.find((c) => c.key === 'country:CA')!;
    expect(country.without.facets.region).toBeUndefined();
    expect(country.without.facets.area).toBeUndefined();
  });
});

describe('sort and group', () => {
  it('sorts by the default order, a key, and descending', () => {
    const byDefault = sortRows(rows, decodeState(''), d);
    expect(byDefault[0].country_name <= byDefault[N - 1].country_name).toBe(true);
    const byName = sortRows(rows, decodeState('sort=name'), d);
    expect(byName.map((r) => r.name)).toEqual([...byName.map((r) => r.name)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })));
    const desc = sortRows(rows, decodeState('sort=-elevation'), d);
    const elevs = desc.map((r) => r.elevation_m).filter((e): e is number => e !== null);
    expect(elevs).toEqual([...elevs].sort((a, b) => b - a));
    // empty values stay last in both directions
    expect(desc[desc.length - 1].elevation_m).toBeNull();
    expect(sortRows(rows, decodeState('sort=elevation'), d)[N - 1].elevation_m).toBeNull();
  });

  it('groups with counts that add up, and "none" gives one group', () => {
    const sorted = sortRows(rows, decodeState(''), d);
    const groups = groupRows(sorted, activeGroup(decodeState(''), d));
    expect(groups.length).toBe(new Set(rows.map((r) => r.country)).size);
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(N);
    expect(groupRows(sorted, activeGroup(decodeState('group=none'), d))).toHaveLength(1);
    expect(groupRows(sorted, activeGroup(decodeState('group=kind'), d)).length).toBeGreaterThan(5);
  });
});

describe('a place in two public trips', () => {
  const two: PlaceListRow = {
    ...rows[0],
    id: 'two-trips',
    slug: 'two-trips',
    trips: [
      { slug: 'trip-a', title: 'Trip A' },
      { slug: 'trip-b', title: 'Trip B' },
    ],
    trip: 'trip-a',
    trip_title: 'Trip A',
    plans: 2,
  };
  const all = [...rows, two];
  it('shows both trips as facet options and matches the place under either', () => {
    const opts = facetCounts(all, decodeState(''), d).trip;
    expect(opts.find((o) => o.value === 'trip-a')?.count).toBeGreaterThanOrEqual(1);
    expect(opts.find((o) => o.value === 'trip-b')?.count).toBe(1);
    expect(filterRows(all, decodeState('trip=trip-a'), d).map((r) => r.id)).toContain('two-trips');
    expect(filterRows(all, decodeState('trip=trip-b'), d).map((r) => r.id)).toEqual(['two-trips']);
    expect(filterRows(all, decodeState('trip=none'), d).map((r) => r.id)).not.toContain('two-trips');
  });
});
