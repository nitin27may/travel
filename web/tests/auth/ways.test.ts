// "Ways to sign in" (GSI-WAYS; copy page 2.5, strings 29 to 51, and section 4's Account column): the pure rules shared by the page,
// the section and the guard. Every string pinned by its key and exact text; the row readers fail closed; the last way in is never
// removable; no input text reaches an output.
import { describe, expect, it } from 'vitest';
import { AUTH_WAYS, GOOGLE_SIGN_IN } from '@travel/core/config/auth-limits.ts';
import { COPY } from '@/lib/auth/auth-errors';
import {
  ADD_RETURN_PARAMS,
  GOOGLE_PERMISSIONS_URL,
  WAYS_COPY,
  addReturnKey,
  addReturnText,
  addStartText,
  addedDate,
  googleJustAdded,
  parseNeonRows,
  parsePublicRows,
  publicRows,
  removalPlan,
  removeText,
  sessionFresh,
  waysView,
} from '@/lib/auth/ways';

const MASKED = 'n…@gmail.com';
const NOW = Date.parse('2026-10-27T10:00:00Z');
const at = (iso: string) => Date.parse(iso);

describe('the copy (strings 29 to 51), exact', () => {
  it.each([
    ['29', WAYS_COPY.title, 'Ways to sign in'],
    ['30', `${WAYS_COPY.email} · ${WAYS_COPY.emailDetail}`, 'Email · A 6-digit code sent to this address'],
    ['31', `${WAYS_COPY.password} · ${WAYS_COPY.passwordDetail}`, 'Password · Set'],
    ['32', `${WAYS_COPY.google} · ${WAYS_COPY.googleAdded('26 Oct 2026')}`, 'Google · Added 26 Oct 2026'],
    ['33', WAYS_COPY.add, 'Add Google'],
    ['34', WAYS_COPY.addHelp(MASKED), 'Sign in with Google as well as your email. Choose the Google account for n…@gmail.com.'],
    ['35', WAYS_COPY.added, 'Google added. You can now sign in with Google or your email.'],
    ['36', WAYS_COPY.addCancelled, "Google wasn't added because you cancelled. You can try again any time."],
    ['37', WAYS_COPY.emailMismatch(MASKED), 'That Google account uses a different email address. Choose the Google account for n…@gmail.com.'],
    ['38', WAYS_COPY.usedElsewhere, 'That Google account already signs in to another account here. To open that account, sign out and continue with Google.'],
    ['39', WAYS_COPY.addFailed, "We couldn't add Google. Try again shortly."],
    ['40', `${WAYS_COPY.remove}${WAYS_COPY.removeTail}`, 'Remove Google'],
    ['41', WAYS_COPY.removeTitle, 'Remove Google?'],
    ['42', WAYS_COPY.removeBody, "You'll sign in with an emailed code instead. Your drafts, copies and favourites stay. Using Continue with Google again later adds it back."],
    ['43', `${WAYS_COPY.removeGoogleSideBefore}${WAYS_COPY.removeGoogleSideLink}${WAYS_COPY.removeGoogleSideAfter}`, 'To stop Google sharing your details with this site, also remove Trip Plans at myaccount.google.com/permissions.'],
    ['44', WAYS_COPY.removeConfirm, 'Remove Google'],
    ['45', WAYS_COPY.removeKeep, 'Keep Google'],
    ['46', WAYS_COPY.removed, 'Google removed. Sign in with an emailed code from now on.'],
    ['47 (first sentence)', WAYS_COPY.removeLast, "Google is the only way in saved on this account, so it can't be removed yet."],
    ['48', WAYS_COPY.removeFailed, "We couldn't remove Google. Try again shortly."],
    ['49', WAYS_COPY.signOutNote, "Signing out here doesn't sign you out of Google on this device."],
    ['50', WAYS_COPY.off, 'Google sign-in is switched off for now. Sign in with an emailed code meanwhile.'],
  ])('%s', (_n, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it('the copy page maxima hold (characters, for a 390 px phone; the address counted as its placeholder, as the copy page does)', () => {
    const MASKED = '{masked}';
    const max: [string, number][] = [
      [WAYS_COPY.title, 15],
      [`${WAYS_COPY.email} · ${WAYS_COPY.emailDetail}`, 45],
      [WAYS_COPY.add, 10],
      [WAYS_COPY.addHelp(MASKED), 85],
      [WAYS_COPY.added, 65],
      [WAYS_COPY.removeTitle, 15],
      [WAYS_COPY.removeBody, 140],
      [WAYS_COPY.removeConfirm, 13],
      [WAYS_COPY.removeKeep, 11],
      [WAYS_COPY.removed, 60],
      [WAYS_COPY.removeLast, 125],
      [WAYS_COPY.signOutNote, 65],
      [WAYS_COPY.off, 80],
    ];
    for (const [text, n] of max) expect(text.length, text).toBeLessThanOrEqual(n);
  });

  it('string 43 links to Google\'s permissions page over HTTPS, and buttons are at most three words (components 2.1)', () => {
    expect(GOOGLE_PERMISSIONS_URL).toBe(`https://${WAYS_COPY.removeGoogleSideLink}`);
    for (const label of [WAYS_COPY.add, WAYS_COPY.remove, WAYS_COPY.removeConfirm, WAYS_COPY.removeKeep]) expect(label.split(' ').length).toBeLessThanOrEqual(3);
  });

  it('no banned technical word in any string (copy page W4)', () => {
    const all = Object.values(WAYS_COPY)
      .map((v) => (typeof v === 'function' ? (v as (s: string) => string)('a minute') : v))
      .join(' ')
      .toLowerCase();
    for (const word of ['oauth', 'provider', 'merge', 'token', 'session', 'origin', 'credential']) expect(all).not.toContain(word);
    expect(all).not.toMatch(/\blink(ed)?\b/);
  });
});

describe('parseNeonRows: Neon\'s list-accounts, read strictly (fail closed)', () => {
  const good = [
    { id: 'row_cred_1', providerId: 'credential', accountId: 'u1', userId: 'u1', createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z', scopes: [] },
    { id: 'row_goog_1', providerId: 'google', accountId: '1098765432101234567', userId: 'u1', createdAt: '2026-10-26T09:00:00.000Z', updatedAt: '2026-10-26T09:00:00.000Z', scopes: ['openid', 'email', 'profile'] },
  ];
  it('reads id, providerId and createdAt; publicRows keeps provider and date only', () => {
    const rows = parseNeonRows(good);
    expect(rows).toEqual([
      { id: 'row_cred_1', providerId: 'credential', createdAt: at('2026-10-01T08:00:00Z') },
      { id: 'row_goog_1', providerId: 'google', createdAt: at('2026-10-26T09:00:00Z') },
    ]);
    const out = JSON.stringify(publicRows(rows!));
    expect(out).not.toMatch(/row_|1098765432101234567|u1|scope|openid/);
    expect(publicRows(rows!)).toEqual([
      { providerId: 'credential', createdAt: at('2026-10-01T08:00:00Z') },
      { providerId: 'google', createdAt: at('2026-10-26T09:00:00Z') },
    ]);
  });
  it('an empty list is a list (an emailed-code account keeps no row)', () => {
    expect(parseNeonRows([])).toEqual([]);
  });
  it.each([
    ['not an array', { accounts: [] }],
    ['null', null],
    ['a row without providerId', [{ id: 'a', createdAt: '2026-10-01T08:00:00Z' }]],
    ['a row without createdAt (UC3 "no")', [{ id: 'a', providerId: 'google' }]],
    ['an unreadable createdAt', [{ id: 'a', providerId: 'google', createdAt: 'yesterday' }]],
    ['a row without id', [{ providerId: 'google', createdAt: '2026-10-01T08:00:00Z' }]],
    ['an id with a slash', [{ id: '../x', providerId: 'google', createdAt: '2026-10-01T08:00:00Z' }]],
    ['a provider that is not a plain token', [{ id: 'a', providerId: 'Google ', createdAt: '2026-10-01T08:00:00Z' }]],
    ['more rows than we understand', Array.from({ length: AUTH_WAYS.maxRows + 1 }, (_, i) => ({ id: `r${i}`, providerId: 'credential', createdAt: '2026-10-01T08:00:00Z' }))],
  ])('%s: null', (_name, raw) => {
    expect(parseNeonRows(raw)).toBeNull();
  });
  it('the guard\'s own answer reads back the same way in the browser', () => {
    expect(parsePublicRows({ accounts: publicRows(parseNeonRows(good)!) })).toEqual(publicRows(parseNeonRows(good)!));
    expect(parsePublicRows([])).toBeNull();
    expect(parsePublicRows({ accounts: [{ providerId: 'google' }] })).toBeNull();
  });
});

describe('waysView: the rows the section shows', () => {
  it('an emailed-code account: Email only', () => {
    expect(waysView([])).toEqual({ password: false, google: null, googleOnly: false });
  });
  it('password and Google: both, with the date Google was first added', () => {
    expect(waysView([{ providerId: 'credential', createdAt: 1 }, { providerId: 'google', createdAt: 5 }, { providerId: 'google', createdAt: 3 }])).toEqual({ password: true, google: 3, googleOnly: false });
  });
  it('Google only: it cannot be removed', () => {
    expect(waysView([{ providerId: 'google', createdAt: 5 }])).toEqual({ password: false, google: 5, googleOnly: true });
  });
  it('a look-alike provider is not Google', () => {
    expect(waysView([{ providerId: 'google-x', createdAt: 5 }]).google).toBeNull();
  });
});

describe('removalPlan: the server never removes the last way in (L6)', () => {
  it('Google beside a password: remove the Google row by its id', () => {
    expect(removalPlan([{ id: 'c', providerId: 'credential', createdAt: 1 }, { id: 'g', providerId: 'google', createdAt: 2 }])).toEqual({ ok: true, ids: ['g'] });
  });
  it('Google only: last_method', () => {
    expect(removalPlan([{ id: 'g', providerId: 'google', createdAt: 2 }])).toEqual({ ok: false, reason: 'last_method' });
    expect(removalPlan([{ id: 'g1', providerId: 'google', createdAt: 2 }, { id: 'g2', providerId: 'google', createdAt: 3 }])).toEqual({ ok: false, reason: 'last_method' });
  });
  it('no Google: not_linked', () => {
    expect(removalPlan([{ id: 'c', providerId: 'credential', createdAt: 1 }])).toEqual({ ok: false, reason: 'not_linked' });
    expect(removalPlan([])).toEqual({ ok: false, reason: 'not_linked' });
  });
  it('more Google rows than one removal clears: refused', () => {
    const many = Array.from({ length: AUTH_WAYS.maxGoogleRows + 1 }, (_, i) => ({ id: `g${i}`, providerId: 'google', createdAt: i }));
    expect(removalPlan([{ id: 'c', providerId: 'credential', createdAt: 0 }, ...many])).toEqual({ ok: false, reason: 'too_many' });
  });
});

describe('sessionFresh: removal needs a sign-in at most a day ago', () => {
  it.each([
    ['an hour ago', '2026-10-27T09:00:00Z', true],
    ['just under a day', new Date(NOW - AUTH_WAYS.removeFreshS * 1000 + 1000).toISOString(), true],
    ['just over a day', new Date(NOW - AUTH_WAYS.removeFreshS * 1000 - 1000).toISOString(), false],
    ['a minute ahead (clock skew)', '2026-10-27T10:01:00Z', true],
    ['an hour ahead', '2026-10-27T11:00:00Z', false],
    ['unreadable', 'soon', false],
    ['missing', undefined, false],
  ])('%s: %s', (_name, createdAt, fresh) => {
    expect(sessionFresh(createdAt, NOW)).toBe(fresh);
  });
});

describe('googleJustAdded: the return of Add Google', () => {
  it('a Google row from the last minutes: yes; older, or none: no', () => {
    expect(googleJustAdded([{ providerId: 'google', createdAt: NOW - 60_000 }], NOW)).toBe(true);
    expect(googleJustAdded([{ providerId: 'google', createdAt: NOW - GOOGLE_SIGN_IN.landingWindowMs - 1 }], NOW)).toBe(false);
    expect(googleJustAdded([{ providerId: 'credential', createdAt: NOW }], NOW)).toBe(false);
  });
});

describe('addedDate: "26 Oct 2026" (d MMM yyyy, UTC)', () => {
  it.each([
    ['2026-10-26T09:00:00Z', '26 Oct 2026'],
    ['2027-01-01T00:00:00Z', '1 Jan 2027'],
    ['2026-12-31T23:59:59Z', '31 Dec 2026'],
  ])('%s', (iso, text) => {
    expect(addedDate(Date.parse(iso))).toBe(text);
  });
});

describe('the Add Google return (section 4, the Account column)', () => {
  it.each([
    ['access_denied', 'addCancelled'],
    ["email_doesn't_match", 'emailMismatch'],
    ['email_does_not_match', 'emailMismatch'],
    ['EMAIL_DOES_NOT_MATCH', 'emailMismatch'],
    ['account_already_linked_to_different_user', 'usedElsewhere'],
    ['unable_to_link_account', 'addFailed'],
    ['state_mismatch', 'addFailed'],
    ['email_not_found', 'addFailed'],
    ['account_not_linked', 'addFailed'],
    ['internal_server_error', 'addFailed'],
    ['', 'addFailed'],
    ['x'.repeat(GOOGLE_SIGN_IN.errorCodeMaxLength + 1), 'addFailed'],
    ['<script>alert(1)</script>', 'addFailed'],
  ])('%s: %s', (code, key) => {
    expect(addReturnKey(code)).toBe(key);
  });
  it('never echoes the code', () => {
    for (const code of ['evil_value_here', '<b>x</b>', 'https://evil.example/', 'nitin@example.com']) expect(addReturnText(code, MASKED)).toBe(WAYS_COPY.addFailed);
    expect(addReturnText('email_does_not_match', MASKED)).toBe(WAYS_COPY.emailMismatch(MASKED));
  });
  it('the return parameters the section removes from the address', () => {
    expect([...ADD_RETURN_PARAMS]).toEqual([AUTH_WAYS.addedParam, 'error', 'error_description', 'neon_auth_session_verifier']);
  });
});

describe('answers of the guard, as the section words them', () => {
  it('Add Google', () => {
    expect(addStartText({ status: 0, code: 'OFFLINE', retryAfterS: null })).toBe(COPY.offline);
    expect(addStartText({ status: 0, code: 'NETWORK', retryAfterS: null })).toBe(WAYS_COPY.addFailed);
    expect(addStartText({ status: 429, code: 'RATE_LIMITED', retryAfterS: 60 })).toBe('Too many attempts. Please wait a minute, then try again.');
    expect(addStartText({ status: 503, code: 'GUARD_UNAVAILABLE', retryAfterS: null })).toBe(WAYS_COPY.addFailed);
  });
  it('Remove', () => {
    expect(removeText({ status: 409, code: 'LAST_METHOD', retryAfterS: null })).toBe(WAYS_COPY.removeLast);
    expect(removeText({ status: 403, code: 'REAUTH_REQUIRED', retryAfterS: null })).toBe(WAYS_COPY.removeSignInAgain);
    expect(removeText({ status: 0, code: 'OFFLINE', retryAfterS: null })).toBe(COPY.offline);
    expect(removeText({ status: 500, code: 'SERVICE_UNAVAILABLE', retryAfterS: null })).toBe(WAYS_COPY.removeFailed);
    expect(removeText({ status: 403, code: 'FORBIDDEN', retryAfterS: null })).toBe(WAYS_COPY.removeFailed);
  });
});
