import { describe, expect, it } from 'vitest';
import { landTest, seaOffset } from '@/lib/globe/placement';
import { bbox, type Feat, type FeatColl } from '@/lib/globe/geometry';

// a "country" covering lon 0..10, lat 0..10 and open sea on every other side
const sq = (w: number, s: number, e: number, n: number): Feat => {
  const f = { type: 'Feature', id: 1, properties: {}, geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } } as unknown as Feat;
  f._bbox = bbox(f);
  return f;
};
const fc = (...f: Feat[]): FeatColl => ({ type: 'FeatureCollection', features: f });

describe('country discs move onto the sea (review S3)', () => {
  const land = landTest(fc(sq(0, 0, 10, 10)));
  it('offsets a coastal disc away from its land, by the asked distance', () => {
    // a point on the east coast: the sea is to the east, so the disc moves right
    const off = seaOffset(9, 5, land, 30)!;
    expect(off[0]).toBeGreaterThan(0);
    expect(Math.abs(off[1])).toBeLessThan(Math.abs(off[0]));
    expect(Math.hypot(...off)).toBeLessThanOrEqual(31);
  });
  it('goes west from a west coast and south from a south coast (north is up the screen)', () => {
    expect(seaOffset(1, 5, land, 30)![0]).toBeLessThan(0);
    const south = seaOffset(5, 1, land, 30)!;
    expect(south[1]).toBeGreaterThan(0);
  });
  it('leaves a country with land all round it where it is', () => {
    const everywhere = landTest(fc(sq(0, 0, 60, 60)));
    expect(seaOffset(30, 30, everywhere, 30)).toBeNull();
  });
  it('is the same every time for the same point (no flicker as the globe spins)', () => {
    expect(seaOffset(9, 5, land, 30)).toEqual(seaOffset(9, 5, land, 30));
  });
});
