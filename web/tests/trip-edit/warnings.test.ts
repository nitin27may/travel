import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVELLED_CODES, WARN_LEVEL, warnLevel } from '@travel/core/plan/warnings.ts';
import { WARN_CODE_LIST } from '@travel/core/checks/codes.ts';
import { nearestFit } from '@/components/trips/edit/warnings/useFix';
import { basisOf, collect, countOf, countWords, FIX_OF, fixKindOf, shownLevel } from '@/lib/trip-edit/warnings';

// STEP2-E5 (EA8): the UI reads the level table and meets no code it cannot place.
describe('every code the UI can meet has a level and a handler', () => {
  it('levels every day-check code (the C1 test) and the UI places each one', () => {
    for (const code of WARN_CODE_LIST) {
      expect(Object.hasOwn(WARN_LEVEL, code), `${code} has no level`).toBe(true);
      const l = warnLevel(code);
      const shown = shownLevel({ code, message: 'm' });
      // hidden codes show nowhere; fix and check codes show at their level
      expect(shown, code).toBe(l === 'hidden' ? null : l);
    }
  });
  it('gives every Fix-level code a fix entry (a kind, or null where the check is not built yet)', () => {
    for (const code of LEVELLED_CODES) {
      const v = WARN_LEVEL[code] as string | { rule: string; advice: string };
      const hasFix = typeof v === 'string' ? v === 'fix' : v.rule === 'fix' || v.advice === 'fix';
      if (hasFix) expect(Object.hasOwn(FIX_OF, code), `${code} is Fix level with no fix entry`).toBe(true);
    }
    expect(fixKindOf('W_HOURS')).toBe('move');
    expect(fixKindOf('W_FIT')).toBe('remove');
    expect(fixKindOf('W_PACE')).toBeNull();
  });
  it('keeps W_NO_ROUTE out of what the page offers (not built)', () => {
    expect(fixKindOf('W_NO_ROUTE')).toBeNull();
  });
  it('shows nothing for a code the table does not know, and reads the scheduler notes as To check', () => {
    expect(shownLevel({ code: 'W_FUTURE', message: 'x' })).toBeNull();
    expect(shownLevel({ code: 'S_DAY_CAP', message: 'x' })).toBe('check');
    expect(shownLevel({ code: 'W_FIT_UNKNOWN', message: 'x' })).toBeNull();
    expect(shownLevel({ code: 'W_LEG_DRIFT', message: 'x' })).toBeNull();
  });
});

describe('W_FIT has two levels', () => {
  it('reads an operator rule as Fix and our advice as Check', () => {
    expect(basisOf('W_FIT', 'Raft has a minimum age of 12.')).toBe('rule');
    expect(basisOf('W_FIT', 'Raft is advised for age 12 and up.')).toBe('advice');
    expect(basisOf('W_FIT', "Highline is an adults' hike in this plan; we offer it from age 12.")).toBe('advice');
    expect(basisOf('W_FIT', 'Something we never worded')).toBe('rule');
    expect(basisOf('W_HOURS', 'x')).toBeUndefined();
    expect(shownLevel({ code: 'W_FIT', message: 'Raft has a minimum age of 12.' })).toBe('fix');
    expect(shownLevel({ code: 'W_FIT', message: 'Raft is advised for age 12 and up.' })).toBe('check');
  });
  it('still matches the scheduler wording (validate.ts)', () => {
    const src = readFileSync(new URL('../../../core/src/schedule/validate.ts', import.meta.url), 'utf8');
    expect(src).toContain('has a minimum age of');
    expect(src).toContain('is advised for age');
    expect(src).toContain("is an adults' hike in this plan");
  });
});

describe('counts', () => {
  const ws = collect([
    { day: 2, warnings: [{ code: 'W_PACE', message: 'p', entryId: null, lane: 'all' }, { code: 'W_HOURS', message: 'h', entryId: 'a', lane: 'all' }] },
    { day: 4, warnings: [{ code: 'W_ORDER' as never, message: 'hidden', entryId: null, lane: 'all' }, { code: 'W_FIT', message: 'has a minimum age of 9', entryId: 'b', lane: 'all' }] },
    { day: 5, warnings: [{ code: 'S_DAY_CAP', message: 'long', entryId: null, lane: 'all' }] },
  ]);
  it('collects shown warnings with their level and drops hidden ones', () => {
    expect(ws.map((w) => `${w.day}:${w.code}:${w.level}`)).toEqual(['2:W_PACE:check', '2:W_HOURS:fix', '4:W_FIT:fix', '5:S_DAY_CAP:check']);
  });
  it('counts per level and names the first day to fix', () => {
    const c = countOf(ws);
    expect(c).toEqual({ fix: 2, check: 2, firstFixDay: 2 });
    expect(countWords(c)).toBe('2 to fix · 2 to check');
    expect(countWords({ fix: 0, check: 0 })).toBe('');
    expect(countOf([]).firstFixDay).toBeNull();
  });
});

describe('the move fix', () => {
  const rows = [
    { n: 1, current: false, fit: 'tight' as const, last: 'a' },
    { n: 2, current: false, fit: 'fits' as const, last: 'b' },
    { n: 3, current: true, fit: 'fits' as const, last: 'c' },
    { n: 4, current: false, fit: 'fix' as const, last: 'd' },
    { n: 5, current: false, fit: 'fits' as const, last: 'e' },
  ];
  it('offers the nearest day that fits with no new warning, never the current one', () => {
    expect(nearestFit(rows, 3)).toEqual({ day: 2, after: 'b' });
    expect(nearestFit(rows, 6)).toEqual({ day: 5, after: 'e' });
  });
  it('offers none when no day fits cleanly (the fix is then Remove)', () => {
    expect(nearestFit([{ n: 1, current: false, fit: 'tight', last: null }, { n: 2, current: false, fit: 'fix', last: null }], 3)).toBeNull();
  });
});
