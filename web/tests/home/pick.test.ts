import { describe, expect, it } from 'vitest';
import { countryPins, pickPlaces } from '@/components/home/pick';
import { globeIndex, listPlaces } from '@/lib/public';
import type { PublicPlaceCard } from '@/lib/public';

const mk = (name: string, cc: string, photo: boolean, level: 'draft' | 'usable' | 'complete'): PublicPlaceCard =>
  ({ slug: name, name, areaChain: [{ level: 'country', name: cc, slug: cc }], photo: photo ? ({ url: 'x' } as never) : null, completeness: { level } }) as never;

describe('pickPlaces', () => {
  it('prefers photos, then completeness, then name, and spreads countries', () => {
    const list = [mk('B', 'it', true, 'usable'), mk('A', 'it', true, 'usable'), mk('C', 'ca', true, 'draft'), mk('D', 'it', false, 'complete'), mk('E', 'ca', true, 'draft')];
    expect(pickPlaces(list, 3).map((p) => p.name)).toEqual(['A', 'C', 'B']);
    expect(pickPlaces(list, 5).map((p) => p.name).at(-1)).toBe('D');
  });
  it('is stable and returns eight from the real data', () => {
    const a = pickPlaces(listPlaces(), 8).map((p) => p.slug);
    expect(a).toHaveLength(8);
    expect(pickPlaces([...listPlaces()].reverse(), 8).map((p) => p.slug)).toEqual(a);
  });
});

describe('countryPins', () => {
  it('has one named pin per country with a count', () => {
    const pins = countryPins(globeIndex());
    expect(pins.length).toBeGreaterThan(5);
    for (const p of pins) {
      expect(p.count).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(2);
    }
  });
});
