import { describe, expect, it } from 'vitest';
import { dayOfHash, isAtBottom, pickCurrent } from '../../components/trips/timeline/currentDay';
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
