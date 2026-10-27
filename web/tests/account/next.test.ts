// The account page follows a checked `next` once a user is signed in (GSI-1; Google spec 3 and 7.4): Continue with Google always lands on
// /account/ (the only path whose proxy exchanges the verifier) with the page it started from as `next`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ user: null as null | { id: string; email: string } }));
vi.mock('@/lib/auth/server', () => ({ getUser: async () => state.user }));
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
  it('signed out: never follows next', async () => {
    expect(await load('/places/lake-louise/')).toBeNull();
  });
  it('without next: renders as before', async () => {
    state.user = { id: 'u1', email: 'a@example.test' };
    expect(await load(undefined)).toBeNull();
  });
});
