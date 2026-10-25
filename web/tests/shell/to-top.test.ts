import { describe, expect, it } from 'vitest';
import { keyboardUp, toTopVisible } from '@/lib/to-top';

describe('back-to-top visibility (S28)', () => {
  const vh = 800;
  it('stays hidden near the top and shows from 1.5 screens down', () => {
    expect(toTopVisible(false, 0, vh)).toBe(false);
    expect(toTopVisible(false, 1199, vh)).toBe(false);
    expect(toTopVisible(false, 1200, vh)).toBe(true);
  });
  it('once shown, hides only within one screen of the top (no flicker at the edge)', () => {
    expect(toTopVisible(true, 1000, vh)).toBe(true);
    expect(toTopVisible(true, 801, vh)).toBe(true);
    expect(toTopVisible(true, 800, vh)).toBe(false);
    expect(toTopVisible(true, 0, vh)).toBe(false);
  });
  it('is hidden with no viewport', () => expect(toTopVisible(true, 5000, 0)).toBe(false));
  it('detects the on-screen keyboard by a shrunk visual viewport or a focused field', () => {
    expect(keyboardUp(844, 844, false)).toBe(false);
    expect(keyboardUp(500, 844, false)).toBe(true);
    expect(keyboardUp(844, 844, true)).toBe(true);
  });
});
