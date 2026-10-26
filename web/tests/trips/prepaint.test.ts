import { describe, expect, it } from 'vitest';
import { resolveTripTab, tripTabsFor, type TripTab } from '@travel/core/trips/tabs.ts';
import { prepaintScript, PREPAINT_TABS } from '@/components/trips/tabs/prepaint';
import { sunShort } from '@/components/trips/timeline/DayTimeline';

// UXB-1F M3: the inline script must reach the same tab as `resolveTripTab` for every URL it acts on, and stay small.
const available = tripTabsFor({ days: 15, stops: 90, bookings: 7, photos: 38 });
const run = (script: string, search: string, hash: string): string | null => {
  let set: string | null = null;
  const loc = { search, hash };
  new Function('location', 'document', script)(loc, { documentElement: { setAttribute: (_k: string, v: string) => (set = v) } });
  return set;
};

describe('the pre-paint tab script', () => {
  const script = prepaintScript(available);
  it('is a few hundred bytes', () => {
    expect(script.length).toBeLessThan(700);
  });
  const urls: [string, string][] = [
    ['', ''], ['?view=day', ''], ['?view=days', ''], ['?view=table', ''], ['?view=bookings', ''], ['?view=photos', ''], ['?view=all', ''], ['?view=category', ''],
    ['', '#day-11'], ['', '#day-3'], ['?view=day', '#day-11'], ['?view=bookings', '#day-11'], ['?view=summary', '#day-11'], ['?view=nonsense', '#day-2'],
    ['', '#trails'], ['?p=family-6&view=day', ''], ['?x=1&view=bookings&y=2', ''], ['', '#day-100'], ['', '#unknown'], ['?view=constructor', '#day-4'],
  ];
  it.each(urls)('agrees with resolveTripTab for %s%s', (search, hash) => {
    const view = new URLSearchParams(search).get('view');
    const expected = resolveTripTab({ view, hash, remembered: null, available }).tab;
    const got = run(script, search, hash);
    // the script acts only for the panels the server renders; for any other tab it sets nothing and the Summary stays until hydration
    expect(got).toBe(PREPAINT_TABS.includes(expected) ? expected : null);
  });
  it('does not act for a tab the trip does not draw', () => {
    const tabs: TripTab[] = ['summary', 'photos'];
    expect(run(prepaintScript(tabs), '?view=day', '#day-3')).toBeNull();
    expect(run(prepaintScript(['summary', 'days']), '?view=bookings', '#day-3')).toBe('days');
  });
  it('never throws', () => {
    expect(() => new Function('location', 'document', script)({ search: '?view=%E0%A4', hash: '' }, { documentElement: { setAttribute() {} } })).not.toThrow();
  });
});

describe('the day header sun line (I12)', () => {
  it('names each range', () => {
    expect(sunShort('Sunrise about 07:05 to 07:27, sunset about 19:43 to 20:16 in this window.')).toBe('Sunrise 07:05 to 07:27 · Sunset 19:43 to 20:16');
    expect(sunShort(null)).toBeNull();
  });
});
