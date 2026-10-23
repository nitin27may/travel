// The core URL codec reads the page URL exactly as the list does (review API1a-R-5): a ListState written by web's encodeState decodes
// through core's fromSearchParams to the same store query, and core's toSearchParams writes a URL web's decodeState reads back.
import { describe, expect, it } from 'vitest';
import { fromSearchParams, toSearchParams } from '@travel/core/catalogue/httpCodec.ts';
import type { PlaceQuery } from '@travel/core/schema/api/index.ts';
import { decodeState, emptyState, encodeState } from '@/lib/entities/url';
import type { ListState } from '@/lib/entities/types';

const states: Partial<ListState>[] = [
  {},
  { q: 'lake louise' },
  { facets: { country: ['CA'], region: ['alberta', 'CA-BC'], k: ['water.falls'] }, sort: ['-km'], page: 3 },
  { facets: { country: ['IT'], 'f.swim': ['yes'], season: ['7', '8'] }, sort: ['name', '-gain'] },
  { ids: ['moraine-lake', 'lake-agnes'], label: 'Shortlist', view: 'map', group: 'kind' },
  { bbox: '-116.5,50.9,-115.1,51.6', sort: ['km'] },
];

/** The store query a ListState means: the keys the API serves, empty ones absent. */
function expected(s: ListState): PlaceQuery {
  const q: PlaceQuery = {};
  if (s.q) q.q = s.q;
  if (Object.keys(s.facets).length) q.facets = s.facets as Record<string, string[]>;
  if (s.sort.length) q.sort = s.sort;
  if (s.bbox) q.bbox = s.bbox.split(',').map(Number) as [number, number, number, number];
  if (s.ids.length) q.ids = s.ids;
  return q;
}

describe('core URL codec against web decodeState/encodeState', () => {
  for (const part of states) {
    const s: ListState = { ...emptyState(), ...part };
    it(encodeState(s) || '(empty)', () => {
      const got = fromSearchParams('listPlaces', new URLSearchParams(encodeState(s)));
      expect(got).toEqual({ ok: true, args: { method: 'listPlaces', q: expected(s), page: s.page > 1 ? { page: s.page } : {} } });
      if (!got.ok || got.args.method !== 'listPlaces') return;
      const back = decodeState(toSearchParams(got.args.q, got.args.page).toString());
      expect({ q: back.q, facets: back.facets, sort: back.sort, ids: back.ids, page: back.page, bbox: back.bbox?.split(',').map(Number) ?? null }).toEqual({
        q: s.q, facets: s.facets, sort: s.sort, ids: s.ids, page: s.page, bbox: s.bbox?.split(',').map(Number) ?? null,
      });
    });
  }
});

// API-3a: the codec rules of store.ts A25 and A31 (audit GB-A-12)
describe('core URL codec: parsed counts, unchecked, cards, and the stricter reads', () => {
  const dec = (method: Parameters<typeof fromSearchParams>[0], qs: string) => fromSearchParams(method, new URLSearchParams(qs));
  it('reads r only as a plain decimal', () => {
    expect(dec('near', 'near=place:x&r=12.5')).toMatchObject({ ok: true, args: { q: { r: 12.5 } } });
    for (const r of ['0x10', '1e2', '-5', 'Infinity', '12,5', ' 7']) {
      expect(dec('near', `near=place:x&r=${encodeURIComponent(r)}`).ok, `near r=${r}`).toBe(false);
      expect(dec('towns', `city=ca-ab-canmore&r=${encodeURIComponent(r)}`).ok, `towns r=${r}`).toBe(false);
    }
  });
  it('refuses a repeated f.<facet> or parsed.<key>, like every other key', () => {
    expect(dec('listPlaces', 'f.swim=yes&f.swim=no')).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
    expect(dec('countPlaces', 'parsed.kind=lake&parsed.kind=trail')).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
    expect(dec('countPlaces', 'parsed.nope=1')).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
    expect(dec('listPlaces', 'parsed.kind=lake')).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
  });
  it('round-trips a parsed count, an empty parse included', () => {
    for (const q of [
      { facets: { country: ['CA'] }, parsed: { q: 'larch', facets: { kind: ['lake'], 'f.swim': ['yes'] } } },
      { q: 'words', facets: { country: ['CA'] }, parsed: {} },
      { facets: { country: ['CA'] } },
    ] as PlaceQuery[]) {
      expect(fromSearchParams('countPlaces', toSearchParams(q))).toEqual({ ok: true, args: { method: 'countPlaces', q, page: {} } });
    }
  });
  it('reads only= for listUnchecked and limit= for searchCards, and refuses a sort on cards', () => {
    expect(dec('listUnchecked', 'season=7&only=season,kid')).toEqual({ ok: true, args: { method: 'listUnchecked', q: { facets: { season: ['7'] }, only: ['season', 'kid'] }, page: {} } });
    expect(dec('searchCards', 'q=larch&country=CA&limit=10')).toEqual({ ok: true, args: { method: 'searchCards', q: { q: 'larch', facets: { country: ['CA'] }, limit: 10 } } });
    expect(dec('searchCards', 'q=larch&sort=name').ok).toBe(false);
    expect(dec('searchCards', 'country=CA').ok).toBe(false);
  });
});
