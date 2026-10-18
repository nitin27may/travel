import { describe, expect, it } from 'vitest';
import { slugify, resolveFeature } from '@/lib/globe/admin';
import { discSize, groupColocated, nodeAt, pinsFor } from '@/lib/globe/model';
import { norm, search } from '@/lib/globe/search';
import { buildGlobeData } from '@/lib/globe/data';
import { bbox, type FeatColl } from '@/lib/globe/geometry';
import type { CountryFacts } from '@/lib/globe/types';
import { listTrips } from '@/lib/public';

const facts: Record<string, CountryFacts> = { '380': { a2: 'IT', a3: 'ITA', name: 'Italy', latlng: [42.8, 12.8], flag: 'x' } };
const data = buildGlobeData();

describe('pins by level', () => {
  it('the world shows one pin per country with content, sized 28 to 44 by count', () => {
    const pins = pinsFor(data, [], facts);
    expect(pins.every((p) => p.kind === 'country')).toBe(true);
    expect(new Set(pins.map((p) => p.path![0])).size).toBe(pins.length);
    const it = pins.find((p) => p.path![0] === 'it')!;
    expect(it.count).toBeGreaterThan(40);
    expect(discSize(1)).toBe(28);
    expect(discSize(60)).toBe(44);
    expect(discSize(it.count)).toBeGreaterThan(discSize(2));
  });
  it('a country shows state pins and trips, a state shows district pins and places', () => {
    const country = pinsFor(data, ['it'], facts);
    expect(country.some((p) => p.kind === 'state')).toBe(true);
    expect(country.some((p) => p.kind === 'trip')).toBe(true);
    const state = pinsFor(data, ['it', 'south-tyrol'], facts);
    expect(state.some((p) => p.kind === 'district')).toBe(true);
    expect(state.some((p) => p.kind === 'place')).toBe(true);
    expect(nodeAt(data, ['it', 'south-tyrol'])?.slug).toBe('south-tyrol');
  });
  it('co-located pins merge into one group', () => {
    const g = groupColocated([
      { id: 'a', kind: 'trip', lng: 1, lat: 1, count: 1, label: 'a' },
      { id: 'b', kind: 'trip', lng: 1, lat: 1, count: 1, label: 'b' },
      { id: 'c', kind: 'trip', lng: 2, lat: 2, count: 1, label: 'c' },
    ]);
    expect(g.map((x) => x.pins.length).sort()).toEqual([1, 2]);
  });
});

describe('privacy (README 2.3)', () => {
  it('pins only listed trips, and every pin has a card', () => {
    const listed = new Set(listTrips().map((t) => t.slug));
    for (const p of data.index.pins) {
      expect(data.cards[`${p.kind}:${p.slug}`], `${p.kind}:${p.slug}`).toBeTruthy();
      if (p.kind === 'trip') expect(listed.has(p.slug)).toBe(true);
    }
    expect(Object.values(data.cards).filter((c) => c.kind === 'trip').every((c) => listed.has(c.slug))).toBe(true);
  });
});

describe('search', () => {
  const gaz = [
    { row: ['country', 'Italy', 12.8, 42.8, 'ITA', 'Rome'] as never, n: norm('Italy') },
    { row: ['city', 'Italica', 0, 0, 'ESP', 'Seville', 5] as never, n: norm('Italica') },
    { row: ['marine', 'Adriatic Sea', 15, 43, null, 'sea', 2] as never, n: norm('Adriatic Sea') },
  ];
  const src = { gazetteer: gaz, cards: Object.values(data.cards), countriesByA3: {} };
  it('finds saved places before the gazetteer and ranks countries above cities', () => {
    const hits = search('braies', src);
    expect(hits[0].action.type).toBe('place');
    const it = search('ital', src);
    expect(it[0].name).toBe('Italy');
    expect(it.map((h) => h.name)).toContain('Italica');
  });
  it('matches without accents and finds a sea', () => {
    expect(search('adriat', src)[0].kindLabel).toBe('Sea or ocean');
    expect(norm('Zürich')).toBe('zurich');
  });
});

describe('admin slugs', () => {
  it('slugify drops accents and punctuation', () => {
    expect(slugify('Trentino-Alto Adige/Südtirol')).toBe('trentino-alto-adige-sudtirol');
  });
  it('resolveFeature prefers a name match, then the shape holding most of the points', () => {
    const sq = (w: number, e: number) => ({ type: 'Polygon' as const, coordinates: [[[w, 0], [e, 0], [e, 10], [w, 10], [w, 0]] as [number, number][]] });
    const fc: FeatColl = { type: 'FeatureCollection', features: [
      { type: 'Feature', id: 0, properties: { name: 'Bolzano', slug: 'bolzano' }, geometry: sq(0, 10) },
      { type: 'Feature', id: 1, properties: { name: 'Trento', slug: 'trento' }, geometry: sq(10, 20) },
    ] };
    fc.features.forEach((f) => { f._bbox = bbox(f); });
    expect(resolveFeature(fc, 'trento')).toBe(1);
    expect(resolveFeature(fc, 'south-tyrol', [[2, 2], [3, 3], [12, 1]])).toBe(0);
    expect(resolveFeature(fc, 'nowhere')).toBeNull();
  });
});
