// Continue with Google, the pure parts (GSI-1; Google spec 3, 7.4, 10.1 and 10.2; copy page 2.3 and section 8).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GOOGLE_SIGN_IN } from '@travel/core/config/auth-limits.ts';
import { didNotFinish, googleAuthorizeUrl, googleCallbacks, googleStartBody, inAppBrowser, pendingFresh, readReturn } from '@/lib/auth/google';
import { authFlagsFrom } from '@/lib/auth/flags';

const ORIGIN = 'https://travel.test';

describe('googleStartBody: what the card sends (paths only, next checked)', () => {
  it('lands on /account/ with next, and comes back to the starting page with the same next', () => {
    expect(googleStartBody('sign-in', '/places/lake-louise/')).toEqual({ provider: 'google', callbackURL: '/account/?next=%2Fplaces%2Flake-louise%2F', errorCallbackURL: '/sign-in/?next=%2Fplaces%2Flake-louise%2F' });
    expect(googleStartBody('sign-up', '/mine/')).toEqual({ provider: 'google', callbackURL: '/account/?next=%2Fmine%2F', errorCallbackURL: '/sign-up/?next=%2Fmine%2F' });
  });
  it.each([null, '', '//evil.example', 'https://evil.example', '/api/auth/sign-out', '/account/'])('no next for %j', (next) => {
    expect(googleStartBody('sign-in', next)).toEqual({ provider: 'google', callbackURL: '/account/', errorCallbackURL: '/sign-in/' });
  });
});

describe('googleCallbacks: the body the guard sends Neon', () => {
  it('round-trips the card body onto the request origin', () => {
    expect(googleCallbacks(googleStartBody('sign-up', '/places/?kind=trail&season=jul'), ORIGIN)).toEqual({
      provider: 'google',
      callbackURL: `${ORIGIN}/account/?next=${encodeURIComponent('/places/?kind=trail&season=jul')}`,
      errorCallbackURL: `${ORIGIN}/sign-up/?next=${encodeURIComponent('/places/?kind=trail&season=jul')}`,
    });
  });
  it('refuses any provider but Google', () => {
    for (const provider of ['github', 'GOOGLE', 'vercel', '', undefined, ['google']]) expect(googleCallbacks({ provider }, ORIGIN)).toBeNull();
  });
  it.each([
    'https://evil.example/account/?next=%2Ftrips%2F',
    '//evil.example/account/',
    '/account/?next=%2F%2Fevil.example',
    '/account/?next=%252F%252Fevil.example',
    '/account/?next=%2F%5Cevil.example',
    '/account/?next=javascript%3Aalert(1)',
    '/account/?next=%2Fapi%2Fv1%2Fexport',
    `/account/?next=${encodeURIComponent('/trips/' + 'a'.repeat(600))}`,
    `/account/?next=${'x'.repeat(2000)}`,
    'javascript:alert(1)',
    '\u0000/account/',
  ])('drops the next of %j', (callbackURL) => {
    expect(googleCallbacks({ provider: 'google', callbackURL }, ORIGIN)?.callbackURL).toBe(`${ORIGIN}/account/`);
  });
  it('builds the error page from the path only: sign-up or sign-in, never a foreign host', () => {
    const page = (errorCallbackURL: unknown) => googleCallbacks({ provider: 'google', errorCallbackURL }, ORIGIN)?.errorCallbackURL;
    expect(page('/sign-up/?next=%2F%2Fevil')).toBe(`${ORIGIN}/sign-up/`);
    expect(page('https://evil.example/sign-up/')).toBe(`${ORIGIN}/sign-in/`);
    expect(page('/account/')).toBe(`${ORIGIN}/sign-in/`);
    expect(page(undefined)).toBe(`${ORIGIN}/sign-in/`);
  });
});

describe("googleAuthorizeUrl: the card follows only Google's own address", () => {
  it('accepts https on accounts.google.com', () => {
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&scope=openid%20email%20profile&state=s&code_challenge_method=S256';
    expect(googleAuthorizeUrl({ url, redirect: true })).toBe(url);
  });
  it("accepts Neon Auth's own first hop (what production answers, 27 Oct 2026)", () => {
    const url = 'https://ep-quiet-leaf-b4oz2a4v.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth/sign-in/social/init?token=t';
    expect(googleAuthorizeUrl({ url, redirect: true })).toBe(url);
  });
  it.each([
    'http://ep-x.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth/sign-in/social/init?token=t',
    'https://ep-x.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth/get-session',
    'https://neon.tech.evil.example/neondb/auth/sign-in/social/init?token=t',
    'https://evil.example/neondb/auth/sign-in/social/init?token=t',
    'https://user:pw@ep-x.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth/sign-in/social/init',
  ])('refuses a look-alike Neon address %j', (url) => {
    expect(googleAuthorizeUrl({ url })).toBeNull();
  });
  it.each([
    'http://accounts.google.com/o/oauth2/v2/auth',
    'https://accounts.google.com.evil.example/',
    'https://evil.example/?accounts.google.com',
    'https://user:pw@accounts.google.com/',
    'javascript:alert(1)',
    '/account/',
    'https://neon.test/callback/google',
    '',
  ])('refuses %j', (url) => {
    expect(googleAuthorizeUrl({ url })).toBeNull();
  });
  it('refuses a missing body or url', () => {
    expect(googleAuthorizeUrl(null)).toBeNull();
    expect(googleAuthorizeUrl({})).toBeNull();
    expect(googleAuthorizeUrl({ url: 42 })).toBeNull();
  });
});

describe('inAppBrowser: string 8', () => {
  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36 Line/14.0.0',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36 musical_ly_2023',
  ])('finds %s', (ua) => {
    expect(inAppBrowser(ua)).toBe(true);
  });
  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    '',
    null,
  ])('not %j', (ua) => {
    expect(inAppBrowser(ua)).toBe(false);
  });
});

describe('the pending mark and "didn\'t finish" (string 16)', () => {
  const now = 1_800_000_000_000;
  it('a mark counts for 10 minutes and must be a plain time', () => {
    expect(pendingFresh(String(now - 1000), now)).toBe(true);
    expect(pendingFresh(String(now - GOOGLE_SIGN_IN.pendingMaxMs), now)).toBe(true);
    expect(pendingFresh(String(now - GOOGLE_SIGN_IN.pendingMaxMs - 1), now)).toBe(false);
    expect(pendingFresh(String(now + 5000), now)).toBe(false);
    for (const bad of [null, undefined, '', 'yes', '1e12', '-5', 'nitin@example.com']) expect(pendingFresh(bad, now)).toBe(false);
  });
  it('shows only on a return: Back from Google, or a verifier bounced by the proxy; never with an error, never on a fresh visit', () => {
    expect(didNotFinish({ fresh: true, error: null, failedExchange: false, backForward: true })).toBe(true);
    expect(didNotFinish({ fresh: true, error: null, failedExchange: true, backForward: false })).toBe(true);
    expect(didNotFinish({ fresh: true, error: null, failedExchange: false, backForward: false })).toBe(false);
    expect(didNotFinish({ fresh: true, error: 'access_denied', failedExchange: true, backForward: true })).toBe(false);
    expect(didNotFinish({ fresh: false, error: null, failedExchange: true, backForward: true })).toBe(false);
  });
});

describe('readReturn: the address is read once and cleaned', () => {
  it('takes error, error_description and the verifier out; keeps next', () => {
    expect(readReturn('?next=%2Fmine%2F&error=access_denied&error_description=User+denied')).toEqual({ error: 'access_denied', failedExchange: false, cleanSearch: '?next=%2Fmine%2F', changed: true });
    expect(readReturn('?next=%2Fmine%2F&neon_auth_session_verifier=abc')).toEqual({ error: null, failedExchange: true, cleanSearch: '?next=%2Fmine%2F', changed: true });
    expect(readReturn('?error=x')).toEqual({ error: 'x', failedExchange: false, cleanSearch: '', changed: true });
    expect(readReturn('?next=%2Fmine%2F')).toEqual({ error: null, failedExchange: false, cleanSearch: '?next=%2Fmine%2F', changed: false });
    expect(readReturn('')).toEqual({ error: null, failedExchange: false, cleanSearch: '', changed: false });
  });
});

describe('flags: signInGoogle (Google spec 10.1, 11)', () => {
  it('is on only with both NEXT_PUBLIC_SIGN_IN=1 and NEXT_PUBLIC_SIGN_IN_GOOGLE=1', () => {
    expect(authFlagsFrom({ signIn: '1', google: '1' }).signInGoogle).toBe(true);
    expect(authFlagsFrom({ signIn: '', google: '1' }).signInGoogle).toBe(false);
    expect(authFlagsFrom({ signIn: '1', google: '0' }).signInGoogle).toBe(false);
    expect(authFlagsFrom({ signIn: '1' }).signInGoogle).toBe(false);
    expect(authFlagsFrom({ signIn: '1', google: 'true' }).signInGoogle).toBe(false);
  });
  it('does not touch the code flags, and stays out of lib/capabilities.ts (start JS +0 B)', () => {
    expect(authFlagsFrom({ signIn: '1', google: '1' })).toEqual({ signIn: true, signInCode: false, signInLink: false, signInGoogle: true });
    expect(readFileSync(path.resolve(__dirname, '..', '..', 'lib', 'capabilities.ts'), 'utf8')).not.toMatch(/GOOGLE/);
  });
});

describe('pins', () => {
  const web = path.resolve(__dirname, '..', '..');
  it("proxy.ts still matches /account/:path* (the verifier exchange runs only there; Google spec 10.2)", () => {
    expect(readFileSync(path.join(web, 'proxy.ts'), 'utf8')).toMatch(/matcher:\s*\[\s*'\/account\/:path\*'\s*\]/);
  });
  it('no file in web/ reads a user image (Google spec 6.2, 10.1: the profile photo is never read)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (['node_modules', '.next', 'out', 'test-results', 'tests'].includes(name) || name.startsWith('.fixture')) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|mjs)$/.test(name) && /\buser\??\.image\b|\bimage\s*:\s*user\b|['"]image['"]\s*\]/.test(readFileSync(full, 'utf8'))) offenders.push(path.relative(web, full));
      }
    };
    walk(web);
    expect(offenders).toEqual([]);
  });
});
