import { describe, expect, it } from 'vitest';
import { SPIN_DECAY_MS, SPIN_DEG_PER_S, SPIN_RESUME_MS, initialSpin, stepSpin, touchSpin } from '@/lib/globe/motion';

describe('spin timings (patterns 6)', () => {
  it('turns once in 90 seconds', () => {
    expect(SPIN_DEG_PER_S * 90).toBe(360);
    let s = initialSpin();
    let lng = 0;
    for (let t = 0; t < 90_000; t += 16) { const r = stepSpin(s, 16, t, true); s = r.state; lng += r.dLng; }
    expect(lng).toBeGreaterThan(358);
    expect(lng).toBeLessThan(362);
  });
  it('decays to zero over 400 ms after a touch', () => {
    let s = touchSpin(initialSpin(), 0);
    let now = 0;
    const speeds: number[] = [];
    for (; now < SPIN_DECAY_MS; now += 20) { const r = stepSpin(s, 20, now, true); s = r.state; speeds.push(r.state.speed); }
    expect(speeds[0]).toBeLessThan(1);
    expect(speeds[speeds.length - 1]).toBe(0);
  });
  it('stays still until 20 s idle, then resumes', () => {
    let s = touchSpin(initialSpin(), 1000);
    for (let t = 1000; t < 1000 + SPIN_RESUME_MS - 100; t += 100) s = stepSpin(s, 100, t, true).state;
    expect(s.speed).toBe(0);
    for (let t = 1000 + SPIN_RESUME_MS; t < 1000 + SPIN_RESUME_MS + 1000; t += 100) s = stepSpin(s, 100, t, true).state;
    expect(s.speed).toBe(1);
  });
  it('never turns when inactive (reduced motion, off, drilled in)', () => {
    let s = initialSpin();
    let lng = 0;
    for (let t = 0; t < 2000; t += 16) { const r = stepSpin(s, 16, t, false); s = r.state; lng += r.dLng; }
    expect(s.speed).toBe(0);
    expect(lng).toBeLessThan(SPIN_DEG_PER_S * 0.45);
    expect(stepSpin(s, 16, 3000, false).dLng).toBe(0);
  });
});

import { CLICK_SLOP_PX, isClick, spinStepDeg } from '@/lib/globe/motion';
describe('spin by easing and click slop', () => {
  it('one ease advances a full turn per 90 s', () => { expect(spinStepDeg(1000) * 90).toBeCloseTo(360, 6); });
  it('a press that moved more than the slop, or dragged, is not a click', () => {
    expect(isClick({ x: 0, y: 0 }, { x: CLICK_SLOP_PX, y: 0 }, false)).toBe(true);
    expect(isClick({ x: 0, y: 0 }, { x: 200, y: 0 }, false)).toBe(false);
    expect(isClick({ x: 0, y: 0 }, { x: 0, y: 0 }, true)).toBe(false);
  });
});
