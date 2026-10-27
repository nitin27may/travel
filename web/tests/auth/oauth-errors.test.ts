// The Google copy and code map (GSI-1; copy page docs/v2/design/shell/google-sign-in-copy-2026-10-26.md, strings 1 to 22 and section 4).
// Every string is pinned by its key and exact words; no input text ever reaches the page (Google spec 4.6, 10.1).
import { describe, expect, it } from 'vitest';
import { COPY } from '@/lib/auth/auth-errors';
import { GOOGLE_COPY, googleRateLimited, googleReturnKey, googleReturnNotice, googleStartNotice } from '@/lib/auth/oauth-errors';

describe('GOOGLE_COPY: the exact words of strings 1 to 22', () => {
  it.each([
    ['button', 'Continue with Google'],
    ['divider', 'or'],
    ['consent', 'Google shares your name, email address and profile photo link with us. Never your password or contacts.'],
    ['consentLink', 'What we keep'],
    ['hostNote', "Google's screen may show neon.tech, the service that runs our sign-in."],
    ['lastUsed', 'Last used on this browser'],
    ['flagOff', "Continue with Google is switched off for now. Enter the same email address and we'll email you a code."],
    ['inApp', "Google doesn't allow sign-in inside this app's browser. Open this page in Safari or Chrome, or use your email below."],
    ['opening', 'Opening Google.'],
    ['startFailed', "We couldn't open Google. Try again, or use your email below."],
    ['cancelled', 'You cancelled signing in with Google. Try again, or use your email below.'],
    ['didNotFinish', "Signing in with Google didn't finish. Try again. If this keeps happening, allow cookies for this site, or use your email below."],
    ['restart', 'That sign-in took too long or was started in another tab. Please start again.'],
    ['noEmail', "Google didn't share an email address, so we couldn't sign you in. Try again and allow it, or use your email below."],
    ['emailUnconfirmed', "Google hasn't confirmed the email address on that Google account. Confirm it with Google first, or use your email below."],
    ['accountExists', "There's already an account here for this email. Sign in with your email first, then add Google on your account page."],
    ['signUpClosed', "New accounts can't be created right now. Everything on this site works without one."],
    ['unavailable', "Google sign-in isn't working right now. Try again shortly, or use your email below."],
  ] as const)('%s', (key, text) => {
    expect(GOOGLE_COPY[key]).toBe(text);
  });

  it('string 9 (cookies) and 12 (offline) are the card-wide copy', () => {
    expect(COPY.cookiesOff).toBe('Your browser is blocking cookies for this site. Sign-in needs them to keep you signed in.');
    expect(COPY.offline).toBe("You're offline. Sign-in needs a connection.");
  });

  it('never uses the words the voice note forbids (W4), and keeps every banner within three phone lines', () => {
    // The copy page's per-string maxima are estimates (two of its own strings are one or two over); the hard limits are these: the button
    // on one line at 320 px, the last-used line, and no banner over about three phone lines.
    expect(GOOGLE_COPY.button.length).toBeLessThanOrEqual(20);
    expect(GOOGLE_COPY.lastUsed.length).toBeLessThanOrEqual(26);
    for (const [key, text] of Object.entries(GOOGLE_COPY)) expect(text.length, key).toBeLessThanOrEqual(130);
    const all = Object.values(GOOGLE_COPY).join(' ').toLowerCase();
    for (const word of ['oauth', 'provider', 'merge', 'token', 'session', 'origin', 'credential', 'authenticate', 'oops', 'sorry', '!']) expect(all).not.toContain(word);
  });
});

describe('googleReturnKey: section 4, the card column', () => {
  it.each([
    ['access_denied', 'cancelled'],
    ['state_mismatch', 'restart'],
    ['state_not_found', 'restart'],
    ['please_restart_the_process', 'restart'],
    ['invalid_code', 'restart'],
    ['no_code', 'restart'],
    ['email_not_found', 'noEmail'],
    ['email_not_verified', 'emailUnconfirmed'],
    ['account_not_linked', 'accountExists'],
    ['ACCOUNT_NOT_LINKED', 'accountExists'],
    ['signup_disabled', 'signUpClosed'],
    ["email_doesn't_match", 'unavailable'],
    ['account_already_linked_to_different_user', 'unavailable'],
    ['unable_to_link_account', 'unavailable'],
    ['unable_to_get_user_info', 'unavailable'],
    ['unable_to_create_user', 'unavailable'],
    ['unable_to_create_session', 'unavailable'],
    ['internal_server_error', 'unavailable'],
    ['made_up', 'unavailable'],
  ] as const)('%s maps to %s', (code, key) => {
    expect(googleReturnKey(code)).toBe(key);
  });

  it.each([[''], ['x'.repeat(65)], ['access_denied<script>'], ['access denied'], ['%61ccess_denied'], [null], [undefined], [42], [['access_denied']], ['__proto__'], ['constructor'], ['toString']])(
    '%j falls to the fallback',
    (raw) => {
      expect(googleReturnKey(raw)).toBe('unavailable');
    },
  );

  it('never echoes the input: a fuzz of hostile values only ever yields one of the fixed strings', () => {
    const fixed = new Set(Object.values(GOOGLE_COPY));
    const hostile = ['<img src=x onerror=alert(1)>', 'javascript:alert(1)', 'nitin@example.com', 'https://evil.example/', "'; drop table", 'access_denied\u0000', 'ACCESS_DENIED_AND_MORE', '../../etc', 'a'.repeat(5000)];
    for (let i = 0; i < 200; i++) hostile.push(Array.from({ length: (i % 70) + 1 }, (_, j) => String.fromCharCode(33 + ((i * 31 + j * 7) % 94))).join(''));
    for (const raw of hostile) {
      const n = googleReturnNotice(raw);
      expect(fixed.has(n.message as (typeof GOOGLE_COPY)[keyof typeof GOOGLE_COPY])).toBe(true);
      if (raw.length > 3) expect(n.message).not.toContain(raw);
    }
  });

  it('string 20 moves focus to the email field; every return banner is a notice', () => {
    expect(googleReturnNotice('account_not_linked')).toEqual({ tone: 'notice', message: GOOGLE_COPY.accountExists, focusEmail: true });
    expect(googleReturnNotice('access_denied')).toEqual({ tone: 'notice', message: GOOGLE_COPY.cancelled, focusEmail: undefined });
  });
});

describe('the start call (strings 12 to 14)', () => {
  it('offline: the offline banner, no call (12)', () => {
    expect(googleStartNotice({ status: 0, code: 'OFFLINE', retryAfterS: null })).toEqual({ tone: 'offline', message: COPY.offline });
  });
  it('a network failure or a 200 without Google address: "We couldn\'t open Google" (13)', () => {
    expect(googleStartNotice({ status: 0, code: 'NETWORK', retryAfterS: null }).message).toBe(GOOGLE_COPY.startFailed);
    expect(googleStartNotice({ status: 200, code: '', retryAfterS: null }).message).toBe(GOOGLE_COPY.startFailed);
  });
  it('a 429: urgent, with the wait (14)', () => {
    expect(googleStartNotice({ status: 429, code: 'RATE_LIMITED', retryAfterS: 30 })).toEqual({ tone: 'urgent', message: 'Please wait a minute, then try again, or use your email below.' });
    expect(googleRateLimited(900)).toBe('Too many sign-in attempts. Wait 15 minutes, then try again, or use your email below.');
    expect(googleRateLimited(null)).toBe('Please wait a minute, then try again, or use your email below.');
  });
  it('a 404 (flag off on the server), 403 or 5xx: the fallback (22), never the cause', () => {
    for (const status of [400, 403, 404, 500, 502, 503]) expect(googleStartNotice({ status, code: 'FORBIDDEN', retryAfterS: null }).message).toBe(GOOGLE_COPY.unavailable);
  });
});
