import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Profile } from '@travel/core/schedule/types.ts';
import { DEFAULT_CHILD_AGE, landingFor, partyLine, partyShortText } from '@travel/core/trips/party.ts';
import { barWords, effectiveParty, partyFromProfile, sameWho, sharedWords } from '@/components/trips/timeline/partyLogic';

const base: Profile = { party: 'family', youngest: 10, pace: 'standard', adults: 2, walkKm: null, split: false };

describe('the party bar words (spec 5.2)', () => {
  it('reads the plan as written from the profile: one child of the youngest age', () => {
    const party = partyFromProfile(base);
    expect(party).toEqual({ adults: 2, children: [10] });
    expect(barWords(false, party, base, 'standard', false)).toBe('2 adults · 1 child (10) · Standard pace');
    expect(barWords(false, party, base, 'standard', true)).toBe('2 adults · 1 child (10) · Standard');
  });
  it('adults only has no children, whatever the youngest field holds', () => {
    expect(partyFromProfile({ ...base, party: 'adults', youngest: null })).toEqual({ adults: 2, children: [] });
  });
  it('keeps the ages a link cannot carry while the profile still plans the same', () => {
    const work = { adults: 2, children: [7, 10] };
    const p = { ...base, youngest: 7 };
    expect(effectiveParty(work, p)).toBe(work);
    expect(barWords(false, effectiveParty(work, p), p, 'relaxed', false)).toBe('2 adults · 2 children (7, 10) · Relaxed pace');
    // the youngest moved (Back, the copy sheet): the profile's own party stands
    expect(effectiveParty(work, { ...base, youngest: 4 })).toEqual({ adults: 2, children: [4] });
    // the adult count moved
    expect(effectiveParty(work, { ...p, adults: 3 })).toEqual({ adults: 3, children: [7] });
  });
  it('an unset age plans as 10 and the words say it was not set', () => {
    const work = { adults: 1, children: [null] };
    expect(effectiveParty(work, { ...base, adults: 1 })).toBe(work);
    expect(partyLine(work, 'standard')).toBe('1 adult · 1 child (age not set) · Standard pace');
  });
  it('a shared link reads in its own words, and the adults only when they are not 2', () => {
    expect(sharedWords({ ...base, youngest: 6 })).toBe('Shared plan: family, youngest 6');
    expect(sharedWords({ ...base, party: 'adults', youngest: null, adults: 1 })).toBe('Shared plan: adults only, 1 adult');
    expect(barWords(true, partyFromProfile(base), { ...base, youngest: 6 }, 'full', true)).toBe('Shared plan: family, youngest 6 · Full');
  });
  it('sameWho compares the three fields the link carries', () => {
    const other: Profile = { ...base, pace: 'full', walkKm: 5, split: true };
    expect(sameWho(base, other)).toBe(true);
    expect(sameWho(base, { ...base, adults: 3 })).toBe(false);
  });
});

describe('the start chunk\'s implied party', () => {
  it('uses the same unset age as core (ProfileBar cannot import party.ts into the start chunk, so it repeats the number)', () => {
    expect(DEFAULT_CHILD_AGE).toBe(10);
    expect(partyFromProfile({ party: 'family', youngest: null, adults: 2 }).children).toEqual([DEFAULT_CHILD_AGE]);
    expect(readFileSync(new URL('../../components/trips/timeline/ProfileBar.tsx', import.meta.url), 'utf8')).toContain("p.youngest ?? 10] : []");
  });
  it('imports nothing at runtime from core party.ts (Turbopack does not tree-shake it: 1.7 KB gzipped in the start chunk)', () => {
    const src = readFileSync(new URL('../../components/trips/timeline/ProfileBar.tsx', import.meta.url), 'utf8');
    expect(src).not.toMatch(/^import (?!type)[^;]*trips\/party\.ts/m);
    expect(src).not.toMatch(/^import (?!type)[^;]*storage\/(keys|partyKey)/m); // they import party.ts
    expect(src).toContain("from '@/lib/storage/deviceKeys'");
  });
});

describe('chunk boundaries (review UXB-2 S6)', () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
  it('the words module and the tripui module import no party code', () => {
    expect(read('../../../core/src/trips/partyWords.ts')).not.toMatch(/^import (?!type)/m);
    expect(read('../../lib/storage/tripUi.ts')).not.toMatch(/trips\/party\.ts|partyKey/);
    expect(read('../../lib/storage/deviceKeys.ts')).not.toMatch(/^import /m);
  });
  it('the rail and the tab shell import only the light modules', () => {
    expect(read('../../components/trips/timeline/PlanBar.tsx')).not.toMatch(/trips\/party\.ts/);
    expect(read('../../components/trips/tabs/useTripTabs.ts')).not.toMatch(/storage\/(keys|partyKey)/);
  });
});

describe('the landing rule (Q295), as the bar uses it', () => {
  const device = { adults: 2, children: [7, 10] };
  it('applies the kept party to a link with no party keys, and offers it over a shared link', () => {
    const none = landingFor({ query: '?view=day', device, defaults: base, urlProfile: base });
    expect(none.mode).toBe('device');
    expect(none.apply).toEqual({ party: 'family', youngest: 7, adults: 2 });
    const shared = landingFor({ query: '?p=family-6', device, defaults: base, urlProfile: { ...base, youngest: 6 } });
    expect(shared.mode).toBe('shared');
    expect(shared.offer).toEqual(device);
    expect(partyShortText(shared.offer!)).toBe('2 adults, 2 children');
  });
  it('does not apply it again after Plan as written, and never offers a party the link already plans', () => {
    expect(landingFor({ query: '', device, defaults: base, urlProfile: base, asWritten: true }).mode).toBe('written');
    expect(landingFor({ query: '?p=family-7', device, defaults: base, urlProfile: { ...base, youngest: 7 } }).offer).toBeNull();
  });
});
