import { describe, expect, it } from 'vitest';
import { dayOfHash, focusLine, isAtBottom, pickCurrent } from '../../components/trips/timeline/currentDay';
import { tripQuery } from '../../components/trips/useTripUrl';

const spots = (tops: number[]) => tops.map((top, i) => ({ key: i + 1, top }));

describe('pickCurrent', () => {
  it('is the last day whose top is at or above the line', () => {
    expect(pickCurrent(spots([-900, -300, 40, 700]), 100, false)).toBe(3);
    expect(pickCurrent(spots([-900, -300, 100, 700]), 100, false)).toBe(3);
    expect(pickCurrent(spots([-900, -300, 101, 700]), 100, false)).toBe(2);
  });
  it('holds a very tall day until the next one reaches the line', () => {
    expect(pickCurrent(spots([-6000, 4000]), 100, false)).toBe(1);
  });
  it('is null above the first day, so the first day is only a display fallback', () => {
    expect(pickCurrent(spots([300, 900, 1500]), 100, false)).toBeNull();
  });
  it('makes the last day current at the page bottom even when it cannot reach the line', () => {
    expect(pickCurrent(spots([-2000, -400, 500]), 100, true)).toBe(3);
    expect(pickCurrent(spots([-2000, -400, 500]), 100, false)).toBe(2);
  });
  it('has no answer for an empty list', () => {
    expect(pickCurrent([], 100, true)).toBeNull();
  });
});

describe('isAtBottom', () => {
  it('allows 2 px of fractional scroll and never counts an unscrolled page', () => {
    expect(isAtBottom(1500, 900, 2400)).toBe(true);
    expect(isAtBottom(1498.5, 900, 2400)).toBe(true);
    expect(isAtBottom(1400, 900, 2400)).toBe(false);
    expect(isAtBottom(0, 900, 900)).toBe(false);
  });
});

describe('dayOfHash', () => {
  it('reads #day-N only', () => {
    expect(dayOfHash('#day-12')).toBe(12);
    expect(dayOfHash('day-3')).toBe(3);
    expect(dayOfHash('#trails')).toBeNull();
    expect(dayOfHash('#day-3x')).toBeNull();
  });
});

describe('tripQuery keeps keys it does not own', () => {
  it('appends extra keys after the timeline keys and the view', () => {
    expect(tripQuery('day', 'p=adults', 'utm=mail')).toBe('?p=adults&utm=mail');
    expect(tripQuery('category', 'pace=relaxed', 'utm=mail')).toBe('?pace=relaxed&view=category&utm=mail');
    expect(tripQuery('day', '')).toBe('');
  });
});

describe('focusLine', () => {
  it('sits 35% down the area under the sticky bars', () => {
    expect(focusLine(108, 900)).toBeCloseTo(108 + 0.35 * 792);
    expect(focusLine(0, 800)).toBe(280);
  });
  it('never rises above the bars, even in a tiny viewport', () => {
    expect(focusLine(108, 90)).toBe(108);
  });
});

describe('the focus line decides what the visitor is looking at', () => {
  const line = focusLine(108, 900); // 385
  it('day 8 with its top at 150 px is current, not day 7 (owner report)', () => {
    expect(pickCurrent(spots([-2000, -900, 150, 1200]), line, false)).toBe(3);
  });
  it('a day whose top is below the line is not yet current', () => {
    expect(pickCurrent(spots([-2000, -900, 400, 1200]), line, false)).toBe(2);
  });
  it('a short last day above the line is current without needing the page bottom', () => {
    expect(pickCurrent(spots([-2000, -500, 300]), line, false)).toBe(3);
  });
  it('a short last day below the line still wins at the page bottom', () => {
    expect(pickCurrent(spots([-2000, -300, 700]), line, true)).toBe(3);
  });
  it('a very tall day stays current while its top is far above and the next is far below', () => {
    expect(pickCurrent(spots([-9000, 3000]), line, false)).toBe(1);
  });
  it('a jump landing a day 16 px under the bars is current at once', () => {
    expect(pickCurrent(spots([-800, 124, 1500]), line, false)).toBe(2);
  });
});
