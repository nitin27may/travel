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
 * The owner tag of a party the account writes (review ACCT-PSEC B2): SHA-256 of the user id, first 16 hex characters, the same value as
 * `accountHash` in core/src/favourites/account.ts (pinned by a test; copied here so this lazy chunk does not carry the favourites code).
 * Not a secret and never the raw id. Null where Web Crypto is missing (an insecure origin): the caller then writes nothing.
 */
export async function ownerHash(userId: string): Promise<string | null> {
  try {
    const bytes = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId)));
    return [...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/** True when the kept party was written by an account other than `owner` (or by an account before the owner tag existed). */
export function foreignParty(owner: string): boolean {
  const origin = readPartySource();
  return origin !== null && origin.by !== owner;
}

/**
 * The table of 5.2 for a load of Account or Mine, and for the sign-in card: nothing on the device writes the account's party; the
 * same party is rewritten with `src: "account"`; a party this browser chose itself is left alone (Account then shows the notice); a
 * party an earlier seed of THIS account wrote is brought up to date (a birthday, a change on another device), because the browser never
 * edited it; a party another account wrote is replaced, never offered to this one (B2). `owner` is `ownerHash(user id)`.
 */
export function seedParty(account: Party, owner: string): SeedOutcome {
  const device = readParty();
  const origin = readPartySource();
  if (device && !sameParty(device, account) && origin === null) return 'differs';
  const same = device !== null && sameParty(device, account) && (origin === null || origin.by === owner);
  return writeParty(account, { src: 'account', by: owner }) ? (same ? 'same' : 'seeded') : 'blocked';
}

/** Save travellers on Account, "Use saved travellers here", or setup: the person just chose it, so it replaces anything. */
export const setAccountParty = (account: Party, owner: string): boolean => writeParty(account, { src: 'account', by: owner });

/**
 * Remove saved travellers: the party stays (the person may be mid-trip) but is this browser's own from now on. A party another account
 * wrote is removed instead: it was never this person's to keep.
 */
export function keepPartyAsOwn(owner: string): void {
  const origin = readPartySource();
  if (origin === null) return;
  if (origin.by !== owner) {
    clearParty();
    return;
  }
  const device = readParty();
  if (device) writeParty(device);
}

/**
 * An account with nothing saved (Account, Mine, the sign-in card): a party another account wrote goes (B2: a shared computer shows
 * nothing of the previous person). This account's own earlier seed and the browser's own party stay. True when one was removed.
 */
export function dropForeignParty(owner: string): boolean {
  return foreignParty(owner) ? clearParty() : false;
}

/** The "Filled in from this browser" prefill: the device party, unless another account wrote it (then nothing is offered). */
export function prefillParty(owner: string): Party | null {
  return foreignParty(owner) ? null : readParty();
}

/** Sign-out and every lost session: a party an account put here goes; one the browser had of its own stays (5.4). True when one was removed. */
export function clearAccountParty(): boolean {
  if (readPartySource() === null) return false;
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
 * answers 401 for any other. Nothing saved removes a party another account wrote; a 401 removes any account's party (B2).
 */
export async function seedFromAccount(userId: string, timeoutMs: number = SEED.timeoutMs): Promise<SeedOutcome | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const owner = await ownerHash(userId);
    if (!owner) return null;
    const res = await fetch('/api/account/profile/party/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId }), signal: ctl.signal, cache: 'no-store' });
    if (res.status === 401) {
      // the session ended or is someone else's: no account's party may stay (B2)
      clearAccountParty();
      return null;
    }
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (!isAnswer(body)) return null;
    if (body.adults === null) {
      dropForeignParty(owner);
      return null;
    }
    return seedParty({ adults: body.adults, children: body.children }, owner);
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
