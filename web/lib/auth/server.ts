import 'server-only';
import { createNeonAuth } from '@neondatabase/auth/next/server';
import { authEnv, authConfigured } from '../server/neon-env';

/**
 * Managed Better Auth server instance. Lazy: `createNeonAuth` validates the cookie secret when
 * constructed and throws without it, so it must not run at module load during `next build`.
 */
let auth: ReturnType<typeof createNeonAuth> | undefined;

export function getAuth(): ReturnType<typeof createNeonAuth> {
  const { baseUrl, cookieSecret } = authEnv();
  return (auth ??= createNeonAuth({ baseUrl, cookies: { secret: cookieSecret } }));
}

/** A loggable code for an auth error: an upper-case token, or `unknown`. */
export function authErrorCode(error: unknown): string {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'unknown';
}

export type SessionUser ={ id: string; email: string; name?: string | null };

/**
 * The signed-in user, or null. Call it first in every Server Component data path, Server Action and
 * Route Handler: `proxy.ts` is not the security boundary.
 *
 * Pass the user id the page was loaded for; a different signed-in user counts as signed out, so a
 * write or renewal from a page loaded for someone else is refused. That id is only compared, never
 * used to scope a query. When auth is unconfigured or unreachable, the request is treated as signed
 * out (fail closed).
 */
export async function getUser(pageUserId?: string): Promise<SessionUser | null> {
  if (!authConfigured()) return null;
  let data: { user?: SessionUser | null } | null = null;
  try {
    const res = await getAuth().getSession(); // returns { data, error }; does not throw on HTTP errors
    if (res.error) {
      // Only a plain error code: the raw error object may carry a message, a URL or request data (hotfix A1, review SF8).
      console.warn('[auth] getSession failed', authErrorCode(res.error));
    }
    data = res.data as { user?: SessionUser | null } | null;
  } catch (e) {
    console.warn('[auth] getSession threw', (e as Error)?.name);
    return null;
  }
  const user = data?.user ?? null;
  if (!user) return null;
  return pageUserId === undefined || user.id === pageUserId ? user : null;
}
