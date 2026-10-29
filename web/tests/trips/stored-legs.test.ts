// S2D-LEG (DATA-PLAN 2.4, DG-03): every consecutive stop pair of every version of a published Rockies or Dolomites day has a stored leg,
// so no published day falls to the 10 minute local move or the base fallback (which on a transfer day once sent adults Day 4 back
// "via Lake Louise", 5 h 20). The check marks every stored leg with a sentinel distance: a drawn leg without it came from a fallback.
// The car park walk-in is the scheduler's own rule (SW-022), not a leg, and is left out.
import { describe, expect, it } from 'vitest';
import { scheduleDay } from '@travel/core/schedule/schedule.ts';
import { DEFAULT_PROFILE, type Profile, type ScheduleDayInput } from '@travel/core/schedule/types.ts';
import { createPublicData } from '@/lib/public';

const SENTINEL_KM = 777;
const data = createPublicData();
const PROFILES: Profile[] = [
  { ...DEFAULT_PROFILE },
  { ...DEFAULT_PROFILE, split: true },
  { ...DEFAULT_PROFILE, pace: 'relaxed' },
  { ...DEFAULT_PROFILE, pace: 'full' },
  { ...DEFAULT_PROFILE, party: 'family', youngest: 6 },
  { ...DEFAULT_PROFILE, party: 'family', youngest: 10 },
  { ...DEFAULT_PROFILE, party: 'family', youngest: 10, split: true },
];
const marked = (input: ScheduleDayInput): ScheduleDayInput => ({ ...input, legs: input.legs.map((l) => ({ ...l, km: SENTINEL_KM })) });

/** "<trip> day <n> <version>: <from> to <to>" for every drawn leg that no stored row answered. */
function fallbacks(slug: string): string[] {
  const trip = data.getTrip(slug)!;
  const out = new Set<string>();
  for (const d of trip.days) {
    const input = marked(d.scheduleInput!);
    for (const p of PROFILES) {
      for (const v of [null, ...input.variants.map((x) => x.key)]) {
        const t = scheduleDay(input, p, v ? { variant: v } : {});
        for (const e of t.entries) {
          if (e.kind !== 'leg' || e.duration.basis.startsWith('rule: park walk in')) continue;
          if (e.leg?.km !== SENTINEL_KM) out.add(`${slug} day ${d.n} ${t.variant.key}: ${e.from?.name ?? '?'} to ${e.to?.name ?? '?'} (${e.durationMin} min)`);
        }
      }
    }
  }
  return [...out].sort();
}

describe('stored legs on the published days (S2D-LEG)', () => {
  it('the Rockies: every pair of every version has a stored leg', () => {
    expect(fallbacks('canadian-rockies-2029')).toEqual([]);
  });
  it('the Dolomites: every pair of every version has a stored leg', () => {
    expect(fallbacks('dolomites-2027')).toEqual([]);
  });
  it('no published Rockies day drives back through its start base on a transfer day', () => {
    const trip = data.getTrip('canadian-rockies-2029')!;
    for (const d of trip.days) {
      for (const p of PROFILES) {
        for (const v of [null, ...d.scheduleInput!.variants.map((x) => x.key)]) {
          const t = scheduleDay(d.scheduleInput!, p, v ? { variant: v } : {});
          expect(t.entries.filter((e) => e.kind === 'leg' && / via /.test(e.title)).map((e) => `day ${d.n}: ${e.title}`)).toEqual([]);
        }
      }
    }
  });
  it('adults Day 4 (Wilcox Pass) reaches Jasper in about an hour and a half, not 5 h 20', () => {
    const d4 = data.getTrip('canadian-rockies-2029')!.days.find((d) => d.n === 4)!;
    const t = scheduleDay(d4.scheduleInput!, { ...DEFAULT_PROFILE }, { variant: 'A' });
    const toJasper = t.entries.filter((e) => e.kind === 'leg' && e.to?.name === 'Jasper' && e.leg?.mode === 'drive');
    const minutes = toJasper.reduce((n, e) => n + e.durationMin, 0);
    expect(minutes).toBeGreaterThanOrEqual(80);
    expect(minutes).toBeLessThanOrEqual(110);
    expect(toJasper.every((e) => e.honesty.includes('drive_estimated'))).toBe(true);
  });
});
