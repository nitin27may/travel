// The device party (`travel.party`): see keys.ts for the contract, plus the optional `src: 'account'` of ACCT-PC (below). Split from
// tripUi.ts so that the code which only remembers a tab (the trip page's lazy tab-state chunk) does not carry core party.ts, which
// Turbopack does not tree-shake (UXB-2 review S6).
import { cleanParty, type Party } from '@travel/core/trips/party.ts';
import { readLocal, removeLocal, writeLocal } from './safe';

import { PARTY_KEY } from './deviceKeys';

export { PARTY_KEY };
/** Dispatched on `window` after this tab writes the party (the `storage` event covers other tabs). */
export const PARTY_CHANGED_EVENT = 'travel:party-changed';

const parse = (raw: string | null): unknown => {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

// ---- travel.party ---------------------------------------------------------------------------------------------------------

/** The stored party, cleaned to the limits; null when none is kept, the value is not version 1, or storage is blocked. */
export function readParty(): Party | null {
  const v = parse(readLocal(PARTY_KEY));
  if (!isObj(v) || v.v !== 1) return null;
  return cleanParty(v);
}

/**
 * Where a kept party came from (account-profile-and-travellers.md 5.2): `account` when the account seeded it (sign-in, Account, Mine),
 * absent when this browser chose it (the party editor, the copy sheet). `v` stays 1: `cleanParty` and `readParty` ignore the field,
 * so an old reader keeps working.
 */
export type PartySource = 'account';

/**
 * Whose account wrote the party (review ACCT-PSEC B2): `by` is `accountHash(user id)`, 16 lower-case hex characters, never the id. A
 * party with `src: 'account'` and no (or a malformed) `by` predates the tag and belongs to nobody known: `by` reads as null, which never
 * equals a signed-in owner, so the seed replaces or removes it.
 */
export interface PartyOrigin {
  src: PartySource;
  by: string | null;
}

/** An owner tag: the 16-hex `accountHash` of a user id. */
export const OWNER_RE = /^[0-9a-f]{16}$/;

/**
 * Keeps the party on this device. False when storage is blocked or full (the page keeps working from the URL). `src: 'account'` is
 * written only by the account seed (ACCT-P2's seed module, spec 5.2), with the owner's hash in `by`; every other write leaves both
 * out, so the party becomes this browser's own. This is the only writer of `src` and `by`.
 */
export function writeParty(p: Party, opts: { src?: PartySource; by?: string } = {}): boolean {
  const clean = cleanParty(p);
  if (!clean) return false;
  const value: { v: 1; adults: number; children: (number | null)[]; src?: PartySource; by?: string } = { v: 1, adults: clean.adults, children: clean.children };
  if (opts.src === 'account') {
    value.src = 'account';
    if (typeof opts.by === 'string' && OWNER_RE.test(opts.by)) value.by = opts.by;
  }
  const ok = writeLocal(PARTY_KEY, JSON.stringify(value));
  if (ok) {
    try {
      window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
    } catch {
      /* no window (a test or the server): nothing to tell */
    }
  }
  return ok;
}

/**
 * `{ src: 'account', by }` when the kept party was seeded from an account and not changed on this browser since; null otherwise (the
 * browser's own party, nothing kept, or blocked storage).
 */
export function readPartySource(): PartyOrigin | null {
  const v = parse(readLocal(PARTY_KEY));
  if (!isObj(v) || v.v !== 1 || cleanParty(v) === null || v.src !== 'account') return null;
  return { src: 'account', by: typeof v.by === 'string' && OWNER_RE.test(v.by) ? v.by : null };
}

export const clearParty = (): boolean => removeLocal(PARTY_KEY);

