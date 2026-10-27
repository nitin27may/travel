/**
 * Continue with Google, the pure parts (GSI-1; Google spec 3 and 7.4, copy page section 8). Shared by the sign-in card (browser) and
 * the auth guard (server), so nothing here touches the DOM, storage or the network.
 *
 * The flow: the card POSTs `{ provider, callbackURL, errorCallbackURL }` (paths only) to the guarded proxy; the guard rebuilds both
 * URLs itself from the checked `next` and the request's own origin (`googleCallbacks`), so no address the browser chose reaches Neon;
 * Neon answers with Google's address, which the card follows only when it is Google's (`googleAuthorizeUrl`).
 */
import { GOOGLE_SIGN_IN } from '@travel/core/config/auth-limits.ts';
import { DEFAULT_RETURN, returnPath } from './return-path';

export type StartPage = 'sign-in' | 'sign-up';

/** The parameters Neon or our proxy may leave on the return address, which the card removes at once (copy page 2.3; gotchas). */
export const RETURN_PARAMS = ['error', 'error_description', 'neon_auth_session_verifier'] as const;

function withNext(path: string, next: string): string {
  return next === DEFAULT_RETURN ? path : `${path}?next=${encodeURIComponent(next)}`;
}

/** The start page's path for `errorCallbackURL`: `/sign-in/` or `/sign-up/`, never anything else. */
function startPath(page: unknown): string {
  return page === 'sign-up' ? GOOGLE_SIGN_IN.startPaths[1] : GOOGLE_SIGN_IN.startPaths[0];
}

/** The body the card sends: paths only, `next` checked (spec 7.4); the guard rebuilds them anyway. */
export function googleStartBody(page: StartPage, rawNext: unknown): { provider: string; callbackURL: string; errorCallbackURL: string } {
  const next = returnPath(rawNext);
  return { provider: GOOGLE_SIGN_IN.provider, callbackURL: withNext(GOOGLE_SIGN_IN.landingPath, next), errorCallbackURL: withNext(startPath(page), next) };
}

/** The `next` of a path the browser sent (`/account/?next=...`), checked; the account page when absent or refused. */
function nextOf(value: unknown, origin: string): string {
  if (typeof value !== 'string' || value.length > 1024) return DEFAULT_RETURN;
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return DEFAULT_RETURN;
    return returnPath(url.searchParams.get('next'));
  } catch {
    return DEFAULT_RETURN;
  }
}

/** Which start page an `errorCallbackURL` names (the path only); the sign-in page otherwise. */
function pageOf(value: unknown, origin: string): StartPage {
  if (typeof value !== 'string' || value.length > 1024) return 'sign-in';
  try {
    const url = new URL(value, origin);
    return url.origin === origin && url.pathname === GOOGLE_SIGN_IN.startPaths[1] ? 'sign-up' : 'sign-in';
  } catch {
    return 'sign-in';
  }
}

/**
 * The guard's body for Neon's `sign-in/social`, rebuilt from scratch (review SF1: only known fields; spec 5.1: the proxy owns
 * `callbackURL`). `origin` is the request's own, already checked same-origin. Null when the provider is not Google.
 *
 * - `callbackURL` is always `<origin>/account/` plus the checked `next` (only `/account/*` runs the verifier exchange, spec 3);
 * - `errorCallbackURL` is `<origin>/sign-in/` or `<origin>/sign-up/` plus the same `next`;
 * - nothing else (no `scopes`, `newUserCallbackURL`, `idToken`, `requestSignUp`, `disableRedirect`): Neon's defaults stand.
 */
export function googleCallbacks(body: Record<string, unknown>, origin: string): { provider: string; callbackURL: string; errorCallbackURL: string } | null {
  if (body.provider !== GOOGLE_SIGN_IN.provider) return null;
  const next = nextOf(body.callbackURL, origin);
  return {
    provider: GOOGLE_SIGN_IN.provider,
    callbackURL: `${origin}${withNext(GOOGLE_SIGN_IN.landingPath, next)}`,
    errorCallbackURL: `${origin}${withNext(startPath(pageOf(body.errorCallbackURL, origin)), next)}`,
  };
}

/** Google's address from Neon's answer, only when it is HTTPS on Google's sign-in host; null otherwise (string 13). */
export function googleAuthorizeUrl(body: Record<string, unknown> | null): string | null {
  const raw = body?.url;
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === GOOGLE_SIGN_IN.authorizeHost && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** A known in-app browser that Google refuses (string 8). A hint only: the button stays enabled. */
export function inAppBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return GOOGLE_SIGN_IN.inAppAgents.some((token) => userAgent.includes(token));
}

/** The pending mark is a press time in ms; it counts for `pendingMaxMs` (copy page section 8, GSI-1). */
export function pendingFresh(stamp: string | null | undefined, now: number): boolean {
  if (!stamp || !/^\d{1,15}$/.test(stamp)) return false;
  const age = now - Number(stamp);
  return age >= 0 && age <= GOOGLE_SIGN_IN.pendingMaxMs;
}

/**
 * The return address read once (copy page 2.3): the raw `error` (null when none), whether the proxy sent a failed verifier exchange
 * back here (`neon_auth_session_verifier` present: the challenge cookie was missing, so cookies are blocked or the tab changed), and
 * the search string without those parameters, for `history.replaceState`. `next` and anything else stay.
 */
export function readReturn(search: string): { error: string | null; failedExchange: boolean; cleanSearch: string; changed: boolean } {
  const params = new URLSearchParams(search);
  const error = params.get('error');
  const failedExchange = params.has('neon_auth_session_verifier');
  let changed = false;
  for (const p of RETURN_PARAMS) {
    if (params.has(p)) {
      params.delete(p);
      changed = true;
    }
  }
  const rest = params.toString();
  return { error, failedExchange, cleanSearch: rest ? `?${rest}` : '', changed };
}

/**
 * String 16, "didn't finish": the press was recent (the mark is fresh), no `error` came back, and this load is a return rather than a
 * fresh visit: Back from Google (a back-forward navigation or a page restored from the cache) or the proxy's bounce after a failed
 * verifier exchange. A fresh visit with a stale mark (signed in, signed out, pressed Sign in again) shows nothing.
 */
export function didNotFinish(r: { fresh: boolean; error: string | null; failedExchange: boolean; backForward: boolean }): boolean {
  return r.fresh && r.error === null && (r.failedExchange || r.backForward);
}
