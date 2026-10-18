import { describe, expect, it } from 'vitest';
import { buildSearchIndex } from '@/lib/search/build';
import { normalize } from '@/lib/search/normalize';
import { createSearcher, describeCounts } from '@/lib/search/search';
import type { SearchRecord } from '@/lib/search/types';
import { listTrips } from '@/lib/public';

const recs: SearchRecord[] = [
  { k: 'trip', h: '/trips/a/', n: 'Dolomites, 13 nights', s: '', x: 'South Tyrol Italy' },
  { k: 'place', h: '/places/l/', n: 'Lago di Braies', s: '', x: 'Lake Braies Italy', kind: 'lake' },
  { k: 'place', h: '/places/m/', n: 'Müllerthal Trail', s: '', x: 'Trail Luxembourg', kind: 'trail' },
  { k: 'area', h: '/globe/it/', n: 'Italy', s: '', x: '' },
];

describe('search', () => {
  const s = createSearcher(recs);
  it('removes diacritics', () => {
    expect(normalize('Müllerthal Âne')).toBe('mullerthal ane');
    expect(s.search('muller').counts.places).toBe(1);
  });
  it('matches on the first character, grouped with counts', () => {
    const r = s.search('l');
    expect(r.counts.places).toBeGreaterThan(0);
    expect(describeCounts(s.search('italy'))).toBe('1 trip, 1 place, 1 area');
  });
  it('requires every word and ranks name prefixes first', () => {
    expect(s.search('lake braies').counts.places).toBe(1);
    expect(s.search('lake zzz').groups).toEqual([]);
    expect(s.search('ital').groups[0].hits[0].record.n).toBe('Dolomites, 13 nights');
    expect(s.search('italy').groups.find((g) => g.id === 'areas')!.hits[0].record.n).toBe('Italy');
  });
  it('forgives a typo of four letters or more', () => {
    expect(s.search('dolomtes').counts.trips).toBe(1);
  });
  it('says nothing matched', () => {
    expect(describeCounts(s.search('xyzq'))).toBe('No results');
    expect(s.search('').groups).toEqual([]);
  });
});

describe('the built index', () => {
  const index = buildSearchIndex();
  it('holds exactly the listed trips and no private slug', () => {
    expect(index.filter((r) => r.k === 'trip').map((r) => r.h).sort()).toEqual(listTrips().map((t) => `/trips/${t.slug}/`).sort());
  });
  it('searches the real data in under 16 ms a keystroke', () => {
    const s = createSearcher(index);
    const queries = ['l', 'la', 'lak', 'lake', 'dolo', 'banff', 'ital', 'trail', 'lago braies', 'xyzqw'];
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) for (const q of queries) s.search(q);
    const per = (performance.now() - t0) / (20 * queries.length);
    expect(per).toBeLessThan(16);
  });
  it('finds a trip, a place and an area by name', () => {
    const s = createSearcher(index);
    expect(s.search('dolomites').counts.trips).toBeGreaterThan(0);
    expect(s.search('louise').counts.places).toBeGreaterThan(0);
    expect(s.search('canada').counts.areas).toBeGreaterThan(0);
  });
});

import { suggest } from '@/lib/search/suggest';
describe('suggestions when nothing matches', () => {
  const recs2: SearchRecord[] = [...recs, { k: 'area', h: '/globe/ca/', n: 'Canada', s: '', x: '' }];
  const s2 = createSearcher(recs2);
  const count = (t: string) => { const r = s2.search(t); return r.counts.trips + r.counts.places + r.counts.areas; };
  it('turns "family trail italy" into a filtered Places link', () => {
    expect(s2.search('family trail italy').groups).toEqual([]);
    expect(suggest('family trail italy', recs2, count)).toEqual({ label: 'Kid-friendly trails in Italy: open the filtered Places list', href: '/places/?country=IT&kind=trail&kid=yes' });
  });
  it('handles a country and a kind, or a kind alone', () => {
    expect(suggest('lakes in canada', recs2, count)?.href).toBe('/places/?country=CA&kind=lake');
    expect(suggest('waterfalls', recs2, count)?.href).toBe('/places/?kind=waterfall');
  });
  it('falls back to the word that matches the most records', () => {
    const r = suggest('braies zzzz', recs2, count);
    expect(r?.query).toBe('braies');
  });
  it('offers nothing for gibberish', () => expect(suggest('xyzq', recs2, count)).toBeNull());
});
