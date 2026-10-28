'use client';

import type { SealedLiveQuery } from '@neon/realtime/client';
import { PARTY_KEY } from '@/lib/storage/deviceKeys';
import { readLocal, removeLocal } from '@/lib/storage/safe';

/**
 * Remove a party an account wrote to this browser (`travel.party` with `src: "account"`, spec 5.4; review ACCT-PSEC B2). A party the
 * browser chose itself stays. Hand-written on the raw value, not through partyKey.ts: this module is in the signed-in shell's chunk,
 * and core party.ts must stay out of it (UXB-2 review S6). True when one was removed.
 */
export function dropAccountParty(): boolean {
  const raw = readLocal(PARTY_KEY);
  if (raw === null) return false;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return false;
  }
  if (typeof v !== 'object' || v === null || (v as { src?: unknown }).src !== 'account') return false;
  return removeLocal(PARTY_KEY);
}

/**
 * A full session change must unload all prior-user client state. After sign-out, or a renewal or
 * write the server refuses (401), reload to the home page: that drops the Realtime client and the
 * previous user's rows, and re-reads the session from scratch. Same-origin by construction
 * (`window.location`), so a cross-origin page cannot trigger a silent renewal. A party an account wrote goes first, on every path that
 * ends here (a 401 on a write or a renewal, not only Sign out), so the next person on this browser never plans with it (B2).
 */
export function leaveSession(): void {
  dropAccountParty();
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
