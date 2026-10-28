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
 * How fresh the session read must be (review ACCT-PSEC S1). By default the SDK answers from the signed `session_data` cookie for up to
 * 300 s without asking Neon, so a session revoked elsewhere still reads as signed in. `fresh: true` passes `disableCookieCache` and
 * asks Neon every time (about 160 ms): the account writes and the party route use it. A Server Component cannot write cookies, so
 * the Account page sets `cachedOnThrow`: when the fresh read throws (the SDK writing a renewed cookie), it falls back to the cached read
 * for display only. A write never falls back.
 */
export interface GetUserOptions {
  fresh?: boolean;
  cachedOnThrow?: boolean;
}

type SessionRead = { data: unknown; error: unknown };
const readSession = (fresh: boolean): Promise<SessionRead> =>
  (fresh ? getAuth().getSession({ query: { disableCookieCache: 'true' } }) : getAuth().getSession()) as Promise<SessionRead>;

/**
 * The signed-in user, or null. Call it first in every Server Component data path, Server Action and
 * Route Handler: `proxy.ts` is not the security boundary.
 *
 * Pass the user id the page was loaded for; a different signed-in user counts as signed out, so a
 * write or renewal from a page loaded for someone else is refused. That id is only compared, never
 * used to scope a query. When auth is unconfigured or unreachable, the request is treated as signed
 * out (fail closed).
 */
export async function getUser(pageUserId?: string, opts: GetUserOptions = {}): Promise<SessionUser | null> {
  if (!authConfigured()) return null;
  let data: { user?: SessionUser | null } | null = null;
  const fresh = opts.fresh === true;
  try {
    let res: SessionRead;
    try {
      res = await readSession(fresh); // returns { data, error }; does not throw on HTTP errors
    } catch (e) {
      if (!fresh || !opts.cachedOnThrow) throw e;
      console.warn('[auth] fresh getSession threw; cached read for display', (e as Error)?.name);
      res = await readSession(false);
    }
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
