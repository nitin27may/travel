import { describe, expect, it } from 'vitest';
import { decodeState, emptyState, encodeState, hashToQuery, parseView } from '@/lib/entities/url';
import type { ListState } from '@/lib/entities/types';

const cases: [string, Partial<ListState>][] = [
  ['empty', {}],
  ['search', { q: 'lake louise' }],
  ['country', { facets: { country: ['CA'] } }],
  ['multi', { facets: { country: ['CA'], region: ['AB'], kind: ['lake', 'waterfall'] } }],
  ['all facets', { facets: { country: ['US'], region: ['UT'], area: ['moab'], kind: ['trail'], style: ['adventure'], grade: ['2-4'], kid: ['yes'], season: ['6', '7'], tag: ['family'], trip: ['dolomites-july-2027'], due: ['14d'] } }],
  ['view and sort', { view: 'table', sort: ['-elevation', 'name'], group: 'region', cols: ['name', 'kind', 'season'] }],
  ['advanced', { f: 'km.gt.10~gain_m.lt.800~or', sv: 'Hard hikes' }],
  ['focus and bbox', { bbox: '-120.5,35,-110,52', focus: 'CA/AB/banff-national-park/lake-louise' }],
  ['globe set', { ids: ['a/b/c/d', 'e/f/g/h'], label: 'Banff, Canada' }],
  ['awkward text', { q: 'a&b=c, d+e %' }],
];

describe('url codec', () => {
  for (const [name, patch] of cases) {
    it(`round trips: ${name}`, () => {
      const state: ListState = { ...emptyState(), ...patch };
      const encoded = encodeState(state);
      expect(decodeState(encoded)).toEqual(state);
      // and the canonical string is stable
      expect(encodeState(decodeState(encoded))).toBe(encoded);
    });
  }

  it('ignores an old ?status= parameter without error', () => {
    const state = decodeState('country=CA&status=planned,visited');
    expect(state.facets).toEqual({ country: ['CA'] });
    expect(encodeState(state)).toBe('country=CA');
  });

  it('omits defaults', () => {
    expect(encodeState(emptyState())).toBe('');
    expect(encodeState({ ...emptyState(), view: 'cards' })).toBe('');
  });

  it('writes parameters in a fixed order', () => {
    const s: ListState = { ...emptyState(), view: 'list', facets: { kind: ['lake'], country: ['CA'] }, q: 'x' };
    expect(encodeState(s)).toBe('q=x&country=CA&kind=lake&view=list');
  });

  it('maps legacy view=grid to cards and keeps list, table and map', () => {
    expect(parseView('grid')).toBe('cards');
    expect(decodeState('view=grid').view).toBe('cards');
    expect(decodeState('?view=list').view).toBe('list');
    expect(decodeState('view=table').view).toBe('table');
    expect(decodeState('view=map').view).toBe('map');
    expect(decodeState('view=nonsense').view).toBe('cards');
    expect(encodeState(decodeState('view=grid'))).toBe('');
  });

  it('upper-cases country as the legacy page did', () => {
    expect(decodeState('country=ca').facets.country).toEqual(['CA']);
  });

  it('reads a legacy hash', () => {
    expect(hashToQuery('#country=CA&view=grid')).toBe('country=CA&view=grid');
    expect(hashToQuery('#top')).toBe('');
    expect(decodeState(hashToQuery('#country=CA&kind=lake,park&kid=yes&focus=x')).facets.kind).toEqual(['lake', 'park']);
  });
});
