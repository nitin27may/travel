import { describe, expect, it } from 'vitest';
import { decodeState, emptyState, encodeState, pageAfter } from '@/lib/entities/url';

// patterns.md 1.2: q, filters, view, group, sort, dir, page; defaults omitted
describe('list state URL (patterns 1.2)', () => {
  it('writes keys in the documented order and omits defaults', () => {
    const s = { ...emptyState(), page: 2, sort: ['-area'], group: 'country', view: 'table' as const, facets: { kind: ['trail', 'lake'], country: ['IT'] }, q: 'lake' };
    expect(encodeState(s)).toBe('q=lake&country=IT&kind=trail,lake&view=table&group=country&sort=area&dir=desc&page=2');
    expect(encodeState({ ...emptyState(), page: 1 })).toBe('');
  });

  it('round trips sort with dir, and still reads the old -key form', () => {
    expect(decodeState('sort=area&dir=desc').sort).toEqual(['-area']);
    expect(decodeState('sort=area&dir=asc').sort).toEqual(['area']);
    expect(decodeState('sort=-area').sort).toEqual(['-area']);
    const multi = { ...emptyState(), sort: ['-a', 'b'] };
    expect(decodeState(encodeState(multi))).toEqual(multi);
  });

  it('reads and writes page, ignoring nonsense', () => {
    expect(decodeState('page=3').page).toBe(3);
    expect(decodeState('page=0').page).toBe(1);
    expect(decodeState('page=x').page).toBe(1);
  });

  it('a change to the rows shown goes back to page 1, opening a sheet does not', () => {
    const prev = { ...emptyState(), page: 3 };
    expect(pageAfter(prev, { ...prev, q: 'x' })).toBe(1);
    expect(pageAfter(prev, { ...prev, facets: { kind: ['lake'] } })).toBe(1);
    expect(pageAfter(prev, { ...prev, focus: 'a/b' })).toBe(3);
    expect(pageAfter(prev, { ...prev, page: 4 })).toBe(4);
  });
});
