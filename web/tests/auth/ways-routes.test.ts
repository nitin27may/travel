// Route tests for the guard's "Ways to sign in" block (GSI-WAYS): `list-accounts` (GET), `link-social` and `unlink-account` (POST). They
// drive the real route handler and the real Neon Auth SDK proxy; only the network is fake: a stubbed global fetch plays Neon Auth and
// records exactly what the proxy forwards (path, query string, method, headers, body). The quota store is the in-memory one. Every
// console line is captured and scanned at the end for anything personal.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_GUARD, AUTH_WAYS } from '@travel/core/config/auth-limits.ts';
import { createMemoryQuotaStore, type MemoryQuotaStore } from '@travel/core/quota/memory.ts';

const state = vi.hoisted(() => ({ store: null as unknown as MemoryQuotaStore }));

vi.mock('@/lib/auth/answer-hold', async (importActual) => {
  const real = await importActual<typeof import('@/lib/auth/answer-hold')>();
  return { ...real, sleep: async () => undefined, monotonicMs: () => 0 };
});
vi.mock('@travel/core/quota/pg.ts', () => ({
  createPgQuotaStore: () => ({
    take: (rules: never) => state.store.take(rules),
    peek: (b: string, w: number, at: Date) => state.store.peek(b, w, at),
  }),
}));
vi.mock('@/lib/auth/revoke', () => ({ revokeSessionsBefore: async () => 0 }));
vi.mock('@/lib/server/mailer', () => ({ getMailer: () => ({ send: async () => ({ ok: true }) }), ownerEmail: () => undefined }));
// The SDK's Next entry imports `next/headers`; the test builds the same handler from the framework-agnostic proxy (as guard.test.ts).
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

const SESSION = `${AUTH_WAYS.sessionCookie}=tok_session_value_123456`;
const GOOGLE_URL = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&state=s1&code_challenge=c1&code_challenge_method=S256';
const GOOGLE_SUB = '109876543210123456789';
const CRED = { id: 'row_cred_1', providerId: 'credential', accountId: 'user_1', userId: 'user_1', createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z', scopes: [] };
const GOOG = { id: 'row_goog_1', providerId: 'google', accountId: GOOGLE_SUB, userId: 'user_1', createdAt: '2026-10-26T09:00:00.000Z', updatedAt: '2026-10-26T09:00:00.000Z', scopes: ['openid', 'email', 'profile'] };

type NeonCall = { path: string; search: string; method: string; body: Record<string, unknown> | null; headers: Headers };
let neonCalls: NeonCall[] = [];
let rows: unknown;
let sessionCreated: string;
let neon: (call: NeonCall) => Response | Promise<Response> | undefined;
const logs: string[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-27T10:00:30Z'));
  state.store = createMemoryQuotaStore();
  neonCalls = [];
  rows = [CRED, GOOG];
  sessionCreated = '2026-10-27T09:00:00.000Z';
  neon = () => undefined;
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('NEON_AUTH_BASE_URL', 'https://neon.test/neondb/auth');
  vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'a-cookie-secret-that-is-at-least-32-characters-long');
  vi.stubEnv('DATABASE_URL', 'postgres://fake/db');
  vi.stubEnv('AUTH_QUOTA_SECRET', 'quota-secret-0123456789abcdef');
  vi.stubEnv('AUTH_GUARD', '');
  vi.stubEnv('SITE_ORIGIN', '');
  vi.stubEnv('NEXT_PUBLIC_SIGN_IN', '1');
  vi.stubEnv('NEXT_PUBLIC_SIGN_IN_CODE', '1');
  vi.stubEnv('NEXT_PUBLIC_SIGN_IN_GOOGLE', '1');
  vi.stubGlobal('fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.host !== 'neon.test') throw new Error(`unexpected fetch to ${url.host}`);
    const text = typeof init.body === 'string' ? init.body : '';
    const call: NeonCall = {
      path: url.pathname.replace(/^\/neondb\/auth\//, ''),
      search: url.search,
      method: init.method ?? 'GET',
      body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
      headers: new Headers(init.headers),
    };
    neonCalls.push(call);
    const custom = await neon(call);
    if (custom) return custom;
    switch (call.path) {
      case 'get-session':
        return Response.json({ session: { id: 's1', userId: 'user_1', createdAt: sessionCreated, expiresAt: '2026-11-03T09:00:00.000Z', updatedAt: sessionCreated }, user: { id: 'user_1', email: 'nitin@example.test', createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z' } });
      case 'list-accounts':
        return Response.json(rows);
      case 'link-social':
        return Response.json({ url: GOOGLE_URL, redirect: true }, { headers: { 'set-cookie': '__Secure-neon-auth.oauth_state=st1; Path=/; HttpOnly; Secure; SameSite=Lax' } });
      case 'unlink-account':
        return Response.json({ status: true });
      default:
        return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
    }
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

const ctx = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });

function req(path: string, body: unknown, headers: Record<string, string | null> = {}, method = 'POST', search = ''): Request {
  const base: Record<string, string> = {
    origin: 'https://travel.test',
    host: 'travel.test',
    'content-type': 'application/json',
    'x-real-ip': '203.0.113.7',
    'user-agent': 'vitest',
    cookie: `${SESSION}; other=1`,
  };
  for (const [k, v] of Object.entries(headers)) {
    if (v === null) delete base[k];
    else base[k] = v;
  }
  return new Request(`https://travel.test/api/auth/${path}/${search}`, { method, headers: base, body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
}

const list = (headers: Record<string, string | null> = {}, search = '') =>
  GET(req('list-accounts', undefined, { origin: null, 'sec-fetch-site': 'same-origin', ...headers }, 'GET', search), ctx('list-accounts'));
const link = (body: unknown = { provider: 'google' }, headers: Record<string, string | null> = {}, search = '') => POST(req('link-social', body, headers, 'POST', search), ctx('link-social'));
const unlink = (body: unknown = { providerId: 'google' }, headers: Record<string, string | null> = {}, search = '') => POST(req('unlink-account', body, headers, 'POST', search), ctx('unlink-account'));
const paths = () => neonCalls.map((c) => c.path);
/** A refusal case: an env to set, headers to change, a body, and the status expected before Neon is asked. */
type Refusal = [string, { env?: [string, string]; headers?: Record<string, string | null>; body?: unknown }, number];

describe('list-accounts (GET)', () => {
  it('answers provider and date only: no row id, Google subject, user id or scopes', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = await res.json();
    expect(body).toEqual({
      accounts: [
        { providerId: 'credential', createdAt: Date.parse(CRED.createdAt) },
        { providerId: 'google', createdAt: Date.parse(GOOG.createdAt) },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(/row_|user_1|scope|openid/);
    expect(JSON.stringify(body)).not.toContain(GOOGLE_SUB);
  });

  it('forwards the session cookie and no query string of the browser\'s', async () => {
    await list({}, '?userId=someone-else&disableCookieCache=true');
    expect(neonCalls).toHaveLength(1);
    expect(neonCalls[0]).toMatchObject({ path: 'list-accounts', search: '', method: 'GET', body: null });
    expect(neonCalls[0].headers.get('cookie')).toBe(SESSION);
  });

  it('without the session cookie: 401 before Neon', async () => {
    for (const cookie of [null, 'other=1', `${AUTH_WAYS.sessionCookie}=`, `x${AUTH_WAYS.sessionCookie}=tok`]) {
      const res = await list({ cookie });
      expect(res.status).toBe(401);
      expect((await res.json()).code).toBe('UNAUTHORIZED');
    }
    expect(neonCalls).toHaveLength(0);
  });

  it('Neon says no session: 401', async () => {
    neon = (c) => (c.path === 'list-accounts' ? Response.json({ code: 'UNAUTHORIZED', message: 'secret detail' }, { status: 401 }) : undefined);
    const res = await list();
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain('secret detail');
  });

  it('rows Neon sends in a shape we do not know (UC3 "no"): 502, never an empty list', async () => {
    rows = [{ id: 'row_goog_1', providerId: 'google' }];
    const res = await list();
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe('SERVICE_UNAVAILABLE');
  });

  it('a foreign Origin, a cross-site fetch or HTTP outside development: 403, before Neon', async () => {
    expect((await list({ origin: 'https://evil.example' })).status).toBe(403);
    expect((await list({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await list({ 'sec-fetch-site': 'same-site' })).status).toBe(403);
    expect((await list({ origin: 'http://travel.test' })).status).toBe(403);
    expect(neonCalls).toHaveLength(0);
    // a same-origin GET without Origin (what browsers send) is fine
    expect((await list({ 'sec-fetch-site': null })).status).toBe(200);
  });

  it('only GET: a POST answers 404', async () => {
    const res = await POST(req('list-accounts', {}), ctx('list-accounts'));
    expect(res.status).toBe(404);
    expect(neonCalls).toHaveLength(0);
  });

  it('with sign-in off: 404 (the route handler)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SIGN_IN', '0');
    expect((await list()).status).toBe(404);
    expect(neonCalls).toHaveLength(0);
  });
});

describe('link-social (Add Google)', () => {
  beforeEach(() => {
    rows = [CRED];
  });
  it('rebuilds the body from scratch: both callbacks on our origin, /account/?added=google; nothing the browser sent passes', async () => {
    const res = await link({ provider: 'google', callbackURL: 'https://evil.example/', errorCallbackURL: 'https://evil.example/', scopes: ['drive'], idToken: { token: 'x' }, disableRedirect: false }, {}, '?callbackURL=https://evil.example/');
    expect(res.status).toBe(200);
    expect(paths()).toEqual(['list-accounts', 'link-social']);
    const call = neonCalls[1];
    expect(call.search).toBe('');
    expect(call.body).toEqual({ provider: 'google', callbackURL: 'https://travel.test/account/?added=google', errorCallbackURL: 'https://travel.test/account/?added=google' });
    expect(call.headers.get('cookie')).toBe(SESSION);
    expect(call.headers.get('origin')).toBe('https://travel.test');
    // Only Google's address comes back, with Neon's cookie (the OAuth state).
    expect(await res.json()).toEqual({ url: GOOGLE_URL });
    expect(res.headers.getSetCookie().join('\n')).toContain('__Secure-neon-auth.oauth_state=st1');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('SITE_ORIGIN, when set, is the callback origin; a request from another origin is refused before Neon', async () => {
    vi.stubEnv('SITE_ORIGIN', 'https://travel.test/');
    expect((await link()).status).toBe(200);
    expect(neonCalls.at(-1)?.body?.callbackURL).toBe('https://travel.test/account/?added=google');
    neonCalls = [];
    vi.stubEnv('SITE_ORIGIN', 'https://travel-beta-tan.vercel.app');
    const res = await link();
    expect(res.status).toBe(403);
    expect(paths()).not.toContain('link-social');
  });

  it('outside development and test, without SITE_ORIGIN: 503, never the request origin', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SITE_ORIGIN', '');
    const res = await link();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('GUARD_UNAVAILABLE');
    expect(paths()).not.toContain('link-social');
  });

  it('Google already added: 409 ALREADY_ADDED, no new link', async () => {
    const res = await link();
    expect(paths()).toEqual(['list-accounts', 'link-social']);
    neonCalls = [];
    rows = [GOOG];
    const again = await link();
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe('ALREADY_ADDED');
    expect(paths()).toEqual(['list-accounts']);
    expect(res.status).toBe(200);
  });

  it('an emailed-code account (no rows at all) may add Google', async () => {
    rows = [];
    expect((await link()).status).toBe(200);
  });

  it('Neon answers an address that is not Google\'s: 502, nothing of it passed on', async () => {
    neon = (c) => (c.path === 'link-social' ? Response.json({ url: 'https://evil.example/o/oauth2/auth', redirect: true }) : undefined);
    const res = await link();
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('evil');
  });

  it('Neon refuses: its code only, never its message; a 429 keeps a Retry-After', async () => {
    neon = (c) => (c.path === 'link-social' ? Response.json({ code: 'PROVIDER_NOT_FOUND', message: 'Provider google is not configured for https://neon.test' }, { status: 404 }) : undefined);
    const r1 = await link();
    expect(r1.status).toBe(404);
    expect(await r1.json()).toEqual({ code: 'PROVIDER_NOT_FOUND', message: 'PROVIDER_NOT_FOUND' });
    neon = (c) => (c.path === 'link-social' ? new Response('Too many', { status: 429 }) : undefined);
    const r2 = await link();
    expect(r2.status).toBe(429);
    expect(r2.headers.get('retry-after')).toBe(String(AUTH_GUARD.upstreamRetryAfterS));
  });

  it.each<Refusal>([
    ['flag off', { env: ['NEXT_PUBLIC_SIGN_IN_GOOGLE', '0'] }, 404],
    ['no Origin', { headers: { origin: null } }, 403],
    ['a foreign Origin', { headers: { origin: 'https://evil.example' } }, 403],
    ['another provider', { body: { provider: 'github' } }, 400],
    ['a body that is not an object', { body: '[1]' }, 400],
    ['broken JSON', { body: '{' }, 400],
    ['a body over the cap', { body: { provider: 'google', pad: 'x'.repeat(AUTH_GUARD.bodyMaxBytes) } }, 413],
    ['no session cookie', { headers: { cookie: null } }, 401],
  ])('%s: %i, before Neon', async (_name, c, status) => {
    if (c.env) vi.stubEnv(c.env[0], c.env[1]);
    const res = await link(c.body ?? { provider: 'google' }, c.headers ?? {});
    expect(res.status).toBe(status);
    expect(neonCalls).toHaveLength(0);
  });

  it('GET is not offered: 404', async () => {
    const res = await GET(req('link-social', undefined, {}, 'GET'), ctx('link-social'));
    expect(res.status).toBe(404);
    expect(neonCalls).toHaveLength(0);
  });
});

describe('unlink-account (Remove Google)', () => {
  it('a recent sign-in, a password beside Google: removes the Google row by its id, chosen here, not by the browser', async () => {
    const res = await unlink({ providerId: 'google', accountId: 'row_cred_1', userId: 'someone' }, {}, '?accountId=row_cred_1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(paths()).toEqual(['get-session', 'list-accounts', 'unlink-account']);
    // the session is read from Neon, past the SDK's cookie cache; nothing of the browser's query string
    expect(neonCalls[0].search).toBe('?disableCookieCache=true');
    expect(neonCalls[1].search).toBe('');
    expect(neonCalls[2]).toMatchObject({ search: '', method: 'POST', body: { accountId: 'row_goog_1' } });
  });

  it('an emailed-code account with Google added (a password row is not needed beside it): Google is the only row, so it stays', async () => {
    rows = [GOOG];
    const res = await unlink();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('LAST_METHOD');
    expect(paths()).not.toContain('unlink-account');
  });

  it('Neon refuses the last row itself (a race): the same 409 LAST_METHOD', async () => {
    neon = (c) => (c.path === 'unlink-account' ? Response.json({ code: 'FAILED_TO_UNLINK_LAST_ACCOUNT', message: "You can't unlink your last account" }, { status: 400 }) : undefined);
    const res = await unlink();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('LAST_METHOD');
  });

  it('a sign-in older than a day: 403 REAUTH_REQUIRED, nothing removed; Neon\'s SESSION_NOT_FRESH reads the same', async () => {
    sessionCreated = new Date(Date.parse('2026-10-27T10:00:30Z') - AUTH_WAYS.removeFreshS * 1000 - 60_000).toISOString();
    const res = await unlink();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('REAUTH_REQUIRED');
    expect(paths()).toEqual(['get-session']);
    sessionCreated = '2026-10-27T09:00:00.000Z';
    neon = (c) => (c.path === 'unlink-account' ? Response.json({ code: 'SESSION_NOT_FRESH', message: 'Session is not fresh' }, { status: 403 }) : undefined);
    const again = await unlink();
    expect(again.status).toBe(403);
    expect((await again.json()).code).toBe('REAUTH_REQUIRED');
  });

  it('a session without a readable start time: refused (fail closed)', async () => {
    sessionCreated = 'not a date';
    neon = (c) => (c.path === 'get-session' ? Response.json({ session: { id: 's1' }, user: { id: 'user_1' } }) : undefined);
    expect((await unlink()).status).toBe(403);
    expect(paths()).not.toContain('unlink-account');
  });

  it('Neon has no session for the cookie: 401', async () => {
    neon = (c) => (c.path === 'get-session' ? Response.json(null) : undefined);
    expect((await unlink()).status).toBe(401);
    expect(paths()).toEqual(['get-session']);
  });

  it('no Google row: 409 NOT_LINKED', async () => {
    rows = [CRED];
    const res = await unlink();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('NOT_LINKED');
  });

  it.each<Refusal>([
    ['flag off (rows read-only, string 50)', { env: ['NEXT_PUBLIC_SIGN_IN_GOOGLE', '0'] }, 404],
    ['no Origin', { headers: { origin: null } }, 403],
    ['a foreign Origin', { headers: { origin: 'https://evil.example' } }, 403],
    ['another provider', { body: { providerId: 'credential' } }, 400],
    ['no provider', { body: {} }, 400],
    ['a body over the cap', { body: { providerId: 'google', pad: 'x'.repeat(AUTH_GUARD.bodyMaxBytes) } }, 413],
    ['no session cookie', { headers: { cookie: null } }, 401],
  ])('%s: %i, before Neon', async (_name, c, status) => {
    if (c.env) vi.stubEnv(c.env[0], c.env[1]);
    const res = await unlink(c.body ?? { providerId: 'google' }, c.headers ?? {});
    expect(res.status).toBe(status);
    expect(neonCalls).toHaveLength(0);
  });
});

describe('the per-IP buckets', () => {
  it('writes: 5 a minute per client IP, then 429 with Retry-After; keyed on the IP hash, never the IP', async () => {
    rows = [];
    for (let i = 0; i < AUTH_WAYS.writeIp.windows[0].limit; i++) expect((await link()).status).toBe(200);
    const res = await link();
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('RATE_LIMITED');
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    // another network is not affected
    expect((await link(undefined, { 'x-real-ip': '198.51.100.9' })).status).toBe(200);
    // removals share the write bucket
    expect((await unlink()).status).toBe(429);
    const stored = state.store.rows().filter((r) => r.bucket === AUTH_WAYS.writeIp.bucket);
    expect(stored.length).toBeGreaterThan(0);
    for (const r of stored) {
      expect(r.key).toMatch(/^[0-9a-f]{32}$/);
      expect(r.key).not.toContain('203');
    }
  });

  it('reads have their own, larger bucket', async () => {
    rows = [CRED];
    for (let i = 0; i < AUTH_WAYS.readIp.windows[0].limit; i++) expect((await list()).status).toBe(200);
    expect((await list()).status).toBe(429);
    expect((await link()).status).toBe(200);
  });

  it('fails closed in production without the store or its secret; AUTH_GUARD=off (rollback) skips the bucket', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_QUOTA_SECRET', '');
    expect((await list()).status).toBe(503);
    expect(neonCalls).toHaveLength(0);
    vi.stubEnv('AUTH_GUARD', 'off');
    expect((await list()).status).toBe(200);
  });

  it('locally without the store: allowed, with a warning', async () => {
    vi.stubEnv('DATABASE_URL', '');
    expect((await list()).status).toBe(200);
  });
});

describe('the routes the guard does not offer stay 404', () => {
  it.each(['account-info', 'list-sessions', 'delete-user', 'update-user', 'change-password', 'list-accounts/x', 'link-social/google'])('%s', async (path) => {
    expect((await GET(req(path, undefined, {}, 'GET'), ctx(path))).status).toBe(404);
    expect((await POST(req(path, {}), ctx(path))).status).toBe(404);
    expect(neonCalls).toHaveLength(0);
  });
});

afterAll(() => {
  // Nothing personal in any log line: no cookie value, address, row id, Google subject, Google address or IP.
  const all = logs.join('\n');
  for (const secret of ['tok_session_value_123456', 'nitin@example.test', 'row_goog_1', 'row_cred_1', GOOGLE_SUB, 'accounts.google.com', '203.0.113.7', 'evil.example']) {
    expect(all).not.toContain(secret);
  }
  expect(all).toContain('[auth-guard]');
});
