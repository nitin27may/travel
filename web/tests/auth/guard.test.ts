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
  vi.stubEnv('NEXT_PUBLIC_SIGN_IN', '1');
  vi.stubEnv('NEXT_PUBLIC_SIGN_IN_CODE', '1');
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

  it('sign-up answers the same for a new and an existing address (Require Verification on, EML-0 U8), headers included (SF2)', async () => {
    // Neon's headers differ by branch (a cookie and a request id on the new one only): none of them may reach the client.
    neon = (_p, body) =>
      Response.json(
        { token: null, user: { id: 'x', email: body?.email, emailVerified: false, role: body?.email === 'new@example.test' ? 'user' : null } },
        body?.email === 'new@example.test'
          ? { headers: { 'set-cookie': '__Secure-neon-auth.dont_remember=1; Path=/', 'x-neon-ret-request-id': 'r-new', 'x-extra': 'new' } }
          : { headers: { 'x-neon-ret-request-id': 'r-old' } },
      );
    const fresh = await shape(await call('sign-up/email', { email: 'new@example.test', password: 'a-long-password', name: '' }));
    at('2026-10-25T10:02:30Z');
    const existing = await shape(await call('sign-up/email', { email: 'old@example.test', password: 'a-long-password', name: '' }));
    expect(fresh).toEqual(existing);
    expect(JSON.parse(fresh.body)).toEqual({ token: null, user: null });
    expect(fresh.headers.map(([k]) => k).sort()).toEqual(['cache-control', 'content-type']);
    // Only the new account made Neon send a code.
    const sent = state.store.rows().find((r) => r.bucket === 'auth:metric:sent');
    expect(sent?.count).toBe(1);
  });

  it('sign-up maps 422 USER_ALREADY_EXISTS (Require Verification off) to the same pending answer, with fresh headers', async () => {
    neon = () =>
      Response.json(
        { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', message: 'User already exists. Use another email.' },
        { status: 422, headers: { 'x-neon-ret-request-id': 'r1', 'set-cookie': 'a=b; Path=/' } },
      );
    const res = await call('sign-up/email', { email: 'old@example.test', password: 'a-long-password', name: '' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: null, user: null });
    expect([...res.headers.keys()].sort()).toEqual(['cache-control', 'content-type']);
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

  it.each([
    'reset-password',
    'reset-password/some-token',
    'change-email',
    'email-otp/request-email-change',
    'email-otp/change-email',
    'organization/create',
    'organization/invite-member',
    'update-user',
    'delete-user',
    'forget-password',
    'forget-password/email-otp',
    'request-password-reset',
    'send-verification-email',
    'sign-in/magic-link',
    'email-otp/check-verification-otp',
    'token',
    'admin/list-users',
    'made-up/route',
    'sign-in',
    'get-session/../update-user',
  ])(
    'answers 404 for %s (allow-list, MF3)',
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

describe('hotfix A1: allow-list, flags, origin, fields', () => {
  const noOrigin = (path: string, body: unknown, method = 'POST') => {
    const r = req(path, body, {}, method);
    const headers = new Headers(r.headers);
    headers.delete('origin');
    return new Request(r.url, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(body) });
  };

  it.each(['organization/create', 'organization/list', 'update-user', 'delete-user', 'list-sessions', 'made-up'])(
    'GET %s answers 404 and never reaches Neon (MF3)',
    async (path) => {
      const res = await GET(req(path, null, {}, 'GET'), ctx(path));
      expect(res.status).toBe(404);
      expect((await res.json()).code).toBe('NOT_FOUND');
      expect(neonCalls).toHaveLength(0);
    },
  );

  it('an open route answers 404 on the other method (POST get-session, GET sign-out)', async () => {
    expect((await POST(req('get-session', {}), ctx('get-session'))).status).toBe(404);
    expect((await GET(req('sign-out', null, {}, 'GET'), ctx('sign-out'))).status).toBe(404);
    expect(neonCalls).toHaveLength(0);
  });

  it('a guarded route answers 404 on GET', async () => {
    expect((await GET(req('sign-in/email', null, {}, 'GET'), ctx('sign-in/email'))).status).toBe(404);
    expect(neonCalls).toHaveLength(0);
  });

  it('with NEXT_PUBLIC_SIGN_IN off, every path answers 404, the session read and sign-out included (MF4)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SIGN_IN', '');
    for (const [path, method] of [
      ['get-session', 'GET'],
      ['sign-out', 'POST'],
      ['sign-in/email', 'POST'],
      ['email-otp/send-verification-otp', 'POST'],
      ['sign-up/email', 'POST'],
    ] as const) {
      const r = req(path, { email: 'v@example.test', password: 'a-long-password', type: 'email-verification' }, {}, method);
      const res = method === 'GET' ? await GET(r, ctx(path)) : await POST(r, ctx(path));
      expect(res.status, path).toBe(404);
    }
    expect(neonCalls).toHaveLength(0);
    expect(cfCalls).toHaveLength(0);
    expect(state.store.rows()).toHaveLength(0);
  });

  it('with NEXT_PUBLIC_SIGN_IN_CODE off, a sign-in code send and sign-in by code answer 404; confirming an email still works (MF4)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SIGN_IN_CODE', '');
    const send = await sendCode('v@example.test');
    expect(send.status).toBe(404);
    expect((await send.json()).code).toBe('NOT_FOUND');
    expect((await call('sign-in/email-otp', { email: 'v@example.test', otp: CODE })).status).toBe(404);
    expect(neonCalls).toHaveLength(0);
    expect(cfCalls).toHaveLength(0);
    expect(state.store.rows()).toHaveLength(0);
    // The password flow keeps its confirmation code and its check.
    expect((await call('email-otp/send-verification-otp', { email: 'v@example.test', type: 'email-verification' })).status).toBe(200);
    neon = () => Response.json({ token: 't', user: { id: 'u' } });
    expect((await call('email-otp/verify-email', { email: 'v@example.test', otp: CODE })).status).toBe(200);
    expect(neonCalls.map((c) => c.path)).toEqual(['email-otp/send-verification-otp', 'email-otp/verify-email']);
  });

  it('refuses a cross-site non-GET call on an open route (sign-out) with 403', async () => {
    const res = await POST(req('sign-out', {}, { origin: 'https://evil.test' }), ctx('sign-out'));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('FORBIDDEN');
    expect(neonCalls).toHaveLength(0);
  });

  it.each(['sign-out', 'sign-in/email', 'email-otp/send-verification-otp', 'sign-up/email', 'sign-in/email-otp'])(
    'refuses a POST to %s with no Origin header (MF1)',
    async (path) => {
      const res = await POST(noOrigin(path, { email: 'v@example.test', password: 'a-long-password', type: 'sign-in', otp: CODE }), ctx(path));
      expect(res.status).toBe(403);
      expect(neonCalls).toHaveLength(0);
      expect(cfCalls).toHaveLength(0);
      expect(state.store.rows()).toHaveLength(0);
    },
  );

  it('an http Origin for a production host is foreign', async () => {
    const res = await sendCode('v@example.test', { origin: 'http://travel.test' });
    expect(res.status).toBe(403);
  });

  it('reads the session with no Origin (a GET)', async () => {
    const res = await GET(noOrigin('get-session', null, 'GET'), ctx('get-session'));
    expect(res.status).toBe(200);
  });

  it('forwards the canonical lower-case path the allow-list matched', async () => {
    const path = 'Email-OTP/Send-Verification-OTP';
    expect((await POST(req(path, { email: 'v@example.test', type: 'email-verification' }), ctx(path))).status).toBe(200);
    expect(neonCalls.map((c) => c.path)).toEqual(['email-otp/send-verification-otp']);
  });

  it.each([
    ['sign-up/email', { email: 'v@example.test', password: 'a-long-password', name: 'Click https://evil.test now', image: 'https://evil.test/x.png', callbackURL: 'https://evil.test/' }, { email: 'v@example.test', password: 'a-long-password', name: '' }],
    ['sign-up/email', { email: 'v@example.test', password: 'a-long-password' }, { email: 'v@example.test', password: 'a-long-password', name: '' }],
    ['sign-in/email', { email: 'v@example.test', password: 'a-long-password', callbackURL: 'https://evil.test/', rememberMe: true }, { email: 'v@example.test', password: 'a-long-password' }],
    ['email-otp/send-verification-otp', { email: 'v@example.test', type: 'email-verification', callbackURL: '//evil.test' }, { email: 'v@example.test', type: 'email-verification' }],
    ['email-otp/request-password-reset', { email: 'v@example.test', redirectTo: 'https://evil.test/' }, { email: 'v@example.test' }],
    ['email-otp/verify-email', { email: 'v@example.test', otp: CODE, callbackURL: 'https://evil.test/' }, { email: 'v@example.test', otp: CODE }],
    ['sign-in/email-otp', { email: 'v@example.test', otp: 482913, callbackURL: 'https://evil.test/' }, { email: 'v@example.test' }],
    ['email-otp/reset-password', { email: 'v@example.test', otp: CODE, password: 'a-new-long-password', name: 'x' }, { email: 'v@example.test', otp: CODE, password: 'a-new-long-password' }],
  ] as const)('%s forwards only its own fields (SF1): %j', async (path, body, forwarded) => {
    neon = () => Response.json({ token: null, user: null });
    await call(path, body);
    expect(neonCalls).toHaveLength(1);
    expect(neonCalls[0].body).toEqual(forwarded);
  });

  it('password sign-in never takes a send bucket nor asks Turnstile, also for an unverified account (MF2)', async () => {
    neon = () => Response.json({ code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' }, { status: 403 });
    const res = await call('sign-in/email', { email: 'v@example.test', password: 'a-long-password' }, { 'x-turnstile-token': '' });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('EMAIL_NOT_VERIFIED');
    expect(cfCalls).toHaveLength(0);
    expect(state.store.rows().filter((r) => r.bucket.startsWith('auth:send:') || r.bucket === 'auth:metric:sent')).toHaveLength(0);
    expect(logs.some((l) => l.includes('"outcome":"email_not_verified"'))).toBe(true);
    // The card's follow-up send is the guarded one: Turnstile and every send bucket.
    neon = () => Response.json({ success: true });
    expect((await call('email-otp/send-verification-otp', { email: 'v@example.test', type: 'email-verification' })).status).toBe(200);
    expect(cfCalls).toHaveLength(1);
    expect(new Set(state.store.rows().map((r) => r.bucket))).toEqual(
      new Set(['auth:password:addr', 'auth:password:ip', 'auth:send:addr', 'auth:send:ip', 'auth:send:global', 'auth:metric:sent']),
    );
  });

  it("keys the IP on Vercel's x-vercel-forwarded-for (right-most entry), then x-real-ip (SF8)", async () => {
    await sendCode('a@example.test', { 'x-vercel-forwarded-for': '198.51.100.9', 'x-real-ip': '203.0.113.7' });
    await sendCode('b@example.test', { 'x-vercel-forwarded-for': '192.0.2.1, 198.51.100.10' });
    await sendCode('c@example.test', { 'x-vercel-forwarded-for': 'garbage' });
    expect(cfCalls.map((f) => f.get('remoteip'))).toEqual(['198.51.100.9', '198.51.100.10', '203.0.113.7']);
  });
});

describe('GSI-1: the Google start (sign-in/social)', () => {
  const GOOGLE_URL = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=s&code_challenge=c&code_challenge_method=S256';
  const start = (body: unknown, headers: Record<string, string> = {}) => call('sign-in/social', body, headers);
  const card = { provider: 'google', callbackURL: '/account/?next=%2Fplaces%2Flake-louise%2F', errorCallbackURL: '/sign-in/?next=%2Fplaces%2Flake-louise%2F' };
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SIGN_IN_GOOGLE', '1');
    neon = (path) =>
      path === 'sign-in/social'
        ? Response.json({ url: GOOGLE_URL, redirect: true }, { headers: { 'set-cookie': '__Secure-neon-auth.session_challange=abc; Path=/; HttpOnly; Secure; SameSite=Lax' } })
        : Response.json({ success: true });
  });

  it('with NEXT_PUBLIC_SIGN_IN_GOOGLE off it answers 404 and never reaches Neon (spec 11, MF4)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SIGN_IN_GOOGLE', '');
    const res = await start(card);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('NOT_FOUND');
    expect(neonCalls).toHaveLength(0);
    expect(logs.some((l) => l.includes('"outcome":"google_off"'))).toBe(true);
  });

  it('with NEXT_PUBLIC_SIGN_IN off it answers 404 even with the Google flag on', async () => {
    vi.stubEnv('NEXT_PUBLIC_SIGN_IN', '');
    expect((await start(card)).status).toBe(404);
    expect(neonCalls).toHaveLength(0);
  });

  it('answers 404 on GET', async () => {
    expect((await GET(req('sign-in/social', null, {}, 'GET'), ctx('sign-in/social'))).status).toBe(404);
    expect(neonCalls).toHaveLength(0);
  });

  it('refuses a foreign, an http or a missing Origin with 403 before Neon', async () => {
    expect((await start(card, { origin: 'https://evil.example' })).status).toBe(403);
    vi.stubEnv('NODE_ENV', 'production');
    expect((await start(card, { origin: 'http://travel.test' })).status).toBe(403);
    vi.stubEnv('NODE_ENV', 'test');
    const r = req('sign-in/social', card);
    const headers = new Headers(r.headers);
    headers.delete('origin');
    const res = await POST(new Request(r.url, { method: 'POST', headers, body: JSON.stringify(card) }), ctx('sign-in/social'));
    expect(res.status).toBe(403);
    expect(neonCalls).toHaveLength(0);
  });

  it('refuses a body over 4 KB, bad JSON and another provider', async () => {
    expect((await start({ ...card, pad: 'x'.repeat(5000) })).status).toBe(413);
    expect((await start('{not json')).status).toBe(400);
    expect((await start({ ...card, provider: 'github' })).status).toBe(400);
    expect((await start({ callbackURL: '/account/' })).status).toBe(400);
    expect(neonCalls).toHaveLength(0);
  });

  it('rebuilds the body: absolute URLs on the request origin, /account/ with the checked next, the starting page, nothing else', async () => {
    const res = await start({ ...card, scopes: ['https://www.googleapis.com/auth/drive'], newUserCallbackURL: 'https://evil.example/', disableRedirect: true, requestSignUp: true });
    expect(res.status).toBe(200);
    expect(neonCalls).toHaveLength(1);
    expect(neonCalls[0].path).toBe('sign-in/social');
    expect(neonCalls[0].body).toEqual({
      provider: 'google',
      callbackURL: 'https://travel.test/account/?next=%2Fplaces%2Flake-louise%2F',
      errorCallbackURL: 'https://travel.test/sign-in/?next=%2Fplaces%2Flake-louise%2F',
    });
    expect(neonCalls[0].headers.get('x-turnstile-token')).toBeNull();
    // Google's address and the challenge cookie come back unchanged; no Turnstile and no quota were used.
    expect((await res.json()).url).toBe(GOOGLE_URL);
    expect(res.headers.get('set-cookie')).toContain('session_chal');
    expect(cfCalls).toHaveLength(0);
    expect(state.store.rows()).toHaveLength(0);
  });

  it('keeps sign-up as the error page, and drops a next it refuses', async () => {
    await start({ provider: 'google', callbackURL: '/account/', errorCallbackURL: '/sign-up/' });
    expect(neonCalls[0].body).toEqual({ provider: 'google', callbackURL: 'https://travel.test/account/', errorCallbackURL: 'https://travel.test/sign-up/' });
  });

  it.each([
    ['https://evil.example/account/', '/sign-in/'],
    ['//evil.example/account/', '/sign-in/'],
    ['/account/?next=%2F%2Fevil.example', '/sign-in/?next=%2F%2Fevil.example'],
    ['/account/?next=https%3A%2F%2Fevil.example', 'https://evil.example/sign-up/'],
    ['/account/?next=%2Fapi%2Fauth%2Fsign-out', '/sign-up/'],
    ['/account/?next=/%5Cevil.example', '/sign-in/'],
    [42, null],
  ])('a hostile callbackURL %j or errorCallbackURL %j never reaches Neon', async (callbackURL, errorCallbackURL) => {
    await start({ provider: 'google', callbackURL, errorCallbackURL });
    const body = neonCalls[0].body as Record<string, string>;
    expect(body.callbackURL).toBe('https://travel.test/account/');
    expect(body.errorCallbackURL).toMatch(/^https:\/\/travel\.test\/sign-(in|up)\/$/);
  });

  it('lands on /account/ whatever path the card sent, keeping a good next; a script URL as the error page becomes /sign-in/', async () => {
    await start({ provider: 'google', callbackURL: '/trips/?next=%2Ftrips%2F', errorCallbackURL: 'javascript:alert(1)' });
    expect(neonCalls[0].body).toEqual({ provider: 'google', callbackURL: 'https://travel.test/account/?next=%2Ftrips%2F', errorCallbackURL: 'https://travel.test/sign-in/?next=%2Ftrips%2F' });
  });

  it("keeps a Retry-After on Neon's 429 and passes only Neon's code on an error", async () => {
    neon = () => Response.json({ code: 'TOO_MANY_REQUESTS', message: 'slow down nitin@example.test' }, { status: 429 });
    const limited = await start(card);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('10');
    expect(await limited.json()).toEqual({ code: 'TOO_MANY_REQUESTS', message: 'TOO_MANY_REQUESTS' });
    neon = () => new Response('upstream broke', { status: 503 });
    const down = await start(card);
    expect(down.status).toBe(503);
    expect((await down.json()).code).toBe('SERVICE_UNAVAILABLE');
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
