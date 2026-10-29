// S2D-SCHED: the published days the four scheduler fixes change, read from the real data (the core tests read the fixtures). The
// fixtures must carry the same inputs for these days, so the core cases test what the page shows.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scheduleDay } from '@travel/core/schedule/schedule.ts';
import { DEFAULT_PROFILE, type ScheduleDayInput } from '@travel/core/schedule/types.ts';
import { createPublicData } from '@/lib/public';

const data = createPublicData();
const fixture = (name: string): ScheduleDayInput[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../core/test/schedule/fixtures/${name}.json`, import.meta.url)), 'utf8')) as ScheduleDayInput[];
const input = (slug: string, n: number): ScheduleDayInput => data.getTrip(slug)!.days.find((d) => d.n === n)!.scheduleInput!;
const ADULTS = { ...DEFAULT_PROFILE, party: 'adults' as const, youngest: null };

describe('S2D-SCHED on the published days', () => {
  it('the core fixtures carry the published inputs of the changed days', () => {
    const plain = (x: unknown) => JSON.parse(JSON.stringify(x));
    for (const n of [2, 4]) expect(plain(fixture('rockies-trip').find((d) => d.day === n)), `Rockies Day ${n}`).toEqual(plain(input('canadian-rockies-2029', n)));
    expect(plain(fixture('dolomites-trip').find((d) => d.day === 2))).toEqual(plain(input('dolomites-2027', 2)));
  });
  it('Rockies Day 2 B (the default family): the drive back to the Sunshine car park for the rejoin is drawn', () => {
    const trip = data.getTrip('canadian-rockies-2029')!;
    const t = trip.schedule!.timelines.find((x) => x.day === 2)!;
    const back = t.entries.find((e) => e.kind === 'leg' && e.title === 'Drive to Sunshine Village gondola base car park');
    expect(back).toMatchObject({ start: '14:05', durationMin: 35 });
    expect(t.totals.driveMin).toBe(130);
  });
  it('Dolomites Day 2: back to San Candido between Braies and the 14:00 Val Fiscalina, no long Free time', () => {
    const t = data.getTrip('dolomites-2027')!.schedule!.timelines.find((x) => x.day === 2)!;
    expect(t.entries.filter((e) => e.kind === 'leg').map((e) => e.title)).toEqual(['Drive to Lago di Braies', 'Back to San Candido', 'Drive to Val Fiscalina', 'Back to San Candido']);
    expect(t.entries.some((e) => e.sub === 'free-time' && e.durationMin > 60)).toBe(false);
    expect(t.entries.find((e) => e.title === 'Val Fiscalina')!.start).toBe('14:00');
  });
  it('adults Day 4 A leave Lake Louise at 11:10 for the 12:30 Wilcox Pass', () => {
    const t = scheduleDay(input('canadian-rockies-2029', 4), ADULTS, { variant: 'A' });
    expect(t.entries[0]!.start).toBe('11:10');
    expect(t.entries.some((e) => e.sub === 'free-time')).toBe(false);
  });
});
