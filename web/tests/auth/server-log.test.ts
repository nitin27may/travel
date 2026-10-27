// Hotfix A1, review SF8: the session read logs a plain error code only, never the raw error object (which may carry a message, a URL
// or request data).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ answer: null as unknown }));
vi.mock('@neondatabase/auth/next/server', () => ({
  createNeonAuth: () => ({ getSession: async () => session.answer }),
}));

import { authErrorCode, getUser } from '@/lib/auth/server';

beforeEach(() => {
  vi.stubEnv('NEON_AUTH_BASE_URL', 'https://neon.test/neondb/auth');
  vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'a-cookie-secret-that-is-at-least-32-characters-long');
});
afterEach(() => {
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
});
