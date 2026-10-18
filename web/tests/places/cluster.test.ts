import { describe, expect, it } from 'vitest';
import { cellDegrees, clusterPins, formatCamera, parseCamera } from '@/components/places/cluster';

const pt = (id: string, lng: number, lat: number) => ({ id, at: { lng, lat }, label: id });

describe('map clusters', () => {
  it('merges points that would draw close together and keeps far ones apart', () => {
    const r = clusterPins([pt('a', 12.0, 46.0), pt('b', 12.1, 46.1), pt('c', -100, 40)], 4);
    expect(r.pins).toHaveLength(2);
    const cluster = r.pins.find((p) => p.id.startsWith('cluster:'));
    expect(cluster?.number).toBe(2);
    expect(r.members.get(cluster?.id ?? '')?.sort()).toEqual(['a', 'b']);
  });
  it('splits when zoomed in far enough, and never folds the selected point into a group', () => {
    const pts = [pt('a', 12.0, 46.0), pt('b', 12.001, 46.001)];
    expect(clusterPins(pts, 3).pins).toHaveLength(1);
    expect(clusterPins(pts, 14).pins).toHaveLength(2);
    expect(clusterPins(pts, 3, 'a').pins.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });
  it('conserves every point', () => {
    const pts = Array.from({ length: 50 }, (_, i) => pt(`p${i}`, (i * 7) % 90, (i * 3) % 60));
    for (const z of [1, 2, 5, 9]) {
      const r = clusterPins(pts, z);
      const n = r.pins.reduce((s, p) => s + (p.number ?? 1), 0);
      expect(n).toBe(50);
    }
  });
  it('cells shrink as the zoom grows', () => {
    expect(cellDegrees(5)).toBeLessThan(cellDegrees(2));
  });
});

describe('?c=lon,lat,zoom', () => {
  it('round-trips and rejects nonsense', () => {
    expect(parseCamera(formatCamera({ lng: 12.1234, lat: 46.5, zoom: 7.26 }))).toEqual({ lng: 12.123, lat: 46.5, zoom: 7.3 });
    expect(parseCamera(null)).toBeNull();
    expect(parseCamera('1,2')).toBeNull();
    expect(parseCamera('200,0,3')).toBeNull();
    expect(parseCamera('a,b,c')).toBeNull();
  });
});
