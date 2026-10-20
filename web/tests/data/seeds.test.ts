import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPublicData } from '@/lib/public';
import { BASE_DOMAINS, assignSeedSlugs, displayName, ownPoint, typeTable, type CaptureSeed } from '@/lib/public/seeds';
import { REPO, realData } from './support';

// Backlog 3.48: a page for every visitable capture record of a public trip that has none.
const frozen = JSON.parse(readFileSync(path.join(__dirname, 'place-slugs-frozen.json'), 'utf8')) as string[];
const seeds = () => realData().internals.places.filter((p) => p.sources.includes('capture'));

describe('capture-seeded place pages', () => {
  it('keeps every slug that existed before (the public URLs are frozen)', () => {
    const slugs = new Set(realData().internals.places.map((p) => p.slug));
    expect(frozen.filter((s) => !slugs.has(s))).toEqual([]);
  });

  it('gives Moraine Lake and the Banff Gondola the plain slugs, with sections', () => {
    for (const [slug, name] of [['moraine-lake', 'Moraine Lake'], ['banff-gondola', 'Banff Gondola']] as const) {
      const p = realData().getPlace(slug);
      expect(p?.name).toBe(name);
      expect(p?.sections).not.toBeNull();
      expect(p?.trips.map((t) => t.slug)).toEqual(['canadian-rockies-2029']);
    }
  });

  it('builds a page for 100 or more records, all with the contract sections and unique slugs', () => {
    const s = seeds();
    expect(s.length).toBeGreaterThanOrEqual(100);
    expect(s.every((p) => p.sections && p.relevance)).toBe(true);
    const all = realData().internals.places.map((p) => p.slug);
    expect(new Set(all).size).toBe(all.length);
  });

  it('is stable across two builds', () => {
    const again = createPublicData();
    expect(again.internals.places.map((p) => p.slug)).toEqual(realData().internals.places.map((p) => p.slug));
  });

  it('only uses a point that is an OpenStreetMap or Wikidata coordinate; others stay off the map', () => {
    for (const p of seeds()) if (p.point) expect(p.point.pointSource).toMatch(/^(osm_(node|way|relation):\d+|wikidata:Q\d+)$/);
    expect(seeds().some((p) => p.point === null)).toBe(true);
  });

  it('puts only visitable types and public trips on a seeded page', () => {
    const table = typeTable(REPO);
    const cards = new Map(realData().listPlaces().map((c) => [c.slug, c]));
    for (const p of seeds()) {
      // a base-town sight override (SIGHT_OVERRIDES) keeps the settlement type but has a page on purpose
      const overridden = p.slug === 'reykjavik-old-harbour' || p.slug === 'san-telmo-market';
      expect(overridden || table.get(cards.get(p.slug)!.type!)?.visitable, p.slug).toBe(true);
      expect(p.trips.length, p.slug).toBe(1);
    }
  });

  it('links the lift ticket and the access offer to their place pages', () => {
    const lake = realData().getPlace('moraine-lake')!;
    expect(JSON.stringify(lake.sections)).toContain('shuttle');
    expect(JSON.stringify(realData().getPlace('banff-gondola')!.sections)).toContain('ticket');
  });
});

describe('offers join the page of the place they are at', () => {
  it('shows a ticket offer at a part under that part (Funbob at Monte Baranci)', () => {
    const p = realData().getPlace('monte-baranci')!;
    expect(p.sections!.offers.map((o) => o.name)).toContain('Funbob, Monte Baranci');
  });
  it('shows an experience offer under "At this place you can also" (Rafting on the Rienza at Rienza)', () => {
    expect(JSON.stringify(realData().getPlace('rienza')!.sections!.around)).toContain('Rafting on the Rienza');
    expect(JSON.stringify(realData().getPlace('moraine-lake')!.sections!.around)).toContain('Moraine Lake canoe rental');
  });
});

describe('the type rule', () => {
  const table = typeTable(REPO);
  it('reads visitable from the marks of data/vocab/types.json', () => {
    expect(table.get('water.body.lake')?.visitable).toBe(true);
    expect(table.get('ride.lift.gondola')?.visitable).toBe(true);
    expect(table.get('water.river.rafting')?.visitable).toBe(true);
    for (const t of ['access.park.parking', 'access.transit.shuttle_stop', 'food.eat.restaurant', 'stay.mountain.hut', 'settlement.town']) expect(table.get(t)?.visitable, t).toBe(false);
    expect(BASE_DOMAINS.has('settlement')).toBe(true);
  });
  it('strips a bracketed note from a name', () => {
    expect(displayName('Banff Gondola (Sulphur Mountain summit)')).toBe('Banff Gondola');
    expect(displayName('Heli-hiking (Backroads family option etc')).toBe('Heli-hiking');
    expect(displayName('(x)')).toBe('(x)');
  });
  it('takes a point from OSM or Wikidata only', () => {
    expect(ownPoint({ lat: 1, lon: 2, coord_src: 'osm', point_source: 'OSM node 12 Foo' })?.pointSource).toBe('osm_node:12');
    expect(ownPoint({ lat: 1, lon: 2, coord_src: 'wikidata', point_source: 'Q5 P625' })?.pointSource).toBe('wikidata:Q5');
    expect(ownPoint({ lat: 1, lon: 2, coord_src: 'wikidata', point_source: 'trailhead "X" at place/y' })).toBeNull();
    expect(ownPoint({ lat: 1, lon: 2, coord_src: 'prototype', point_source: 'snapshot place cadini (approximate)' })).toBeNull();
  });
  it('fills only free slugs, plain name first, then the district', () => {
    const mk = (ref: string, name: string): CaptureSeed => ({ ref, aliasRefs: [], name, names: [name], type: 'water.body.lake', typeLabel: 'Lake', layer: 'place', kind: 'lake', subkind: null, tripFolder: 'x', areaChain: [{ level: 'country', name: 'C', slug: 'c' }, { level: 'state', name: 'S', slug: 's' }, { level: 'district', name: 'Banff', slug: 'banff' }], areaLabel: '', point: null, summary: '' });
    const used = new Set(['bow-lake']);
    const out = assignSeedSlugs([mk('b', 'Bow Lake'), mk('a', 'Moraine Lake'), mk('part/c', 'Moraine Lake')], used);
    expect(out.get('b')).toBe('bow-lake-banff');
    expect(out.get('a')).toBe('moraine-lake');
    expect(out.get('part/c')).toBe('moraine-lake-banff');
  });
});
