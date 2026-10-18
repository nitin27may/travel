import { describe, expect, it } from 'vitest';
import { clampPeek, snapOffset, startSnap, MIN_PEEK_PX, PEEK_HALF_GAP } from '@/components/ui/sheetSnap';

describe('bottom sheet snap geometry (backlog 2.28)', () => {
  it('keeps a normal peek as asked', () => {
    expect(clampPeek(120, 780)).toBe(120);
    expect(snapOffset('peek', 780, 120)).toBe(660);
  });

  it('clamps a peek taller than half the screen so the stops keep their order', () => {
    const height = 640;
    for (const asked of [320, 400, 900]) {
      expect(clampPeek(asked, height)).toBeLessThanOrEqual(Math.floor(height / 2) - PEEK_HALF_GAP);
      // peek sits lower on screen (bigger offset) than half, half lower than full
      expect(snapOffset('peek', height, asked)).toBeGreaterThan(snapOffset('half', height, asked));
      expect(snapOffset('half', height, asked)).toBeGreaterThan(snapOffset('full', height, asked));
    }
  });

  it('never goes below the minimum peek, even on a short screen or with a tiny request', () => {
    expect(clampPeek(10, 780)).toBe(MIN_PEEK_PX);
    expect(clampPeek(120, 320)).toBeGreaterThanOrEqual(MIN_PEEK_PX);
  });

  it('opens at the initial stop, or the tallest stop the sheet has', () => {
    expect(startSnap(['peek', 'half', 'full'], 'peek')).toBe('peek');
    expect(startSnap(['peek', 'half', 'full'])).toBe('full');
    expect(startSnap(['half'], 'peek')).toBe('half');
  });
});
