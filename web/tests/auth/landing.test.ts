// The stop on /account/ after Continue with Google (GSI-2; copy page W3, Q-GC3, strings 23 to 28): which landing the account rows mean.
import { describe, expect, it } from 'vitest';
import { GOOGLE_SIGN_IN } from '@travel/core/config/auth-limits.ts';
import { googleLanding, LANDING_COPY, timeOf } from '@/lib/auth/landing';

const NOW = Date.parse('2026-10-27T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const google = (createdAt: unknown) => ({ id: 'a1', providerId: 'google', accountId: '1234', createdAt });
const land = (userCreatedAt: unknown, accounts: unknown) => googleLanding({ userCreatedAt, accounts, now: NOW });

describe('googleLanding', () => {
  it('new: Google made the account a moment ago and is its only way in (23)', () => {
    expect(land(ago(5_000), [google(ago(4_000))])).toBe('new');
    expect(land(ago(9 * MIN), [google(ago(9 * MIN))])).toBe('new');
    // the row a second before the user (two clocks) is still "with the user"
    expect(land(ago(3_000), [google(ago(4_000))])).toBe('new');
  });
  it('linked: Google added to an account that existed before (25), with or without other rows', () => {
    expect(land(ago(30 * 24 * 60 * MIN), [google(ago(10_000))])).toBe('linked'); // a code-only account has no row of its own
    expect(land(ago(2 * MIN), [{ providerId: 'credential', createdAt: ago(2 * MIN) }, google(ago(10_000))])).toBe('linked');
    // the same user made 5 minutes ago by code, then Google: linked, never "new"
    expect(land(ago(5 * MIN), [google(ago(1 * MIN))])).toBe('linked');
  });
  it('returning: Google is old, or there is no Google row, or Google came with the user long ago (28)', () => {
    expect(land(ago(60 * MIN), [google(ago(60 * MIN))])).toBe('returning');
    expect(land(ago(5 * MIN), [google(ago(GOOGLE_SIGN_IN.landingWindowMs + 1_000))])).toBe('returning');
    expect(land(ago(1 * MIN), [])).toBe('returning');
    expect(land(ago(1 * MIN), [{ providerId: 'credential', createdAt: ago(1 * MIN) }])).toBe('returning');
    // a new Google account that already set a password: not the first landing any more, no notice
    expect(land(ago(2 * MIN), [google(ago(2 * MIN)), { providerId: 'credential', createdAt: ago(1 * MIN) }])).toBe('returning');
  });
  it('the windows come from core config, at their edges', () => {
    const w = GOOGLE_SIGN_IN.landingWindowMs;
    expect(land(ago(w), [google(ago(w))])).toBe('new');
    expect(land(ago(w + 1), [google(ago(w + 1))])).toBe('returning');
    const gap = GOOGLE_SIGN_IN.linkGapMs;
    expect(land(ago(gap + 10_000), [google(ago(10_000))])).toBe('new');
    expect(land(ago(gap + 10_001), [google(ago(10_000))])).toBe('linked');
  });
  it('a time a little ahead of ours counts as now; far ahead does not', () => {
    const ahead = new Date(NOW + 30_000).toISOString();
    expect(land(ahead, [google(ahead)])).toBe('new');
    const far = new Date(NOW + GOOGLE_SIGN_IN.clockSkewMs + 1_000).toISOString();
    expect(land(far, [google(far)])).toBe('returning');
  });
  it('the newest Google row decides', () => {
    expect(land(ago(400 * MIN), [google(ago(300 * MIN)), google(ago(10_000))])).toBe('linked');
  });
  it('a look-alike provider is not Google', () => {
    for (const providerId of ['Google', 'google ', 'GOOGLE', 'google\u0000', 'g00gle']) {
      expect(land(ago(5_000), [{ providerId, createdAt: ago(4_000) }])).toBe('returning');
    }
  });
  it.each([
    ['not an array', { providerId: 'google' }],
    ['null', null],
    ['a string', 'google'],
    ['a row that is not an object', ['google']],
    ['a row without providerId', [{ createdAt: ago(1_000) }]],
    ['a numeric providerId', [{ providerId: 1, createdAt: ago(1_000) }]],
    ['too many rows', Array.from({ length: 51 }, () => google(ago(1_000)))],
  ])('unknown (fail closed) for %s', (_name, accounts) => {
    expect(land(ago(5_000), accounts)).toBe('unknown');
  });
  it.each([
    ['no createdAt', undefined],
    ['garbage', 'yesterday-ish'],
    ['an object', { $date: 1 }],
    ['zero', 0],
    ['NaN', Number.NaN],
    ['an over-long string', `2026-10-27T12:00:00Z${' '.repeat(40)}`],
  ])('unknown when a Google row has %s', (_name, createdAt) => {
    expect(land(ago(5_000), [google(createdAt)])).toBe('unknown');
  });
  it('unknown when the user time cannot be read but there is a recent Google row', () => {
    expect(land(undefined, [google(ago(1_000))])).toBe('unknown');
    expect(land('not a date', [google(ago(1_000))])).toBe('unknown');
  });
  it('reads Date, number and ISO times', () => {
    expect(timeOf(new Date(NOW))).toBe(NOW);
    expect(timeOf(NOW)).toBe(NOW);
    expect(timeOf(new Date(NOW).toISOString())).toBe(NOW);
    expect(timeOf(new Date('nope'))).toBeNull();
    expect(timeOf(-5)).toBeNull();
    expect(timeOf(Infinity)).toBeNull();
  });
});

describe('LANDING_COPY (strings 23 to 27)', () => {
  it('reads exactly as the copy page', () => {
    expect(LANDING_COPY.new('n…@gmail.com')).toBe('Your account is ready. You signed up with Google as n…@gmail.com.');
    expect(LANDING_COPY.newHint).toBe('If you meant to use a different account, sign out and choose another Google account.');
    expect(LANDING_COPY.linked('a…@gmail.com')).toBe(
      'You already had an account for a…@gmail.com, so we added Google to it as a way to sign in. Your drafts are unchanged.',
    );
    expect(LANDING_COPY.linkedUndo).toBe('Not what you wanted? Remove Google');
    expect(LANDING_COPY.continue).toBe('Continue');
    expect(LANDING_COPY.continueTail).toBe(' to the page you were on');
  });
  it('stays inside the copy page maxima (23: 75, 24: 90, 25: 120 with a typical masked address)', () => {
    expect(LANDING_COPY.new('n…@gmail.com').length).toBeLessThanOrEqual(75);
    expect(LANDING_COPY.newHint.length).toBeLessThanOrEqual(90);
    expect(LANDING_COPY.linked('n…@gmail.com').length).toBeLessThanOrEqual(120);
  });
  it('never uses the words the voice note bans', () => {
    const all = [LANDING_COPY.new('x'), LANDING_COPY.newHint, LANDING_COPY.linked('x'), LANDING_COPY.linkedUndo].join(' ').toLowerCase();
    for (const w of ['oauth', 'provider', 'link', 'merge', 'token', 'session', 'credential']) expect(all).not.toContain(w);
  });
});
