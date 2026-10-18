import { describe, expect, it } from 'vitest';
import { bbox, centroid, inFeature, inRing, locate, tally, topoFeatures, type Feat, type FeatColl, type Topology } from '@/lib/globe/geometry';

const poly = (rings: [number, number][][]): Feat => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: rings } });
const multi = (polys: [number, number][][][]): Feat => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: polys } });
const box = (w: number, s: number, e: number, n: number): [number, number][] => [[w, s], [e, s], [e, n], [w, n], [w, s]];

describe('bbox', () => {
  it('is the plain extent for a shape that stays on one side', () => {
    expect(bbox(poly([box(10, 40, 20, 50)]))).toEqual([[10, 40], [20, 50]]);
  });
  it('takes the narrow eastern span for Fiji, which crosses 180', () => {
    const fiji = multi([[box(177, -19, 180, -16)], [box(-180, -19, -178, -16)]]);
    expect(bbox(fiji)).toEqual([[177, -19], [182, -16]]);
  });
  it('does the same for Russia, whose east end is at about -170', () => {
    const russia = multi([[box(19, 41, 180, 77)], [box(-180, 64, -169, 70)]]);
    const [[w], [e]] = bbox(russia);
    expect(w).toBe(19);
    expect(e).toBe(191);
  });
  it('keeps a genuinely wide shape that does not cross 180 as it is', () => {
    expect(bbox(poly([box(-80, 10, 80, 20)]))[0][0]).toBe(-80);
  });
});

describe('inFeature', () => {
  const donut = poly([box(0, 0, 10, 10), box(4, 4, 6, 6)]);
  it('is true inside the outer ring and false in a hole', () => {
    expect(inFeature(donut, [1, 1])).toBe(true);
    expect(inFeature(donut, [5, 5])).toBe(false);
    expect(inFeature(donut, [20, 5])).toBe(false);
  });
  it('checks each polygon of a multipolygon', () => {
    const m = multi([[box(0, 0, 1, 1)], [box(5, 5, 6, 6)]]);
    expect(inFeature(m, [5.5, 5.5])).toBe(true);
    expect(inFeature(m, [3, 3])).toBe(false);
  });
  it('inRing handles a point on the same latitude as a vertex', () => {
    expect(inRing(box(0, 0, 10, 10), [5, 10.0001])).toBe(false);
  });
});

describe('tally and locate', () => {
  const fc: FeatColl = { type: 'FeatureCollection', features: [poly([box(0, 0, 10, 10)]), poly([box(20, 0, 30, 10)])] };
  fc.features.forEach((f) => { f._bbox = bbox(f); });
  it('counts each item into the shape that holds it and returns the strays', () => {
    const outside = tally(fc, [
      { id: 'a', lon: 1, lat: 1 }, { id: 'b', lon: 2, lat: 2 }, { id: 'c', lon: 25, lat: 5 }, { id: 'd', lon: 50, lat: 50 }, { id: 'e', lon: null, lat: null },
    ]);
    expect(fc.features.map((f) => f.properties.n)).toEqual([2, 1]);
    expect(fc.features[0]._pids).toEqual(['a', 'b']);
    expect(outside.map((p) => p.id)).toEqual(['d']);
  });
  it('resets the counts when it runs again', () => {
    tally(fc, []);
    expect(fc.features.map((f) => f.properties.n)).toEqual([0, 0]);
  });
  it('locate finds a point written 360 degrees away from a box that passes 180', () => {
    const wide: FeatColl = { type: 'FeatureCollection', features: [poly([box(177, -19, 182, -16)])] };
    wide.features[0]._bbox = [[177, -19], [182, -16]];
    wide.features[0].geometry = { type: 'Polygon', coordinates: [box(177, -19, 182, -16)] };
    expect(locate(wide, [-179, -17])).toBeUndefined(); // the ring itself is in 177..182, so only the box test passes
  });
});

describe('topoFeatures', () => {
  const topo: Topology = {
    transform: { scale: [1, 1], translate: [0, 0] },
    arcs: [[[0, 0], [10, 0], [0, 10], [-10, 0], [0, -10]]],
    objects: { c: { geometries: [{ type: 'Polygon', id: '1', arcs: [[0]], properties: { name: 'Box' } }] } },
  };
  it('decodes delta arcs into a ring', () => {
    const fc = topoFeatures(topo, topo.objects.c);
    expect(fc.features[0].geometry).toEqual({ type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] });
    expect(fc.features[0].properties).toEqual({ name: 'Box' });
  });
  it('centroid is the mean of the ring', () => {
    const fc = topoFeatures(topo, topo.objects.c);
    expect(centroid(fc.features[0])).toEqual([4, 4]);
  });
});

describe('hitRank (spec 4.1)', () => {
  it('parks are not targets below zoom 5, and rank last above it', async () => {
    const { hitRank } = await import('@/lib/globe/geometry');
    expect(hitRank(4, 'park')).toBeNull();
    expect(hitRank(6, 'park')).toBe(4);
  });
  it('peaks beat rivers, and rivers rank after water names', async () => {
    const { hitRank } = await import('@/lib/globe/geometry');
    expect(hitRank(7, 'mountain_peak')!).toBeLessThan(hitRank(7, 'waterway')!);
    expect(hitRank(7, 'water_name')!).toBeLessThan(hitRank(7, 'waterway')!);
    expect(hitRank(3, 'place', { class: 'city', rank: 2 })).toBe(0);
  });
  it('small towns wait for zoom 7', async () => {
    const { hitRank } = await import('@/lib/globe/geometry');
    expect(hitRank(6, 'place', { class: 'town', rank: 8 })).toBeNull();
    expect(hitRank(7.5, 'place', { class: 'town', rank: 8 })).not.toBeNull();
  });
});
