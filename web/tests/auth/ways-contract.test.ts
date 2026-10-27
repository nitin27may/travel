// The Neon contract behind "Ways to sign in" and the GSI-2 landing (GSI-WAYS; copy page UC1 and UC3), checked against the real Better
// Auth server code: the version `@neondatabase/auth` 0.7.0-beta pins (better-auth 1.7.6, resolved through the SDK, not a dependency of
// web), run in this process on its in-memory adapter. No network, no Neon, no Google: the Google rows are written straight into the
// memory database, as Neon's callback would write them.
//
// What this proves: the shape and the rules of Better Auth 1.7.6. What it cannot prove: that Neon's managed server (EML-0 fingerprinted
// 1.7.0-rc.2 or later) behaves the same, or how its proxy and console settings change it. The owner checks that against real Neon
// (Google spec section 18, GSI-WAYS notes, checks W1 to W6).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { googleLanding } from '@/lib/auth/landing';
import { parseNeonRows, publicRows, removalPlan, waysView } from '@/lib/auth/ways';
import { googleAuthorizeUrl } from '@/lib/auth/google';

const ORIGIN = 'http://localhost:3000';
type Db = Record<'user' | 'session' | 'account' | 'verification', Record<string, unknown>[]>;
type Auth = { handler: (r: Request) => Promise<Response> };

const sdk = createRequire(createRequire(import.meta.url).resolve('@neondatabase/auth'));
const load = (spec: string) => import(pathToFileURL(sdk.resolve(spec)).href);

let make: (opts?: { freshAgeS?: number }) => { auth: Auth; db: Db; otp: () => string | null };

beforeAll(async () => {
  const [{ betterAuth }, { memoryAdapter }, { emailOTP }] = await Promise.all([load('better-auth'), load('better-auth/adapters/memory'), load('better-auth/plugins')]);
  make = (opts = {}) => {
    const db: Db = { user: [], session: [], account: [], verification: [] };
    let last: string | null = null;
    const auth = betterAuth({
      baseURL: ORIGIN,
      secret: 'contract-test-secret-0123456789abcdefghij',
      database: memoryAdapter(db),
      emailAndPassword: { enabled: true },
      socialProviders: { google: { clientId: 'contract-client', clientSecret: 'contract-secret' } },
      session: opts.freshAgeS === undefined ? undefined : { freshAge: opts.freshAgeS },
      logger: { disabled: true },
      // Better Auth skips its origin check under NODE_ENV=test unless told otherwise; production runs it.
      advanced: { disableOriginCheck: false },
      plugins: [emailOTP({ sendVerificationOTP: async ({ otp }: { otp: string }) => void (last = otp) })],
    }) as Auth;
    return { auth, db, otp: () => last };
  };
});

const post = (auth: Auth, path: string, body: unknown, cookie?: string) =>
  auth.handler(new Request(`${ORIGIN}/api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }));
const get = (auth: Auth, path: string, cookie: string) => auth.handler(new Request(`${ORIGIN}/api/auth/${path}`, { headers: { cookie } }));
const cookieOf = (res: Response) => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

/** A user with a password (a credential row), signed in. */
async function passwordUser(auth: Auth, email = 'pw@example.test') {
  const res = await post(auth, 'sign-up/email', { email, password: 'password-12345', name: '' });
  expect(res.status).toBe(200);
  return cookieOf(res);
}

/** A Google row as Neon's callback writes it (L1 or Add Google). */
function addGoogleRow(db: Db, userId: string, at = new Date()) {
  db.account.push({ id: `acc_google_${db.account.length}`, userId, providerId: 'google', accountId: '109876543210123456789', scope: 'openid,email,profile', createdAt: at, updatedAt: at });
}

describe('list-accounts (UC3: the GSI-2 assumption)', () => {
  it('each row carries a string providerId and an ISO createdAt, which the landing and the section read', async () => {
    const { auth, db } = make();
    const cookie = await passwordUser(auth);
    const userId = (db.user[0] as { id: string }).id;
    addGoogleRow(db, userId, new Date(Date.now() + 61_000)); // added more than a minute after the user: the L1 link
    const res = await get(auth, 'list-accounts', cookie);
    expect(res.status).toBe(200);
    const raw = (await res.json()) as Record<string, unknown>[];
    expect(raw).toHaveLength(2);
    for (const row of raw) {
      expect(typeof row.providerId).toBe('string');
      expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(typeof row.id).toBe('string');
      // what the guard must never pass on is in the raw answer: the Google subject, the user id and the scopes
      expect(Object.keys(row).sort()).toEqual(['accountId', 'createdAt', 'id', 'providerId', 'scopes', 'updatedAt', 'userId']);
    }
    const rows = parseNeonRows(raw);
    expect(rows?.map((r) => r.providerId).sort()).toEqual(['credential', 'google']);
    expect(waysView(publicRows(rows!))).toMatchObject({ password: true, googleOnly: false });
    const userCreatedAt = (db.user[0] as { createdAt: Date }).createdAt.toISOString();
    expect(googleLanding({ userCreatedAt, accounts: raw, now: Date.now() + 120_000 })).toBe('linked');
  });

  it('an account made by an emailed code keeps no row at all', async () => {
    const { auth, otp } = make();
    expect((await post(auth, 'email-otp/send-verification-otp', { email: 'code@example.test', type: 'sign-in' })).status).toBe(200);
    const res = await post(auth, 'sign-in/email-otp', { email: 'code@example.test', otp: otp() });
    expect(res.status).toBe(200);
    const list = await get(auth, 'list-accounts', cookieOf(res));
    expect(await list.json()).toEqual([]);
  });

  it('without a session: 401', async () => {
    const { auth } = make();
    expect((await get(auth, 'list-accounts', 'x=1')).status).toBe(401);
  });
});

describe('unlink-account (L6, UC1)', () => {
  it('the body is the row id (`accountId`); `providerId` alone is refused', async () => {
    const { auth, db } = make();
    const cookie = await passwordUser(auth);
    addGoogleRow(db, (db.user[0] as { id: string }).id);
    const rows = parseNeonRows(await (await get(auth, 'list-accounts', cookie)).json())!;
    const plan = removalPlan(rows);
    expect(plan.ok).toBe(true);
    const wrong = await post(auth, 'unlink-account', { providerId: 'google' }, cookie);
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).code).toBe('VALIDATION_ERROR');
    const ok = await post(auth, 'unlink-account', { accountId: plan.ok ? plan.ids[0] : '' }, cookie);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ status: true });
    expect(db.account.map((a) => a.providerId)).toEqual(['credential']);
  });

  it('the last row is refused with FAILED_TO_UNLINK_LAST_ACCOUNT, which the guard maps to LAST_METHOD before asking', async () => {
    const { auth, db } = make();
    const cookie = await passwordUser(auth);
    const rows = parseNeonRows(await (await get(auth, 'list-accounts', cookie)).json())!;
    const res = await post(auth, 'unlink-account', { accountId: rows[0].id }, cookie);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('FAILED_TO_UNLINK_LAST_ACCOUNT');
    expect(db.account).toHaveLength(1);
  });

  it('UC1: a Google-only account signed in by an emailed code still has Google as its only row, so Google stays (string 47)', async () => {
    const { auth, db, otp } = make();
    const now = new Date();
    db.user.push({ id: 'user_google_only', email: 'g@example.test', name: '', emailVerified: true, createdAt: now, updatedAt: now });
    addGoogleRow(db, 'user_google_only');
    await post(auth, 'email-otp/send-verification-otp', { email: 'g@example.test', type: 'sign-in' });
    const cookie = cookieOf(await post(auth, 'sign-in/email-otp', { email: 'g@example.test', otp: otp() }));
    const rows = parseNeonRows(await (await get(auth, 'list-accounts', cookie)).json())!;
    expect(rows.map((r) => r.providerId)).toEqual(['google']);
    expect(removalPlan(rows)).toEqual({ ok: false, reason: 'last_method' });
    // ... and a password set by "Forgot password" (a reset by code) adds the row that makes Google removable
    await post(auth, 'email-otp/send-verification-otp', { email: 'g@example.test', type: 'forget-password' });
    expect((await post(auth, 'email-otp/reset-password', { email: 'g@example.test', otp: otp(), password: 'password-12345' })).status).toBe(200);
    const after = parseNeonRows(await (await get(auth, 'list-accounts', cookie)).json());
    // the reset signs other sessions out on Neon only if configured; here the session may be gone, so read the store
    expect(db.account.map((a) => a.providerId).sort()).toEqual(['credential', 'google']);
    if (after) expect(removalPlan(after).ok).toBe(true);
  });

  it('a session older than freshAge is refused with SESSION_NOT_FRESH (the guard\'s REAUTH_REQUIRED)', async () => {
    const { auth, db } = make({ freshAgeS: 60 });
    const cookie = await passwordUser(auth);
    addGoogleRow(db, (db.user[0] as { id: string }).id);
    for (const s of db.session) s.createdAt = new Date(Date.now() - 120_000);
    const rows = parseNeonRows(await (await get(auth, 'list-accounts', cookie)).json())!;
    const plan = removalPlan(rows);
    const res = await post(auth, 'unlink-account', { accountId: plan.ok ? plan.ids[0] : '' }, cookie);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('SESSION_NOT_FRESH');
  });
});

describe('link-social (L4)', () => {
  it('answers Google\'s address for the signed-in user, which the section follows', async () => {
    const { auth } = make();
    const cookie = await passwordUser(auth);
    const res = await post(auth, 'link-social', { provider: 'google', callbackURL: `${ORIGIN}/account/?added=google`, errorCallbackURL: `${ORIGIN}/account/?added=google` }, cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const url = googleAuthorizeUrl(body);
    expect(url).not.toBeNull();
    expect(new URL(url!).searchParams.get('client_id')).toBe('contract-client');
  });

  it('a callback on a host that is not trusted is refused by the server too (the second line behind SITE_ORIGIN)', async () => {
    const { auth } = make();
    const cookie = await passwordUser(auth);
    const res = await post(auth, 'link-social', { provider: 'google', callbackURL: 'https://evil.example/account/' }, cookie);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('INVALID_CALLBACK_URL');
  });

  it('without a session: 401', async () => {
    const { auth } = make();
    expect((await post(auth, 'link-social', { provider: 'google', callbackURL: `${ORIGIN}/account/` })).status).toBe(401);
  });
});
