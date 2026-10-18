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
