import { pendingFresh } from '@/lib/auth/google';
import { parsePublicRows, type WayRow, type WaysAnswer } from '@/lib/auth/ways';
import { readSession, removeSession, writeSession } from '@/lib/storage/safe';

/**
 * The calls of "Ways to sign in" (GSI-WAYS) to the guarded proxy: `link-social`, `unlink-account` and `list-accounts` under
 * `/api/auth/` (lib/auth/guard.ts, its GSI-WAYS block). Plain same-origin `fetch`: the section needs the status, the guard's `code`
 * and `Retry-After`. Paths end in `/` (`trailingSlash`).
 */
export interface WaysReply extends WaysAnswer {
  body: Record<string, unknown> | null;
}

export async function waysCall(path: 'link-social' | 'unlink-account', body: Record<string, unknown>): Promise<WaysReply> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 0, code: 'OFFLINE', retryAfterS: null, body: null };
  let res: Response;
  try {
    res = await fetch(`/api/auth/${path}/`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
  } catch {
    return { status: 0, code: typeof navigator !== 'undefined' && navigator.onLine === false ? 'OFFLINE' : 'NETWORK', retryAfterS: null, body: null };
  }
  let json: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await res.json();
    json = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  const retry = Number(res.headers.get('retry-after'));
  return { status: res.status, code: typeof json?.code === 'string' ? json.code : '', retryAfterS: Number.isFinite(retry) && retry > 0 ? retry : null, body: json };
}

/** The rows as the guard lists them (provider and date only); null when the call or its answer fails. */
export async function listWays(): Promise<WayRow[] | null> {
  try {
    const res = await fetch('/api/auth/list-accounts/', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return null;
    return parsePublicRows(await res.json());
  } catch {
    return null;
  }
}

/**
 * The Add Google mark (`sessionStorage`, this tab only, a press time in ms, nothing else): set at the press, read and removed once on
 * the return. An `error` on `/account/` is explained only after a recent press from this tab, so a crafted link cannot show one.
 */
const ADD_MARK = 'auth.googleAdd';

export function markGoogleAdd(now: number): void {
  writeSession(ADD_MARK, String(now));
}

/** True when this tab pressed Add Google within the pending window; the mark is removed either way. */
export function takeGoogleAdd(now: number): boolean {
  const mark = readSession(ADD_MARK);
  removeSession(ADD_MARK);
  return pendingFresh(mark, now);
}
