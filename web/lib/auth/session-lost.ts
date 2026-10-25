'use client';

import type { SealedLiveQuery } from '@neon/realtime/client';

/**
 * A full session change must unload all prior-user client state. After sign-out, or a renewal or
 * write the server refuses (401), reload to the home page: that drops the Realtime client and the
 * previous user's rows, and re-reads the session from scratch. Same-origin by construction
 * (`window.location`), so a cross-origin page cannot trigger a silent renewal.
 */
export function leaveSession(): void {
  window.location.assign('/');
}

/**
 * Renew a sealed query, or leave the session on a 401. The server answers 401 when the session has
 * no user or a different user than the page was loaded for, which is the signal to unload.
 */
export async function renewOrLeave<Q extends SealedLiveQuery<unknown>>(fetchSeal: () => Promise<Response>): Promise<Q> {
  const res = await fetchSeal();
  if (res.status === 401) {
    leaveSession();
    // Keep the promise unresolved while the page unloads so the caller does not treat it as success.
    return new Promise<Q>(() => {});
  }
  if (!res.ok) throw new Error(`renew failed: ${res.status}`);
  return (await res.json()) as Q;
}
