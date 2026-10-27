// The account seeds the device party (ACCT-P2; docs/v2/features/account-profile-and-travellers.md 5.2 to 5.4). Imported only by /account/,
// /mine/ and the sign-in card's success path, always after hydration or as a lazy chunk: no public page loads it (N9). It carries no Zod
// and no travellers document: the party it handles is plain ages (`Party`), exactly what `travel.party` holds. A date of birth or
// `age_as_of` never reaches it, and the device never writes back to the account from here (5.3).
import { sameParty, type Party } from '@travel/core/trips/party.ts';
import { clearParty, readParty, readPartySource, writeParty } from '@/lib/storage/partyKey';

/** What a seed did: wrote the party, found the same one (and marked it), left a different one alone, or could not write. */
export type SeedOutcome = 'seeded' | 'same' | 'differs' | 'blocked';

/** The sign-in card waits this long for the party route; sign-in never depends on it (spec 5.2). */
export const SEED = { timeoutMs: 1500 } as const;

/**
 * The table of 5.2 for a load of Account or Mine, and for the sign-in card: nothing on the device writes the account's party; the
 * same party is rewritten with `src: "account"`; a party this browser chose itself is left alone (Account then shows the notice); a
 * party an earlier seed wrote is brought up to date (a birthday, a change on another device), because the browser never edited it.
 */
export function seedParty(account: Party): SeedOutcome {
  const device = readParty();
  if (device && !sameParty(device, account) && readPartySource() !== 'account') return 'differs';
  return writeParty(account, { src: 'account' }) ? (device && sameParty(device, account) ? 'same' : 'seeded') : 'blocked';
}

/** Save travellers on Account, "Use saved travellers here", or setup: the person just chose it, so it replaces anything. */
export const setAccountParty = (account: Party): boolean => writeParty(account, { src: 'account' });

/** Remove saved travellers: the party stays (the person may be mid-trip) but is this browser's own from now on. */
export function keepPartyAsOwn(): void {
  if (readPartySource() !== 'account') return;
  const device = readParty();
  if (device) writeParty(device);
}

/** Sign-out: a party the account put here goes; one the browser had of its own stays (5.4). True when one was removed. */
export function clearAccountParty(): boolean {
  if (readPartySource() !== 'account') return false;
  return clearParty();
}

/** The party route's answer: ages only. `adults: null` = nothing saved. */
export interface PartyAnswer {
  adults: number | null;
  children: number[];
}

const isAnswer = (x: unknown): x is PartyAnswer => {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as { adults?: unknown; children?: unknown };
  return (o.adults === null || (typeof o.adults === 'number' && Number.isInteger(o.adults))) && Array.isArray(o.children) && o.children.every((c) => Number.isInteger(c));
};

/**
 * Ask the account for its party and seed the device with it (Mine, the sign-in card). Never throws and never waits longer than
 * `timeoutMs`: it answers `null` when nothing was saved, the route failed or the time ran out. `userId` is the session's id; the route
 * answers 401 for any other.
 */
export async function seedFromAccount(userId: string, timeoutMs: number = SEED.timeoutMs): Promise<SeedOutcome | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/account/profile/party/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId }), signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (!isAnswer(body) || body.adults === null) return null;
    return seedParty({ adults: body.adults, children: body.children });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The signed-in user's id from the auth client (loaded here, lazily, so the chunk that imports this module stays small). */
export async function sessionUserId(): Promise<string | null> {
  try {
    const { getAuthClient } = await import('@/lib/auth/client');
    const r = (await getAuthClient().getSession()) as { data?: { user?: { id?: unknown } } } | null;
    const id = r?.data?.user?.id;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

/** Mine and the sign-in card: seed from the account for whoever is signed in. */
export async function seedForSession(timeoutMs: number = SEED.timeoutMs): Promise<SeedOutcome | null> {
  const work = sessionUserId().then((id) => (id ? seedFromAccount(id, timeoutMs) : null));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}
