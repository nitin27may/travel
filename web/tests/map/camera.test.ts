import { describe, expect, it } from 'vitest';
import { cameraFor, clusterNumbered, worldPx } from '@/lib/map/camera';
import type { Pin } from '@/lib/map/types';

const pin = (n: number, lng: number, lat: number): Pin => ({ id: `stop:1:p${n}`, at: { lng, lat }, style: 'stop-numbered', number: n, label: `P${n}` });

describe('overlapping numbered pins become one pill (map note 4.2)', () => {
  it('keeps pins that are far apart on screen', () => {
    expect(clusterNumbered([pin(1, 12, 46), pin(2, 12.5, 46.4)], 10)).toHaveLength(2);
  });
  it('joins pins under 20 px apart at this zoom and keeps the numbers, ids and first place', () => {
    const out = clusterNumbered([pin(3, 12.001, 46), pin(2, 12, 46), pin(1, 13, 47)], 9);
    const pill = out.find((p) => p.numbers)!;
    expect(pill.numbers).toEqual([2, 3]);
    expect(pill.id).toBe('stop:1:p2+stop:1:p3');
    expect(pill.at).toEqual({ lng: 12, lat: 46 });
    expect(out).toHaveLength(2);
  });
  it('the same two pins separate again when zoomed in', () => {
    expect(clusterNumbered([pin(2, 12, 46), pin(3, 12.001, 46)], 16)).toHaveLength(2);
  });
  it('never merges a dot or a base', () => {
    const dot: Pin = { id: 'dot:x', at: { lng: 12, lat: 46 }, style: 'stop' };
    expect(clusterNumbered([pin(1, 12, 46), dot], 5)).toHaveLength(2);
  });
});

describe('a camera for some points, without a map object', () => {
  const b: [{ lng: number; lat: number }, { lng: number; lat: number }] = [{ lng: 12, lat: 46 }, { lng: 12.4, lat: 46.3 }];
  it('fits the bounds inside the padded box', () => {
    const c = cameraFor(b, { w: 600, h: 500 }, { top: 40, right: 60, bottom: 44, left: 28 });
    const a = worldPx(b[0], c.zoom), z = worldPx(b[1], c.zoom);
    expect(Math.abs(z.x - a.x)).toBeLessThanOrEqual(600 - 88 + 0.5);
    expect(Math.abs(z.y - a.y)).toBeLessThanOrEqual(500 - 84 + 0.5);
  });
  it('never zooms closer than maxZoom', () => {
    expect(cameraFor([{ lng: 12, lat: 46 }, { lng: 12.0001, lat: 46.0001 }], { w: 600, h: 500 }, { top: 0, right: 0, bottom: 0, left: 0 }, 13).zoom).toBe(13);
  });
  it('moves the centre away from the side with more padding', () => {
    const left = cameraFor(b, { w: 600, h: 500 }, { top: 0, right: 0, bottom: 0, left: 100 });
    const right = cameraFor(b, { w: 600, h: 500 }, { top: 0, right: 100, bottom: 0, left: 0 });
    expect(left.center.lng).toBeLessThan(right.center.lng);
  });
});
