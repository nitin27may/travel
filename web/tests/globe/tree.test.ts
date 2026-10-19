import { describe, expect, it } from 'vitest';
import { canonicalRegions } from '@/lib/public/globe';
import { buildGlobeData } from '@/lib/globe/data';
import { listPlaces } from '@/lib/public';
import { getPlace } from '@/lib/public';

describe('one node per admin-1 region (spec 11, review M6)', () => {
  const data = buildGlobeData();
  const italy = data.index.continents.flatMap((c) => c.countries).find((c) => c.slug === 'it')!;

  it('has no sibling nodes that resolve to the same Natural Earth shape', () => {
    const places = listPlaces().map((p) => getPlace(p.slug)!).filter(Boolean);
    const { region, shapeOf } = canonicalRegions(places);
    // each shape is claimed by exactly one region slug
    const claim = new Map<string, Set<string>>();
    for (const [slug, key] of shapeOf) (claim.get(key) ?? claim.set(key, new Set()).get(key)!).add(region.get(slug)!.slug);
    for (const [key, slugs] of claim) expect([...slugs], key).toHaveLength(1);
    // the shape a region stands for (where most of its places are) is its own: no two siblings resolve to the same shape
    const count = new Map<string, Map<string, number>>();
    for (const [slug, key] of shapeOf) {
      const id = `${key.split('#')[0]}/${region.get(slug)!.slug}`;
      const m = count.get(id) ?? new Map<string, number>();
      m.set(key, (m.get(key) ?? 0) + 1);
      count.set(id, m);
    }
    const dominant = new Map<string, string>();
    for (const [id, m] of count) {
      const key = [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      expect(dominant.get(key), `${id} and ${dominant.get(key)} both resolve to shape ${key}`).toBeUndefined();
      dominant.set(key, id);
    }
  });

  it('files the Dolomites places under South Tyrol and Trentino, not a third Trentino-Alto Adige', () => {
    const slugs = italy.children.map((c) => c.slug);
    expect(slugs).toContain('south-tyrol');
    expect(slugs).not.toContain('trentino-alto-adige');
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every pin path starts at a node that exists', () => {
    for (const p of data.index.pins.filter((x) => x.path.length > 1)) {
      const cn = data.index.continents.flatMap((c) => c.countries).find((c) => c.slug === p.path[0]);
      expect(cn?.children.some((c) => c.slug === p.path[1]), `${p.slug} ${p.path.join('/')}`).toBe(true);
    }
  });
});
