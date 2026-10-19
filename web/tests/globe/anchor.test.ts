import { describe, expect, it } from 'vitest';
import { cardRect, placeCard, type Rect } from '@/lib/globe/anchor';

const free: Rect = { left: 0, top: 0, right: 1056, bottom: 840 };
const size = { w: 320, h: 380 };

describe('card placement (spec 3.2, review M3)', () => {
  it('hangs right and down from a point with room', () => {
    expect(placeCard({ x: 300, y: 200 }, size, free, []).anchor).toBe('top-left');
  });
  it('flips left when the right side would leave the free area, and up when the bottom would', () => {
    expect(placeCard({ x: 900, y: 200 }, size, free, []).anchor).toBe('top-right');
    expect(placeCard({ x: 300, y: 700 }, size, free, []).anchor).toBe('bottom-left');
    expect(placeCard({ x: 900, y: 700 }, size, free, []).anchor).toBe('bottom-right');
  });
  it('stays off the search box and the breadcrumb', () => {
    const search: Rect = { left: 312, top: 12, right: 732, bottom: 52 };
    const crumb: Rect = { left: 12, top: 12, right: 300, bottom: 100 };
    const p = placeCard({ x: 330, y: 60 }, size, free, [search, crumb]);
    const r = cardRect({ x: 330, y: 60 }, size, p.anchor);
    for (const o of [search, crumb]) expect(Math.min(r.right, o.right) > Math.max(r.left, o.left) && Math.min(r.bottom, o.bottom) > Math.max(r.top, o.top)).toBe(false);
  });
  it('takes the least bad corner when none is clear', () => {
    const p = placeCard({ x: 500, y: 400 }, { w: 1000, h: 800 }, free, []);
    expect(p.overlap).toBeGreaterThan(0);
  });
});
