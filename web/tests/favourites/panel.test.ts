import { describe, expect, it } from 'vitest';
import type { FavItem } from '@travel/core/schema/favourites.ts';
import { activeCount, counts, countryOptions, hrefOf, kindOptions, NO_FILTERS, PAGE_SIZE, pageOf, parsePage, rowMeta, rowName, view } from '@/lib/favourites/panel';

const item = (o: Partial<FavItem> & { slug: string }): FavItem => ({
  space: 'place', ref: null, name: null, kind: null, cc: null, favouredAt: '2026-10-20T10:00:00.000Z', unlistedAt: null, ...o,
});
const items: FavItem[] = [
  item({ slug: 'moraine-lake', name: 'Moraine Lake', kind: 'lake', cc: 'CA', favouredAt: '2026-10-25T10:00:00.000Z' }),
  item({ slug: 'peyto', name: 'Peyto Lake', kind: 'lake', cc: 'CA', favouredAt: '2026-10-24T10:00:00.000Z' }),
  item({ slug: 'tre-cime', name: 'Tre Cime loop', kind: 'trail', cc: 'IT', favouredAt: '2026-10-23T10:00:00.000Z' }),
  item({ space: 'trip', slug: 'dolomites-2027', name: 'Dolomites', cc: 'IT', favouredAt: '2026-10-22T10:00:00.000Z' }),
  item({ slug: 'no-snapshot', favouredAt: '2026-10-21T10:00:00.000Z' }),
];

describe('rows', () => {
  it('names a row by its snapshot, or its slug in words until the first resolve', () => {
    expect(rowName(items[0]!)).toBe('Moraine Lake');
    expect(rowName(items[4]!)).toBe('No snapshot');
  });
  it('reads kind and country in the meta line; a trip says Trip; a place with no kind says Place', () => {
    expect(rowMeta(items[0]!)).toBe('Lake · Canada');
    expect(rowMeta(items[3]!)).toBe('Trip · Italy');
    expect(rowMeta(items[4]!)).toBe('Place');
  });
  it('links to the public page; a stale slug still works through the 308', () => {
    expect(hrefOf(items[0]!)).toBe('/places/moraine-lake/');
    expect(hrefOf(items[3]!)).toBe('/trips/dolomites-2027/');
  });
});

describe('filters', () => {
  it('counts All, Places and Trips', () => expect(counts(items)).toEqual({ all: 5, place: 4, trip: 1 }));
  it('scope, kind and country narrow the list; the list keeps newest first', () => {
    expect(view(items, { ...NO_FILTERS, scope: 'trip' }).map((i) => i.slug)).toEqual(['dolomites-2027']);
    expect(view(items, { ...NO_FILTERS, kinds: ['lake'] }).map((i) => i.slug)).toEqual(['moraine-lake', 'peyto']);
    expect(view(items, { ...NO_FILTERS, countries: ['IT'] }).map((i) => i.slug)).toEqual(['tre-cime', 'dolomites-2027']);
    expect(view(items, { ...NO_FILTERS, kinds: ['trail'], countries: ['CA'] })).toEqual([]);
  });
  it('sorts by name, A to Z, ignoring case', () => {
    expect(view(items, { ...NO_FILTERS, sort: 'name' }).map((i) => rowName(i))).toEqual(['Dolomites', 'Moraine Lake', 'No snapshot', 'Peyto Lake', 'Tre Cime loop']);
  });
  it('offers the kinds and countries of what is in scope, with counts', () => {
    expect(kindOptions(items, 'all')).toEqual([{ value: 'lake', label: 'Lake', count: 2 }, { value: 'trail', label: 'Trail', count: 1 }]);
    expect(kindOptions(items, 'trip')).toEqual([]);
    expect(countryOptions(items, 'all').map((o) => [o.value, o.count])).toEqual([['CA', 2], ['IT', 2]]);
  });
  it('counts the active filters for "Filters (n)"', () => {
    expect(activeCount(NO_FILTERS)).toBe(0);
    expect(activeCount({ ...NO_FILTERS, kinds: ['lake', 'trail'], countries: ['IT'], sort: 'name' })).toBe(4);
  });
});

describe('pages of 48', () => {
  const many = Array.from({ length: 130 }, (_, i) => i);
  it('cuts 48 a page and clamps the page into range', () => {
    expect(PAGE_SIZE).toBe(48);
    expect(pageOf(many, 1)).toMatchObject({ page: 1, pages: 3 });
    expect(pageOf(many, 1).rows).toHaveLength(48);
    expect(pageOf(many, 3).rows).toHaveLength(34);
    expect(pageOf(many, 9).page).toBe(3);
    expect(pageOf(many, -2).page).toBe(1);
    expect(pageOf([], 1)).toEqual({ page: 1, pages: 1, rows: [] });
  });
  it('reads ?page= as a positive integer, else page 1', () => {
    expect(parsePage('2')).toBe(2);
    for (const v of [null, '', '0', '-1', '1.5', 'x']) expect(parsePage(v)).toBe(1);
  });
});
