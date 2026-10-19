import { describe, expect, it } from 'vitest';
import { GAP_PX, QUIET_GRID_PX, clusterItems, isMerged, overlapPx, type ClusterItem } from '@/lib/globe/cluster';

const item = (id: string, x: number, y: number, o: Partial<ClusterItem> = {}): ClusterItem => ({ id, x, y, lng: x / 10, lat: y / 10, r: 20, count: 1, label: id, tier: 'local', ...o });

describe('screen-space clustering (spec 6.5, check 20)', () => {
  it('merges discs closer than the sum of their radii plus 6 px, and leaves the rest', () => {
    const cs = clusterItems([item('a', 0, 0), item('b', 45, 0), item('c', 200, 0)]);
    expect(cs.map((c) => c.items.length).sort()).toEqual([1, 2]);
    const far = clusterItems([item('a', 0, 0), item('b', 20 + 20 + GAP_PX + 1, 0)]);
    expect(far).toHaveLength(2);
  });

  it('sums the counts and takes the label of the highest-draw member', () => {
    const [c] = clusterItems([item('a', 0, 0, { count: 5, label: 'Big local', tier: 'local' }), item('b', 10, 0, { count: 1, label: 'Famous', tier: 'world' })]);
    expect(c.count).toBe(6);
    expect(c.label).toBe('Famous');
    expect(c.tier).toBe('world');
    expect(isMerged(c)).toBe(true);
  });

  it('is the same whatever order the items come in', () => {
    const items = [item('a', 0, 0), item('b', 30, 5), item('c', 60, 0), item('d', 300, 300), item('e', 320, 300)];
    const one = clusterItems(items).map((c) => c.id);
    const two = clusterItems([...items].reverse()).map((c) => c.id);
    expect(one).toEqual(two);
  });

  it('chains: a merge that moves the centre can pull in a third disc', () => {
    const cs = clusterItems([item('a', 0, 0), item('b', 40, 0), item('c', 64, 0)]);
    expect(cs).toHaveLength(1);
    expect(cs[0].count).toBe(3);
  });

  it('merges quiet dots on a 48 px grid, and only with each other until they are close to a disc', () => {
    const dot = (id: string, x: number, y: number) => item(id, x, y, { r: 5, quiet: true });
    expect(clusterItems([dot('a', 0, 0), dot('b', QUIET_GRID_PX - 1, 0)])).toHaveLength(1);
    expect(clusterItems([dot('a', 0, 0), dot('b', QUIET_GRID_PX + 1, 0)])).toHaveLength(2);
  });

  it('leaves no two drawn discs overlapping by more than 6 px at any density (the Italy case: five state discs within 25 px)', () => {
    const items = Array.from({ length: 40 }, (_, i) => item(`s${i}`, (i % 8) * 25, Math.floor(i / 8) * 25, { r: 18 + (i % 4) * 4, count: 1 + (i % 5) }));
    const cs = clusterItems(items);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const r = (c: (typeof cs)[0]) => Math.max(...c.items.map((m) => m.r));
      expect(overlapPx({ ...cs[i], r: r(cs[i]) }, { ...cs[j], r: r(cs[j]) })).toBeLessThanOrEqual(6);
    }
  });

  it('averages longitude across the antimeridian', () => {
    const [c] = clusterItems([item('a', 0, 0, { lng: 179 }), item('b', 5, 0, { lng: -179 })]);
    expect(Math.abs(Math.abs(c.lng) - 180)).toBeLessThan(1.5);
  });
});
