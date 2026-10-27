// ACCT-PS (spike): the display name is saved by a SERVER-SIDE `getAuth().updateUser({ name })`, never through the browser proxy
// (which answers 404 for `update-user`). This pins the call shape with a mocked SDK; the real call on the Neon child branch is
// recorded in docs/v2/features/account-profile-and-travellers.md 4.3 and research/runs/ACCT-PS-spike.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ updateUser: vi.fn(async (_body: Record<string, unknown>) => ({ data: { status: true }, error: null })) }));
vi.mock('@neondatabase/auth/next/server', () => ({ createNeonAuth: () => ({ updateUser: sdk.updateUser }) }));

import { getAuth } from '@/lib/auth/server';

beforeEach(() => {
  vi.stubEnv('NEON_AUTH_BASE_URL', 'https://neon.test/neondb/auth');
  vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'a-cookie-secret-that-is-at-least-32-characters-long');
});
afterEach(() => {
  vi.unstubAllEnvs();
  sdk.updateUser.mockClear();
});

describe('server-side updateUser call shape (ACCT-PS)', () => {
  it('sends exactly { name }: no image, no other user field', async () => {
    const res = await getAuth().updateUser({ name: 'Nitin' });
    expect(sdk.updateUser).toHaveBeenCalledTimes(1);
    expect(sdk.updateUser.mock.calls[0]?.[0]).toStrictEqual({ name: 'Nitin' });
    expect(res.data).toEqual({ status: true });
    expect(res.error).toBeNull();
  });

  it('answers { data: { status }, error } and does not throw on an error answer', async () => {
    sdk.updateUser.mockResolvedValueOnce({ data: null as never, error: { code: 'INVALID_NAME' } as never });
    const res = await getAuth().updateUser({ name: '' });
    expect(res.data).toBeNull();
    expect((res.error as { code: string }).code).toBe('INVALID_NAME');
  });
});
