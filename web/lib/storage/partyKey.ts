// The device party (`travel.party`): see keys.ts for the contract. Split from tripUi.ts so that the code which only remembers a tab
// (the trip page's lazy tab-state chunk) does not carry core party.ts, which Turbopack does not tree-shake (UXB-2 review S6).
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

/** Keeps the party on this device. False when storage is blocked or full (the page keeps working from the URL). */
export function writeParty(p: Party): boolean {
  const clean = cleanParty(p);
  if (!clean) return false;
  const ok = writeLocal(PARTY_KEY, JSON.stringify({ v: 1, adults: clean.adults, children: clean.children }));
  if (ok) {
    try {
      window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
    } catch {
      /* no window (a test or the server): nothing to tell */
    }
  }
  return ok;
}

export const clearParty = (): boolean => removeLocal(PARTY_KEY);

