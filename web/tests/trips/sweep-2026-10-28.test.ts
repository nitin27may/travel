import { describe, expect, it } from 'vitest';
import { MAP_PIN_NEAR_PX, TITLE_LONG_CHARS, TRIP_NAME_MAX } from '@/lib/config/product';
import { groupPins } from '@/lib/map/geo';
import { countCards } from '@/components/trips/summary/text';
import type { TripSummary } from '@travel/core/trips/summary.ts';

// Step 2 sweep of 28 Oct 2026 (docs/v2/design/step2/sweep-2026-10-28.md): the logic the fixes added.
describe('SW-003: numbered pins that overlap on screen draw as one pill', () => {
  const pin = (id: string, n: number, lng: number) => ({ id, at: { lng, lat: 51.2 }, style: 'stop-numbered' as const, number: n });
  const pins = [pin('a', 2, -115.5), pin('b', 3, -115.51), pin('c', 4, -115.2)];
  it('joins two pins that are a few pixels apart at a wide zoom and splits them when zoomed in', () => {
    const wide = groupPins(pins, 8);
    expect(wide.map((g) => g.text).sort()).toEqual(['2 · 3', '4']);
    const close = groupPins(pins, 15);
    expect(close.map((g) => g.text).sort()).toEqual(['2', '3', '4']);
    expect(MAP_PIN_NEAR_PX).toBe(20);
  });
  it('without a zoom keeps the old rule: only pins in one 11 m cell share a group', () => {
    expect(groupPins(pins).length).toBe(3);
  });
});

describe('SW-029: the book-ahead card holds one clause', () => {
  const s = { flags: { days: true, counts: true, bookings: true }, nights: 14, counts: { stays: 5, trails: { count: 0, kmKnown: 0, km: 0 }, sights: 0, activities: 0, photos: 0, highlights: 0, bookings: { count: 8, dated: 4, earliest: { name: "Lake O'Hara day-use bus (lottery)", day: 9, rule: 'Lottery: apply usually in March; seats left after the draw until 15:30 the day before Day 9' } } } } as unknown as TripSummary;
  it('cuts the rule at its first semicolon and drops a lead word the name already says', () => {
    const card = countCards(s, { stops: true, bookings: true, photos: true }).find((c) => c.key === 'bookings')!;
    expect(card.sub).toBe("earliest: Lake O'Hara day-use bus (lottery), apply usually in March");
  });
});

describe('SW-012: the trip name is capped and a long one steps the cover down', () => {
  it('has a cap above the step-down length', () => {
    expect(TRIP_NAME_MAX).toBe(60);
    expect(TITLE_LONG_CHARS).toBeLessThan(TRIP_NAME_MAX);
  });
});
