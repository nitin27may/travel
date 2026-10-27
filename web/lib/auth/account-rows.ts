import 'server-only';
import { cache } from 'react';
import { authErrorCode, getAuth } from './server';

/**
 * Neon's `list-accounts` for the signed-in user, read once per request with the session cookie and shared by the landing stop
 * (GSI-2, `landing-server.ts`) and "Ways to sign in" (GSI-WAYS, `ways-server.ts`). `{ ok: false }` on an error or a throw; logs a fixed
 * code only. The rows go to the pure readers (`googleLanding`, `parseNeonRows`), never to the page as they came.
 */
export const accountRows = cache(async (userId: string): Promise<{ ok: true; data: unknown } | { ok: false }> => {
  void userId; // the cache key: one answer per user per request
  try {
    const res = await getAuth().listAccounts();
    if (res.error) {
      console.warn('[account] list-accounts failed', authErrorCode(res.error));
      return { ok: false };
    }
    return { ok: true, data: res.data };
  } catch (e) {
    console.warn('[account] list-accounts threw', (e as Error)?.name);
    return { ok: false };
  }
});
