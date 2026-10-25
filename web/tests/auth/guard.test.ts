// Route tests for the auth guard (EML-Q; email spec 13 acceptance and 14). They drive the real route handler and the real Neon Auth SDK
// proxy; only the network is fake: a stubbed global fetch plays Neon Auth (it records exactly what the proxy forwards) and Cloudflare's
// siteverify (with the published test secrets and live-style answers). The quota store is the in-memory one with the semantics of
// quota_take(), the mailer the outbox, and session revocation a spy. Every console line is captured and scanned at the end.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_LIMITS } from '@travel/core/config/auth-limits.ts';
import { createOutboxMailer, ownerOnly, type Mailer, type Outbox } from '@travel/core/mail/index.ts';
import { createMemoryQuotaStore, type MemoryQuotaStore } from '@travel/core/quota/memory.ts';

const state = vi.hoisted(() => ({
  store: null as unknown as MemoryQuotaStore,
  mailer: null as unknown as Mailer,
  revoke: (async () => 0) as (email: string, before: Date) => Promise<number>,
}));

vi.mock('@travel/core/quota/pg.ts', () => ({
  createPgQuotaStore: () => ({
    take: (rules: never) => state.store.take(rules),
    peek: (b: string, w: number, at: Date) => state.store.peek(b, w, at),
  }),
}));
vi.mock('@/lib/auth/revoke', () => ({ revokeSessionsBefore: (email: string, before: Date) => state.revoke(email, before) }));
vi.mock('@/lib/server/mailer', () => ({ getMailer: () => state.mailer, ownerEmail: () => process.env.OWNER_EMAIL }));
// The SDK's Next entry imports `next/headers`, which does not load outside Next. Its route handler is a thin wrapper over the
// framework-agnostic proxy below (`authApiHandler` in @neondatabase/auth/next/server), so the test builds the same handler from it.
vi.mock('@/lib/auth/server', async () => {
  const { handleAuthProxyRequest } = await import('@neondatabase/auth/server');
  const handler = async (request: Request, { params }: { params: Promise<{ path: string[] }> }) =>
    handleAuthProxyRequest({
      request,
      path: (await params).path.join('/'),
      baseUrl: process.env.NEON_AUTH_BASE_URL as string,
      cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET as string,
    });
  return { getAuth: () => ({ handler: () => ({ GET: handler, POST: handler }) }) };
});

import { GET, POST } from '@/app/api/auth/[...path]/route';

const OWNER = 'owner@example.test';
const TEST_PASS = '1x0000000000000000000000000000000AA';
const TEST_FAIL = '2x0000000000000000000000000000000AA';
const TEST_SPENT = '3x0000000000000000000000000000000AA';
const LIVE = 'live-turnstile-secret-for-tests';
const CODE = '482913';

// ----- fake network ----------------------------------------------------------------------------------------------------------------

type NeonCall = { path: string; body: Record<string, unknown> | null; headers: Headers };
let neonCalls: NeonCall[] = [];
let neon: (path: string, body: Record<string, unknown> | null) => Response | Promise<Response>;
let cloudflare: (form: URLSearchParams) => Response | Promise<Response>;
let cfCalls: URLSearchParams[] = [];

const cfPass = () => Response.json({ success: true, 'error-codes': [], hostname: 'travel.test', action: 'auth_send', challenge_ts: '2026-10-25T10:00:00Z' });
/** What Cloudflare answers for its published test secrets (probed 25 Oct 2026). */
function cfTestKeys(form: URLSearchParams): Response {
  const s = form.get('secret');
  if (s === TEST_PASS) return Response.json({ success: true, 'error-codes': [], hostname: 'example.com', metadata: { result_with_testing_key: true } });
  if (s === TEST_SPENT) return Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] });
  if (s === TEST_FAIL) return Response.json({ success: false, 'error-codes': ['invalid-input-response'] });
  return cfPass();
}

const logs: string[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-25T10:00:30Z'));
  state.store = createMemoryQuotaStore();
  const box = createOutboxMailer({});
  outbox = box;
  state.mailer = ownerOnly(box, { ownerEmail: OWNER, mailFrom: undefined });
  state.revoke = vi.fn(async () => 2);
  neonCalls = [];
  cfCalls = [];
  neon = () => Response.json({ success: true });
  cloudflare = cfTestKeys;
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('NEON_AUTH_BASE_URL', 'https://neon.test/neondb/auth');
  vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'a-cookie-secret-that-is-at-least-32-characters-long');
  vi.stubEnv('DATABASE_URL', 'postgres://fake/db');
  vi.stubEnv('AUTH_QUOTA_SECRET', 'quota-secret-0123456789abcdef');
  vi.stubEnv('TURNSTILE_SECRET_KEY', TEST_PASS);
  vi.stubEnv('OWNER_EMAIL', OWNER);
  vi.stubEnv('AUTH_GUARD', '');
  vi.stubGlobal('fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.host === 'challenges.cloudflare.com') {
      const form = new URLSearchParams(String(init.body));
      cfCalls.push(form);
      return cloudflare(form);
    }
    if (url.host === 'neon.test') {
      const path = url.pathname.replace(/^\/neondb\/auth\//, '');
      const text = typeof init.body === 'string' ? init.body : '';
      const body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      if (path === 'get-session') return Response.json(null);
      neonCalls.push({ path, body, headers: new Headers(init.headers) });
      return neon(path, body);
    }
    throw new Error(`unexpected fetch to ${url.host}`);
  });
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    });
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

let outbox: Outbox;

// ----- helpers ---------------------------------------------------------------------------------------------------------------------

const ctx = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });

function req(path: string, body: unknown, headers: Record<string, string> = {}, method = 'POST'): Request {
  return new Request(`https://travel.test/api/auth/${path}/`, {
    method,
    headers: {
      origin: 'https://travel.test',
      host: 'travel.test',
      'content-type': 'application/json',
      'x-turnstile-token': 'XXXX.DUMMY.TOKEN.XXXX',
      'x-real-ip': '203.0.113.7',
      'user-agent': 'vitest',
      ...headers,
    },
    body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const call = (path: string, body: unknown, headers: Record<string, string> = {}) => POST(req(path, body, headers), ctx(path));
const sendCode = (email: string, headers: Record<string, string> = {}) => call('email-otp/send-verification-otp', { email, type: 'sign-in' }, headers);
const at = (iso: string) => vi.setSystemTime(new Date(iso));

/** Status, body and headers (without the date) of an answer, for "identical" comparisons. */
async function shape(res: Response) {
  const headers = [...res.headers.entries()].filter(([k]) => k !== 'date').sort();
  return { status: res.status, body: await res.text(), headers };
}

// ----- tests -----------------------------------------------------------------------------------------------------------------------

describe('forwarding and rewriting', () => {
  it('trims and lower-cases the address, and keeps the Turnstile token and client IP away from Neon', async () => {
    const res = await sendCode('  Visitor@Example.TEST ');
    expect(res.status).toBe(200);
    expect(neonCalls).toHaveLength(1);
    expect(neonCalls[0].path).toBe('email-otp/send-verification-otp');
    expect(neonCalls[0].body).toEqual({ email: 'visitor@example.test', type: 'sign-in' });
    expect(neonCalls[0].headers.get('x-turnstile-token')).toBeNull();
    expect(neonCalls[0].headers.get('x-real-ip')).toBeNull();
    expect(neonCalls[0].headers.get('origin')).toBe('https://travel.test');
  });

  it.each([
    ['email-otp/send-verification-otp', { type: 'sign-in' }],
    ['email-otp/send-verification-otp', { type: 'email-verification' }],
    ['email-otp/send-verification-otp', { type: 'forget-password' }],
    ['email-otp/request-password-reset', {}],
  ])('%s %j answers the same for a known and an unknown address', async (path, extra) => {
    // Neon is made to answer differently for the two addresses; the client must not see it.
    neon = (_p, body) =>
      body?.email === 'known@example.test'
        ? Response.json({ success: true, user: { id: 'u1', role: 'user' } }, { headers: { 'x-neon-ret-request-id': 'r1' } })
        : Response.json({ success: true });
    const known = await shape(await call(path, { email: 'known@example.test', ...extra }));
    at('2026-10-25T10:02:30Z');
    const unknown = await shape(await call(path, { email: 'unknown@example.test', ...extra }));
    expect(known).toEqual(unknown);
    expect(known.status).toBe(200);
    expect(JSON.parse(known.body)).toEqual({ success: true });
  });

  it('sign-up answers the same for a new and an existing address (Require Verification on, EML-0 U8)', async () => {
    neon = (_p, body) =>
      Response.json({
        token: null,
        user: { id: 'x', email: body?.email, emailVerified: false, role: body?.email === 'new@example.test' ? 'user' : null },
      });
    const fresh = await shape(await call('sign-up/email', { email: 'new@example.test', password: 'a-long-password', name: '' }));
    at('2026-10-25T10:02:30Z');
    const existing = await shape(await call('sign-up/email', { email: 'old@example.test', password: 'a-long-password', name: '' }));
    expect(fresh).toEqual(existing);
    expect(JSON.parse(fresh.body)).toEqual({ token: null, user: null });
    // Only the new account made Neon send a code.
    const sent = state.store.rows().find((r) => r.bucket === 'auth:metric:sent');
    expect(sent?.count).toBe(1);
  });

  it('sign-up maps 422 USER_ALREADY_EXISTS (Require Verification off) to the same pending answer', async () => {
    neon = () => Response.json({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', message: 'User already exists. Use another email.' }, { status: 422 });
    const res = await call('sign-up/email', { email: 'old@example.test', password: 'a-long-password', name: '' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: null, user: null });
  });

  it('sign-up with Require Verification off passes a new session through (nothing else is possible before O-E1)', async () => {
    neon = () =>
      new Response(JSON.stringify({ token: 'tok', user: { id: 'u' } }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'set-cookie': '__Secure-neon-auth.session_token=abc; Path=/; HttpOnly; Secure' },
      });
    const res = await call('sign-up/email', { email: 'new@example.test', password: 'a-long-password', name: '' });
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().some((c) => c.startsWith('__Secure-neon-auth.session_token=abc'))).toBe(true);
  });

  it('a successful reset by code signs out the older sessions of that account', async () => {
    neon = () => Response.json({ status: true });
    const res = await call('email-otp/reset-password', { email: ' Visitor@Example.test', otp: CODE, password: 'a-new-long-password' });
    expect(res.status).toBe(200);
    expect(state.revoke).toHaveBeenCalledTimes(1);
    const [email, before] = (state.revoke as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Date];
    expect(email).toBe('visitor@example.test');
    expect(before.toISOString()).toBe('2026-10-25T10:00:30.000Z');
    expect(state.store.rows().find((r) => r.bucket === 'auth:metric:verified')?.count).toBe(1);
  });

  it('a failed reset revokes nothing', async () => {
    neon = () => Response.json({ code: 'INVALID_OTP', message: 'Invalid OTP' }, { status: 400 });
    const res = await call('email-otp/reset-password', { email: 'v@example.test', otp: '000000', password: 'a-new-long-password' });
    expect(res.status).toBe(400);
    expect(state.revoke).not.toHaveBeenCalled();
  });

  it('when revocation fails the reset still answers 200, and the owner is alerted', async () => {
    neon = () => Response.json({ status: true });
    state.revoke = vi.fn(async () => {
      throw new Error('db down');
    });
    const res = await call('email-otp/reset-password', { email: 'v@example.test', otp: CODE, password: 'a-new-long-password' });
    expect(res.status).toBe(200);
    expect(outbox.sent.map((m) => m.subject)).toEqual(['[Trip Plans alert] Sessions not revoked after a reset']);
  });

  it('passes Neon code errors through on verify, and counts a verified code', async () => {
    neon = (_p, body) => (body?.otp === CODE ? Response.json({ token: 't', user: { id: 'u' } }) : Response.json({ code: 'INVALID_OTP', message: 'Invalid OTP' }, { status: 400 }));
    const bad = await call('sign-in/email-otp', { email: 'v@example.test', otp: '000000' });
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe('INVALID_OTP');
    const good = await call('sign-in/email-otp', { email: 'v@example.test', otp: CODE });
    expect(good.status).toBe(200);
    expect(state.store.rows().find((r) => r.bucket === 'auth:metric:verified')?.count).toBe(1);
  });

  it("keeps a Retry-After on Neon's own 429 (the SDK proxy drops x-retry-after)", async () => {
    neon = () => new Response(JSON.stringify({ message: 'Too many requests. Please try again later.' }), { status: 429, headers: { 'x-retry-after': '10' } });
    const res = await call('sign-in/email', { email: 'v@example.test', password: 'wrong-password' });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('10');
  });

  it('passes unguarded routes straight through (get-session, sign-out)', async () => {
    neon = () => Response.json({ success: true });
    const res = await POST(req('sign-out', {}, { 'x-turnstile-token': '' }), ctx('sign-out'));
    expect(res.status).toBe(200);
    expect(neonCalls.map((c) => c.path)).toEqual(['sign-out']);
    const s = await GET(req('get-session', null, {}, 'GET'), ctx('get-session'));
    expect(s.status).toBe(200);
  });
});

describe('refusals before Neon', () => {
  it('refuses a foreign Origin before any quota is used or Neon is called', async () => {
    const res = await sendCode('v@example.test', { origin: 'https://evil.test' });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('FORBIDDEN');
    expect(neonCalls).toHaveLength(0);
    expect(cfCalls).toHaveLength(0);
    expect(state.store.rows()).toHaveLength(0);
  });

  it('refuses a body over 4 KB, bad JSON, a bad address, and a type that is not offered', async () => {
    const big = await call('sign-in/email', { email: 'v@example.test', password: 'x'.repeat(5000) });
    expect(big.status).toBe(413);
    expect((await call('sign-in/email', 'not json')).status).toBe(400);
    expect((await call('sign-in/email', '[1,2]')).status).toBe(400);
    const bad = await sendCode('not an address');
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe('INVALID_EMAIL');
    expect((await call('email-otp/send-verification-otp', { email: 'v@example.test', type: 'change-email' })).status).toBe(400);
    expect(neonCalls).toHaveLength(0);
  });

  it.each(['reset-password', 'reset-password/some-token', 'change-email', 'email-otp/request-email-change', 'email-otp/change-email'])(
    'blocks %s (not offered in v1)',
    async (path) => {
      const res = await POST(req(path, { email: 'v@example.test', newEmail: 'w@example.test' }), ctx(path));
      expect(res.status).toBe(404);
      expect(neonCalls).toHaveLength(0);
    },
  );

  it('guards a route whatever its case', async () => {
    const res = await POST(req('Email-OTP/Send-Verification-OTP', { email: 'v@example.test', type: 'change-email' }), ctx('Email-OTP/Send-Verification-OTP'));
    expect(res.status).toBe(400);
  });
});

describe('Turnstile', () => {
  it('passes with the always-pass test secret and sends the token and client IP to Cloudflare', async () => {
    expect((await sendCode('v@example.test')).status).toBe(200);
    expect(cfCalls).toHaveLength(1);
    expect(cfCalls[0].get('response')).toBe('XXXX.DUMMY.TOKEN.XXXX');
    expect(cfCalls[0].get('remoteip')).toBe('203.0.113.7');
  });

  it.each([
    [TEST_FAIL, 403, 'TURNSTILE_FAILED'],
    [TEST_SPENT, 403, 'TURNSTILE_FAILED'],
  ])('refuses with %s', async (secret, status, code) => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', secret);
    const res = await sendCode('v@example.test');
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
    expect(neonCalls).toHaveLength(0);
    expect(state.store.rows()).toHaveLength(0);
  });

  it('refuses a missing token', async () => {
    const res = await sendCode('v@example.test', { 'x-turnstile-token': '' });
    expect(res.status).toBe(403);
    expect(cfCalls).toHaveLength(0);
  });

  it.each([
    ['wrong hostname', () => Response.json({ success: true, hostname: 'evil.test', action: 'auth_send' }), 403],
    ['wrong action', () => Response.json({ success: true, hostname: 'travel.test', action: 'login' }), 403],
    ['reused token', () => Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] }), 403],
    ['Cloudflare 500', () => new Response('oops', { status: 500 }), 503],
    [
      'timeout',
      () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      },
      503,
    ],
  ] as const)('with a live secret: %s', async (_name, answer, status) => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', LIVE);
    cloudflare = answer as (form: URLSearchParams) => Response;
    const res = await sendCode('v@example.test');
    expect(res.status).toBe(status);
    expect(neonCalls).toHaveLength(0);
  });

  it('with a live secret and a good answer, passes', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', LIVE);
    cloudflare = cfPass;
    expect((await sendCode('v@example.test')).status).toBe(200);
  });

  it('runs on sign-up but not on code checks or password sign-in', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', TEST_FAIL);
    neon = () => Response.json({ token: null, user: null });
    expect((await call('sign-up/email', { email: 'v@example.test', password: 'a-long-password' })).status).toBe(403);
    expect((await call('sign-in/email-otp', { email: 'v@example.test', otp: CODE })).status).toBe(200);
    expect((await call('sign-in/email', { email: 'v@example.test', password: 'a-long-password' })).status).toBe(200);
  });

  describe('fail closed in production', () => {
    const prodReq = (headers: Record<string, string> = {}) => sendCode('v@example.test', headers);
    beforeEach(() => vi.stubEnv('NODE_ENV', 'production'));

    it('answers 503 when TURNSTILE_SECRET_KEY is missing', async () => {
      vi.stubEnv('TURNSTILE_SECRET_KEY', '');
      const res = await prodReq();
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe('TURNSTILE_UNAVAILABLE');
      expect(neonCalls).toHaveLength(0);
    });

    it("refuses Cloudflare's test secrets", async () => {
      vi.stubEnv('TURNSTILE_SECRET_KEY', TEST_PASS);
      expect((await prodReq()).status).toBe(503);
      expect(cfCalls).toHaveLength(0);
    });

    it('skips a missing secret only under NODE_ENV test or development', async () => {
      vi.stubEnv('TURNSTILE_SECRET_KEY', '');
      for (const env of ['test', 'development']) {
        vi.stubEnv('NODE_ENV', env);
        vi.setSystemTime(new Date(Date.now() + 120_000));
        expect((await sendCode(`${env}@example.test`, { 'x-turnstile-token': '' })).status).toBe(200);
      }
    });
  });
});

describe('quotas (Phase 1 values)', () => {
  it('per address: 1 per 60 s, 4 an hour, 8 a day, with Retry-After', async () => {
    const a = 'Someone+tag@Gmail.com';
    expect((await sendCode(a)).status).toBe(200);
    const again = await sendCode('some.one@gmail.com'); // the same mailbox, written another way
    expect(again.status).toBe(429);
    expect((await again.json()).code).toBe('RATE_LIMITED');
    expect(again.headers.get('retry-after')).toBe('30');
    let ok = 1;
    for (let m = 1; m < 24 * 60 && ok < 20; m++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 9, 25, 10, 0, 30) + m * 60_000));
      if (Date.now() >= Date.UTC(2026, 9, 26)) break;
      if ((await sendCode(a, { 'x-real-ip': `198.51.100.${m % 250}` })).status === 200) ok++;
    }
    expect(ok).toBe(AUTH_LIMITS.sendAddr.windows[2].limit);
  });

  it('per IP: 6 an hour', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await sendCode(`p${i}@example.test`)).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 200, 429, 429]);
  });

  it('an unknown IP shares one strict bucket', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await sendCode(`u${i}@example.test`, { 'x-real-ip': i % 2 ? 'not-an-ip' : '' })).status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(6);
  });

  it('global: 10 an hour from 20 parallel calls, then SEND_UNAVAILABLE and one owner alert a day', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => sendCode(`g${i}@example.test`, { 'x-real-ip': `192.0.2.${i + 1}` })));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(AUTH_LIMITS.sendGlobal.windows[0].limit);
    expect(statuses.filter((s) => s === 503)).toHaveLength(10);
    expect(neonCalls).toHaveLength(10);
    const refused = results.find((r) => r.status === 503)!;
    expect((await refused.json()).code).toBe('SEND_UNAVAILABLE');
    expect(outbox.sent).toHaveLength(1);
    expect(outbox.sent[0].to).toBe(OWNER);
    expect(outbox.sent[0].subject).toBe('[Trip Plans alert] Sign-in email cap reached');
    // A second hour that hits the cap does not mail again the same day.
    at('2026-10-25T11:00:30Z');
    for (let i = 0; i < 11; i++) await sendCode(`h${i}@example.test`, { 'x-real-ip': `192.0.2.${100 + i}` });
    expect(outbox.sent).toHaveLength(1);
  });

  it('every send path draws from the same per-address bucket', async () => {
    expect((await sendCode('v@example.test')).status).toBe(200);
    expect((await call('email-otp/request-password-reset', { email: 'v@example.test' })).status).toBe(429);
  });

  it('sign-up per IP: 5 an hour', async () => {
    neon = () => Response.json({ token: null, user: null });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await call('sign-up/email', { email: `s${i}@example.test`, password: 'a-long-password' })).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it('code checks: 10 an hour per address', async () => {
    neon = () => Response.json({ code: 'INVALID_OTP' }, { status: 400 });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await call('sign-in/email-otp', { email: 'v@example.test', otp: '000000' })).status);
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('code checks: 20 an hour per IP', async () => {
    neon = () => Response.json({ code: 'INVALID_OTP' }, { status: 400 });
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await call('email-otp/verify-email', { email: `c${i}@example.test`, otp: '000000' })).status);
    expect(statuses.filter((s) => s === 429)).toEqual([429]);
  });

  it('password: 10 per 15 minutes per address, 20 per IP', async () => {
    neon = () => Response.json({ code: 'INVALID_EMAIL_OR_PASSWORD' }, { status: 401 });
    const addr: number[] = [];
    for (let i = 0; i < 11; i++) addr.push((await call('sign-in/email', { email: 'v@example.test', password: 'wrong-password' })).status);
    expect(addr.filter((s) => s === 429)).toHaveLength(1);
    at('2026-10-25T10:15:30Z');
    const ip: number[] = [];
    for (let i = 0; i < 21; i++) ip.push((await call('sign-in/email', { email: `w${i}@example.test`, password: 'wrong-password' })).status);
    expect(ip.filter((s) => s === 429)).toHaveLength(1);
  });

  it('fails closed in production without the quota store or secret, and when the store is down', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TURNSTILE_SECRET_KEY', LIVE);
    cloudflare = cfPass;
    vi.stubEnv('AUTH_QUOTA_SECRET', '');
    expect((await (await sendCode('v@example.test')).json()).code).toBe('GUARD_UNAVAILABLE');
    vi.stubEnv('AUTH_QUOTA_SECRET', 'quota-secret-0123456789abcdef');
    vi.stubEnv('DATABASE_URL', '');
    expect((await sendCode('v@example.test')).status).toBe(503);
    vi.stubEnv('DATABASE_URL', 'postgres://fake/db');
    state.store = { ...state.store, take: async () => Promise.reject(new Error('connection refused')) } as MemoryQuotaStore;
    const down = await call('sign-in/email', { email: 'v@example.test', password: 'a-long-password' });
    expect(down.status).toBe(503);
    expect((await down.json()).code).toBe('GUARD_UNAVAILABLE');
    expect(neonCalls).toHaveLength(0);
  });

  it('skips quotas only under NODE_ENV test or development when unconfigured', async () => {
    vi.stubEnv('AUTH_QUOTA_SECRET', '');
    for (let i = 0; i < 3; i++) expect((await sendCode('v@example.test')).status).toBe(200);
    expect(state.store.rows()).toHaveLength(0);
  });

  it('AUTH_GUARD=off forwards without Turnstile or quotas, but still rewrites and revokes', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_GUARD', 'off');
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    for (let i = 0; i < 3; i++) expect((await sendCode(' V@Example.test ')).status).toBe(200);
    expect(neonCalls.every((c) => c.body?.email === 'v@example.test')).toBe(true);
    neon = () => Response.json({ status: true });
    await call('email-otp/reset-password', { email: 'v@example.test', otp: CODE, password: 'a-new-long-password' });
    expect(state.revoke).toHaveBeenCalledTimes(1);
    expect(state.store.rows()).toHaveLength(0);
  });
});

describe('sender monitoring and owner alerts', () => {
  it('counts sends Neon accepted', async () => {
    await sendCode('a@example.test');
    await sendCode('b@example.test');
    expect(state.store.rows().find((r) => r.bucket === 'auth:metric:sent')?.count).toBe(2);
  });

  it.each([429, 500, 503])('maps a Neon %i on a send to SEND_FAILED, counts it and alerts once on the first refusal of the day', async (status) => {
    neon = () => new Response(JSON.stringify({ message: 'nope' }), { status, headers: { 'content-type': 'application/json' } });
    const first = await sendCode('a@example.test');
    expect(first.status).toBe(503);
    expect((await first.json()).code).toBe('SEND_FAILED');
    if (status === 429) expect(first.headers.get('retry-after')).toBe('10');
    expect(outbox.sent.map((m) => m.subject)).toEqual(['[Trip Plans alert] Neon refused a sign-in email']);
    expect(outbox.sent[0].text).toContain(`(HTTP ${status})`);
    await sendCode('b@example.test', { 'x-real-ip': '198.51.100.2' });
    expect(outbox.sent).toHaveLength(1);
    // The third failure in the hour sends the "failing" alert, once.
    await sendCode('c@example.test', { 'x-real-ip': '198.51.100.3' });
    await sendCode('d@example.test', { 'x-real-ip': '198.51.100.4' });
    expect(outbox.sent.map((m) => m.subject)).toEqual(['[Trip Plans alert] Neon refused a sign-in email', '[Trip Plans alert] Sign-in emails are failing']);
    expect(state.store.rows().find((r) => r.bucket === 'auth:metric:refused')?.count).toBe(4);
  });

  it('a network failure to Neon is a send failure too', async () => {
    neon = () => {
      throw new TypeError('fetch failed');
    };
    const res = await sendCode('a@example.test');
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('SEND_FAILED');
  });

  it('does not pass a Neon 4xx message on from a send (it could echo the input)', async () => {
    neon = (_p, body) => Response.json({ code: 'VALIDATION_ERROR', message: `bad ${String(body?.email)}` }, { status: 400 });
    const res = await sendCode('a@example.test');
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain('a@example.test');
  });
});

afterAll(() => {
  // No address, sign-in code, token, password or IP in any captured log line, across every test above.
  const all = logs.join('\n');
  expect(logs.some((l) => l.includes('[auth-guard]'))).toBe(true);
  for (const needle of ['@example.test', '@gmail.com', CODE, '203.0.113.7', '198.51.100.', '192.0.2.', 'XXXX.DUMMY.TOKEN', 'a-long-password', 'a-new-long-password', 'quota-secret', TEST_PASS, LIVE]) {
    expect(all, `log holds ${needle}`).not.toContain(needle);
  }
});
