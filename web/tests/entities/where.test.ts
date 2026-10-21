import { describe, expect, it } from 'vitest';
import { whereSummary, findWhere, pickArea, pickCountry, pickRegion, regionNoun, splitZero, whereChips, withWhere, mergeCountries, hasWhere } from '@/components/entity/whereModel';
import { placeDescriptor as d } from '@/lib/entities/descriptors/place';
import { tripDescriptor } from '@/lib/entities/descriptors/trip';
import { activeFilters, dropDependents, facetCounts, filterRows } from '@/lib/entities/filter';
import { emptyState } from '@/lib/entities/url';
import { partitionFacets } from '@/components/entity/FilterBar';
import { placeRows } from '../places/support';

const rows = placeRows();
const labelOf = (_p: string, v: string) => v.replace(/^./, (c) => c.toUpperCase());
const sel = (country: string[] = [], region: string[] = [], area: string[] = []) => ({ country, region, area });
const state = (facets: Record<string, string[]>) => ({ ...emptyState(), facets });

describe('Where model', () => {
  it('names the deepest choice on the pill', () => {
    expect(whereSummary('Where', sel(), labelOf)).toBe('Where');
    expect(whereSummary('Where', sel(['CA']), labelOf)).toBe('Where · CA');
    expect(whereSummary('Where', sel(['CA'], ['alberta']), labelOf)).toBe('Where · Alberta');
    expect(whereSummary('Where', sel(['CA'], ['alberta'], ['banff', 'yoho']), labelOf)).toBe('Where · Banff, Yoho');
    expect(whereSummary('Where', sel(['CA'], ['alberta'], ['a', 'b', 'c']), labelOf)).toBe('Where · 3 areas');
    expect(whereSummary('Where', sel(['CA'], ['a', 'b', 'c']), labelOf)).toBe('Where · 3 provinces');
  });
  it('the second level is named for the country', () => {
    expect(regionNoun('CA').one).toBe('Province');
    expect(regionNoun('us').one).toBe('State');
    expect(regionNoun('IT').one).toBe('Region');
  });
  it('picks cascade: a new country drops the levels under it, the same one keeps them, null clears', () => {
    const f = { country: ['CA'], region: ['alberta'], area: ['banff'] };
    expect(pickCountry(f, 'IT')).toEqual({ country: ['IT'] });
    expect(pickCountry(f, 'CA')).toBe(f);
    expect(pickCountry(f, null)).toEqual({});
    expect(pickRegion(f, 'quebec')).toEqual({ country: ['CA'], region: ['alberta', 'quebec'] });
    expect(pickRegion(f, 'quebec', true)).toEqual({ country: ['CA'], region: ['quebec'] });
    expect(pickRegion(f, null)).toEqual({ country: ['CA'] });
    expect(pickArea(f, 'yoho')).toEqual({ ...f, area: ['banff', 'yoho'] });
    expect(pickArea(f, 'banff')).toEqual({ country: ['CA'], region: ['alberta'] });
  });
  it('hides options with no rows behind one line, except a chosen one', () => {
    const o = [{ value: 'a', label: 'A', count: 3 }, { value: 'b', label: 'B', count: 0 }, { value: 'c', label: 'C', count: 0 }];
    expect(splitZero(o, []).hidden.map((x) => x.value)).toEqual(['b', 'c']);
    expect(splitZero(o, ['c']).shown.map((x) => x.value)).toEqual(['a', 'c']);
  });
  it('the find field matches names, codes and other spellings of a region', () => {
    const levels = {
      countries: [{ value: 'CA', label: 'Canada', count: 178 }],
      regions: [{ value: 'alberta', label: 'Alberta', count: 116, hint: 'alberta AB Alta' }, { value: 'quebec', label: 'Quebec', count: 21, hint: 'quebec Québec QC' }],
      areas: [{ value: 'banff', label: 'Banff National Park', count: 45 }],
    };
    expect(findWhere('AB', levels)[0]?.label).toBe('Alberta');
    expect(findWhere('alta', levels)[0]?.label).toBe('Alberta');
    expect(findWhere('quebec', levels)[0]?.label).toBe('Quebec');
    expect(findWhere('banff', levels)[0]).toMatchObject({ level: 2, value: 'banff' });
    expect(findWhere('zzz', levels)).toEqual([]);
    expect(findWhere('  ', levels)).toEqual([]);
  });
});

describe('the country level', () => {
  const manifest = [{ value: 'CA', label: 'Canada', count: 178 }, { value: 'IT', label: 'Italy', count: 61 }, { value: 'IS', label: 'Iceland', count: 25 }];
  it('lists every country with the manifest counts while only Where narrows the list', () => {
    const held = { country: [{ value: 'CA', label: 'Canada', count: 116 }] };
    const out = mergeCountries(held, manifest, state({ country: ['CA'], region: ['alberta'] })).country!;
    expect(out.map((o) => `${o.value}:${o.count}`)).toEqual(['CA:178', 'IT:61', 'IS:25']);
  });
  it('gives a country that is not loaded no count when another filter is on, and sorts it last', () => {
    const held = { country: [{ value: 'CA', label: 'Canada', count: 12 }] };
    const out = mergeCountries(held, manifest, state({ country: ['CA'], k: ['nature.trail'] })).country!;
    expect(out.map((o) => `${o.value}:${o.count}`)).toEqual(['CA:12', 'IT:-1', 'IS:-1']);
  });
  it('keeps a chosen country the manifest does not know, and does nothing without a manifest', () => {
    const held = { country: [{ value: 'ZZ', label: 'Zedland', count: 3 }] };
    expect(mergeCountries(held, manifest, state({ country: ['ZZ'] })).country!.map((o) => o.value)).toContain('ZZ');
    expect(mergeCountries(held, undefined, state({}))).toBe(held);
  });
});

describe('Where on the Places descriptor', () => {
  it('has one pill for three keys: region and area leave More filters and the bar', () => {
    const counts = facetCounts(rows, emptyState(), d);
    const st = state({ country: ['CA'], region: ['alberta'] });
    const { primary, more } = partitionFacets(d, st, counts);
    expect(primary.map((f) => f.label).slice(0, 4)).toEqual(['Where', 'Kind', 'Season', 'Youngest child']);
    expect(primary.length).toBeLessThanOrEqual(4);
    expect([...primary, ...more].some((f) => f.param === 'region' || f.param === 'area')).toBe(false);
    expect(d.facets.find((f) => f.param === 'country')?.control).toBe('where');
  });
  it('Canada then Alberta narrows to Alberta, and counts are under the other filters', () => {
    const ca = filterRows(rows, state({ country: ['CA'] }), d);
    const ab = filterRows(rows, state({ country: ['CA'], region: ['alberta'] }), d);
    expect(ab.length).toBeGreaterThan(0);
    expect(ab.length).toBeLessThan(ca.length);
    const counts = facetCounts(rows, state({ country: ['CA'] }), d);
    expect(counts.region!.find((r) => r.value === 'alberta')?.count).toBe(ab.length);
    expect(counts.region!.every((r, i, a) => i === 0 || a[i - 1]!.count >= r.count)).toBe(true);
  });
  it('a region carries its other spellings for the find field', () => {
    const counts = facetCounts(rows, state({ country: ['CA'] }), d);
    expect(counts.region!.find((r) => r.value === 'alberta')?.hint).toMatch(/alberta/i);
  });
  it('removing Canada clears region and area; the chips read bare values', () => {
    const st = state({ country: ['CA'], region: ['alberta'], area: ['banff-national-park'] });
    const chips = whereChips(activeFilters(st, d, labelOf), labelOf, hasWhere(d));
    expect(chips.map((c) => c.label)).toEqual(['CA', 'Alberta', 'Banff-national-park']);
    expect(chips[0]!.without.facets).toEqual({});
    const f = { ...st.facets };
    dropDependents(f, d, 'country');
    expect(f.region).toBeUndefined();
    expect(hasWhere(tripDescriptor)).toBe(false);
    expect(whereChips(activeFilters(state({ country: ['CA'] }), tripDescriptor, labelOf), labelOf, hasWhere(tripDescriptor))[0]!.label).toMatch(/^Where: /);
    expect(withWhere(st, { country: ['CA'], region: [] }).facets).toEqual({ country: ['CA'] });
  });
});
