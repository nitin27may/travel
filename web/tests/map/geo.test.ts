import { describe, expect, it } from 'vitest';
import { boundsOf, flyDuration, formatCameraParam, groupPins, parseCameraParam } from '@/lib/map/geo';
import type { Pin } from '@/lib/map/types';

const pin = (id: string, lng: number, lat: number, extra: Partial<Pin> = {}): Pin => ({ id, at: { lng, lat }, style: 'stop-numbered', ...extra });

describe('pin grouping', () => {
  it('keeps separate pins separate', () => {
    const g = groupPins([pin('a', 12.1, 46.5, { number: 1 }), pin('b', 12.2, 46.6, { number: 2 })]);
    expect(g).toHaveLength(2);
    expect(g.map((x) => x.text)).toEqual(['1', '2']);
  });
  it('merges co-located stops into one pin with a "3 · 5" badge', () => {
    const g = groupPins([pin('x', 12.1, 46.5, { number: 5 }), pin('y', 12.10001, 46.50001, { number: 3 })]);
    expect(g).toHaveLength(1);
    expect(g[0].text).toBe('3 · 5');
    expect(g[0].pins.map((p) => p.id)).toEqual(['y', 'x']);
  });
  it('counts unnumbered co-located pins and lets a base win the style', () => {
    const g = groupPins([pin('s1', 1, 1, { style: 'stop' }), pin('b', 1, 1, { style: 'base' })]);
    expect(g[0].text).toBe('2');
    expect(g[0].style).toBe('base');
  });
});

describe('camera helpers', () => {
  it('bounds', () => {
    expect(boundsOf([{ lng: 1, lat: 2 }, { lng: 3, lat: -1 }])).toEqual([{ lng: 1, lat: -1 }, { lng: 3, lat: 2 }]);
    expect(boundsOf([])).toBeNull();
  });
  it('fly duration stays between 600 and 900 ms', () => {
    expect(flyDuration(0)).toBe(600);
    expect(flyDuration(10000)).toBe(900);
    expect(flyDuration(200)).toBeGreaterThan(600);
  });
  it('round-trips the ?c= parameter and rejects junk', () => {
    const c = parseCameraParam('12.1000,46.5000,9.50');
    expect(c).toEqual({ lng: 12.1, lat: 46.5, zoom: 9.5 });
    expect(formatCameraParam(c!)).toBe('12.1000,46.5000,9.50');
    expect(parseCameraParam('x,y,z')).toBeUndefined();
    expect(parseCameraParam('12,95,3')).toBeUndefined();
    expect(parseCameraParam(null)).toBeUndefined();
  });
});
