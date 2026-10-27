// Hotfix A1, review SF8: the session read logs a plain error code only, never the raw error object (which may carry a message, a URL
// or request data).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ answer: null as unknown, calls: [] as unknown[], throwFresh: false }));
vi.mock('@neondatabase/auth/next/server', () => ({
  createNeonAuth: () => ({
    getSession: async (arg?: unknown) => {
      session.calls.push(arg);
      if (session.throwFresh && arg !== undefined) throw new Error('Cookies can only be modified in a Server Action or Route Handler');
      return session.answer;
    },
  }),
}));

import { authErrorCode, getUser } from '@/lib/auth/server';

beforeEach(() => {
  vi.stubEnv('NEON_AUTH_BASE_URL', 'https://neon.test/neondb/auth');
  vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'a-cookie-secret-that-is-at-least-32-characters-long');
});
afterEach(() => {
  session.calls = [];
  session.throwFresh = false;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('authErrorCode', () => {
  it.each([
    [{ code: 'SESSION_EXPIRED', message: 'x' }, 'SESSION_EXPIRED'],
    [{ message: 'failed for v@example.test at https://neon.test/x?token=abc' }, 'unknown'],
    [{ code: 'not a code v@example.test' }, 'unknown'],
    [{ code: 42 }, 'unknown'],
    [null, 'unknown'],
    ['boom', 'unknown'],
  ])('%j gives %s', (error, code) => {
    expect(authErrorCode(error)).toBe(code);
  });
});

describe('getUser', () => {
  it('logs only the code when the session read fails without one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    session.answer = { data: null, error: { status: 500, message: 'upstream said v@example.test', url: 'https://neon.test/get-session?token=abc' } };
    expect(await getUser()).toBeNull();
    expect(warn).toHaveBeenCalledWith('[auth] getSession failed', 'unknown');
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/example\.test|neon\.test|token/);
  });

  it('fresh: passes disableCookieCache so the SDK asks Neon, not the 300 s session cookie (review ACCT-PSEC S1)', async () => {
    session.answer = { data: { user: { id: 'u1', email: 'a@x.test' } }, error: null };
    expect(await getUser('u1', { fresh: true })).toMatchObject({ id: 'u1' });
    expect(await getUser('u1')).toMatchObject({ id: 'u1' });
    expect(session.calls).toEqual([{ query: { disableCookieCache: 'true' } }, undefined]);
  });

  it('a fresh read that throws is signed out for a write, and falls back to the cached read only when the page asks', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    session.answer = { data: { user: { id: 'u1', email: 'a@x.test' } }, error: null };
    session.throwFresh = true;
    expect(await getUser('u1', { fresh: true })).toBeNull();
    expect(await getUser(undefined, { fresh: true, cachedOnThrow: true })).toMatchObject({ id: 'u1' });
  });
});
