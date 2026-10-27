// The account page follows a checked `next` once a user is signed in (GSI-1; Google spec 3 and 7.4): Continue with Google always lands on
// /account/ (the only path whose proxy exchanges the verifier) with the page it started from as `next`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ user: null as null | { id: string; email: string }, landing: 'returning' as string, asked: 0 }));
vi.mock('@/lib/auth/server', () => ({ getUser: async () => state.user }));
// GSI-2: the landing comes from Neon's account rows; here a returning sign-in unless a test says otherwise.
vi.mock('@/lib/auth/landing-server', () => ({
  accountLanding: async () => {
    state.asked += 1;
    return state.landing;
  },
}));
vi.mock('@/lib/server/drafts', () => ({ loadDrafts: async () => ({ rows: [], sealedQuery: {} }) }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { to });
  },
}));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SIGN_IN', '1');
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
  state.user = null;
  state.landing = 'returning';
  state.asked = 0;
});

async function load(next: string | string[] | undefined): Promise<string | null> {
  const { default: AccountPage } = await import('@/app/account/page');
  try {
    await AccountPage({ searchParams: Promise.resolve(next === undefined ? {} : { next }) });
    return null;
  } catch (e) {
    const to = (e as { to?: string }).to;
    if (to === undefined) throw e;
    return to;
  }
}

describe('account page next', () => {
  it('signed in: goes to a checked next at once', async () => {
    state.user = { id: 'u1', email: 'a@example.test' };
    expect(await load('/places/lake-louise/')).toBe('/places/lake-louise/');
    expect(await load('/mine/')).toBe('/mine/');
    expect(await load('/places/?kind=trail&season=jul')).toBe('/places/?kind=trail&season=jul');
  });
  it.each(['//evil.example', 'https://evil.example/', '/\\evil.example', '/api/auth/sign-out', '/account/', '', ['/trips/', '/mine/']])('signed in: stays for %j', async (next) => {
    state.user = { id: 'u1', email: 'a@example.test' };
    expect(await load(next as string | string[])).toBeNull();
  });
  it('signed out: never follows next, and never asks for account rows', async () => {
    expect(await load('/places/lake-louise/')).toBeNull();
    expect(state.asked).toBe(0);
  });
  // GSI-2, the stop (copy page W3, Q-GC3): a new account or a link stays here; rows that cannot be read stay too (fail closed).
  it.each(['new', 'linked', 'unknown'])('signed in, landing %s: stays on Account instead of following next', async (landing) => {
    state.user = { id: 'u1', email: 'a@example.test' };
    state.landing = landing;
    expect(await load('/places/lake-louise/')).toBeNull();
    expect(await load('/mine/')).toBeNull();
  });
  it('no address parameter can skip the stop: the landing is asked for whatever the query holds', async () => {
    state.user = { id: 'u1', email: 'a@example.test' };
    state.landing = 'linked';
    const { default: AccountPage } = await import('@/app/account/page');
    for (const extra of [{ landing: 'returning' }, { notice: '0' }, { skip: '1' }, { returning: 'true' }]) {
      await expect(AccountPage({ searchParams: Promise.resolve({ next: '/mine/', ...extra }) })).resolves.toBeTruthy();
    }
  });
  it('without next: renders as before', async () => {
    state.user = { id: 'u1', email: 'a@example.test' };
    expect(await load(undefined)).toBeNull();
  });
});
