// The return from Google on our side (review GSI-S S6 and S7). The SDK's verifier exchange runs in proxy.ts on /account/*; Neon decides
// whether a verifier belongs to the challenge cookie that came with it. These tests drive the real proxy.ts and the SDK's real
// middleware (`processAuthMiddleware`, mapped to answers the way its Next adapter does), with a fake Neon that binds each verifier to
// one challenge cookie, so they pin what our side does with each answer: R3b (a verifier from browser A with browser B's challenge
// cookie gives B no session) and the bounce to /sign-in/ with the verifier's value emptied (S7). Whether the real Neon binds the two is
// GSI-E's R3b on the HTTPS preview.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME, NEON_AUTH_SESSION_COOKIE_NAME, processAuthMiddleware } from '@neondatabase/auth/server';
import { readReturn } from '@/lib/auth/google';
import { scrubVerifierRedirect, VERIFIER_PARAM, withoutVerifierValue } from '@/lib/auth/verifier';

const BASE = 'https://neon.test/neondb/auth';
const COOKIE_SECRET = 'a-cookie-secret-that-is-at-least-32-characters-long';

vi.mock('@/lib/server/neon-env', () => ({ authConfigured: () => true }));
vi.mock('@/lib/auth/server', () => ({
  getAuth: () => ({
    middleware:
      ({ loginUrl }: { loginUrl: string }) =>
      async (request: NextRequest) => {
        const result = await processAuthMiddleware({ request, pathname: request.nextUrl.pathname, skipRoutes: [], loginUrl, baseUrl: BASE, cookieSecret: COOKIE_SECRET });
        const headers = new Headers();
        for (const c of ('cookies' in result && result.cookies) || []) headers.append('Set-Cookie', c);
        if (result.action === 'allow') return NextResponse.next({ headers });
        return NextResponse.redirect(result.redirectUrl, { headers });
      },
  }),
}));

import proxy from '@/proxy';

/** What the fake Neon saw on each exchange: the verifier in the query and the challenge cookie. */
let exchanges: { verifier: string | null; challenge: string | null }[] = [];
/** Neon's binding: the one challenge cookie each verifier was issued with (browser A's flow). */
const ISSUED: Record<string, string> = { 'verifier-of-a': 'challenge-of-a' };

function challengeOf(cookie: string | null): string | null {
  const m = new RegExp(`${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME.replace(/\./g, '\\.')}=([^;]+)`).exec(cookie ?? '');
  return m?.[1] ?? null;
}

beforeEach(() => {
  exchanges = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.host !== 'neon.test') throw new Error(`unexpected fetch to ${url.host}`);
    const verifier = url.searchParams.get(VERIFIER_PARAM);
    const challenge = challengeOf(new Headers(init.headers).get('cookie'));
    exchanges.push({ verifier, challenge });
    if (verifier && ISSUED[verifier] === challenge) {
      return Response.json(
        { session: { id: 's1', userId: 'u1', expiresAt: '2026-11-25T10:00:00Z' }, user: { id: 'u1', email: 'a@example.test' } },
        { headers: { 'set-cookie': `${NEON_AUTH_SESSION_COOKIE_NAME}=token-of-a; Path=/; HttpOnly; Secure; SameSite=Lax` } },
      );
    }
    return Response.json(null, { status: 401 });
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const back = (verifier: string, challenge: string) =>
  new NextRequest(`https://travel.test/account/?next=%2Fmine%2F&${VERIFIER_PARAM}=${verifier}`, {
    headers: { cookie: `${NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME}=${challenge}` },
  });

const sessionCookies = (res: Response) => res.headers.getSetCookie().filter((c) => c.startsWith(`${NEON_AUTH_SESSION_COOKIE_NAME}=`) && !/Max-Age=0/i.test(c));

describe('R3b: a verifier from one browser with another browser\'s challenge cookie (review GSI-S S6)', () => {
  it('gives browser B no session, and sends it to /sign-in/ without the verifier value', async () => {
    const res = (await proxy(back('verifier-of-a', 'challenge-of-b'))) as Response;
    // The exchange reached Neon with A's verifier and B's own cookie, so Neon could tell they do not belong together.
    expect(exchanges[0]).toEqual({ verifier: 'verifier-of-a', challenge: 'challenge-of-b' });
    expect(sessionCookies(res)).toEqual([]);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const to = new URL(res.headers.get('location') as string);
    expect(to.pathname).toBe('/sign-in/');
    expect(to.search).not.toContain('verifier-of-a');
    expect(to.searchParams.get(VERIFIER_PARAM)).toBe('');
    expect(to.searchParams.get('next')).toBe('/mine/');
    // The card still reads it as a failed exchange ("didn't finish", string 16).
    expect(readReturn(to.search).failedExchange).toBe(true);
  });

  it('browser A with its own challenge cookie gets the session and lands on /account/ without the verifier', async () => {
    const res = (await proxy(back('verifier-of-a', 'challenge-of-a'))) as Response;
    expect(sessionCookies(res)).toHaveLength(1);
    const to = new URL(res.headers.get('location') as string);
    expect(to.pathname).toBe('/account/');
    expect(to.searchParams.has(VERIFIER_PARAM)).toBe(false);
    expect(to.searchParams.get('next')).toBe('/mine/');
  });

  it('a verifier with no challenge cookie at all never reaches Neon, and bounces without its value (R3)', async () => {
    const res = (await proxy(new NextRequest(`https://travel.test/account/?${VERIFIER_PARAM}=verifier-of-a`))) as Response;
    expect(exchanges).toEqual([]);
    expect(sessionCookies(res)).toEqual([]);
    expect(res.headers.get('location')).not.toContain('verifier-of-a');
  });

  it('leaves a server action alone', async () => {
    const r = new NextRequest('https://travel.test/account/', { method: 'POST', headers: { 'next-action': 'x' } });
    expect(await proxy(r)).toBeUndefined();
  });
});

describe('the verifier scrub (review GSI-S S7)', () => {
  it('empties the verifier value, keeping the parameter and everything else', () => {
    expect(withoutVerifierValue(`/sign-in/?next=%2Fmine%2F&${VERIFIER_PARAM}=abc`, 'https://travel.test/account/')).toBe(
      `https://travel.test/sign-in/?next=%2Fmine%2F&${VERIFIER_PARAM}=`,
    );
    expect(withoutVerifierValue(`https://travel.test/sign-in/?${VERIFIER_PARAM}=a&${VERIFIER_PARAM}=b`, 'https://travel.test/')).toBe(`https://travel.test/sign-in/?${VERIFIER_PARAM}=`);
  });

  it('changes nothing without a verifier value', () => {
    expect(withoutVerifierValue('/sign-in/?next=%2F', 'https://travel.test/')).toBeNull();
    expect(withoutVerifierValue(`/sign-in/?${VERIFIER_PARAM}=`, 'https://travel.test/')).toBeNull();
    const ok = new Response('x', { status: 200 });
    expect(scrubVerifierRedirect(ok, 'https://travel.test/')).toBe(ok);
    expect(scrubVerifierRedirect(undefined, 'https://travel.test/')).toBeUndefined();
  });

  it('rewrites an immutable redirect too, keeping its cookies', () => {
    const r = Response.redirect(`https://travel.test/sign-in/?${VERIFIER_PARAM}=abc`, 307);
    const out = scrubVerifierRedirect(r, 'https://travel.test/');
    expect(out.status).toBe(307);
    expect(out.headers.get('location')).toBe(`https://travel.test/sign-in/?${VERIFIER_PARAM}=`);
  });
});
