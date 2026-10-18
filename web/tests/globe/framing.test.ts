import { describe, expect, it } from 'vitest';
import { worldFrame, zoomForDiameter } from '@/lib/globe/framing';

const none = { top: 0, right: 0, bottom: 0, left: 0 };

describe('worldFrame', () => {
  it('derives zoom from the diameter', () => {
    expect(zoomForDiameter(512 / Math.PI)).toBeCloseTo(0, 10);
    expect(zoomForDiameter(1024 / Math.PI)).toBeCloseTo(1, 10);
  });
  it('desktop with the panel open matches the spec figures', () => {
    const f = worldFrame(1440, 840, { ...none, right: 384 });
    expect(f.freeW).toBe(1056);
    expect(f.freeH).toBe(840);
    expect(Math.round(0.86 * 840)).toBe(722);
    expect(f.zoom).toBeCloseTo(Math.log2((0.86 * 840 * Math.PI) / 512), 5);
    expect(f.minZoom).toBeCloseTo(f.zoom - 0.2, 5);
  });
  it('a narrower free area gives a smaller globe', () => {
    expect(worldFrame(1024, 708, { ...none, right: 384 }).zoom).toBeLessThan(worldFrame(1440, 840, { ...none, right: 384 }).zoom);
  });
  it('phone: the peek sheet takes the bottom', () => {
    const f = worldFrame(390, 672, { ...none, bottom: 120 });
    expect(f.freeH).toBe(552);
    expect(f.zoom).toBeCloseTo(Math.log2((0.86 * 390 * Math.PI) / 512), 5);
  });
  it('never collapses to nothing', () => {
    expect(Number.isFinite(worldFrame(50, 50, { ...none, right: 400 }).zoom)).toBe(true);
  });
});
