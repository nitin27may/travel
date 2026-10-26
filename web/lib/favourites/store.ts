import { addFavourite, handleOf, markNoteSeen, removeFavourite, restoreFavourite, updateFavourites } from '@travel/core/favourites/envelope.ts';
import type { FavInput } from '@travel/core/favourites/envelope.ts';
import { FAV_LOCAL_KEY } from '@travel/core/schema/favourites.ts';
import type { FavItem, FavouritesEnvelope, FavSpace } from '@travel/core/schema/favourites.ts';
import { notifyMineChanged } from '@/lib/mine/dot';
import { fallBackToMemory, mineStorage } from '@/lib/mine/storage';
import { setSession } from './light';

/**
 * Favourites on this device (FAV-1, visitor spec 4.2 to 4.3): every write the heart and Mine make. Writes go only through the core's
 * compare-and-set `updateFavourites`; a `newer`, `corrupt` or `invalid` envelope is refused and left as it is. A store that refuses or
 * drops the write moves this page to the per-tab memory list (the session-only path). `notifyMineChanged` follows every write, so the
 * Mine dot and the other hearts on the page update. Client only; loaded on the first tap, never at start (tests/favourites/boundary).
 */
export { FAV_LOCAL_KEY };

export type Failure = 'corrupt' | 'newer' | 'invalid' | 'changed' | 'quota' | 'blocked' | 'unverified' | 'refused';

export type AddOutcome =
  | { kind: 'added'; item: FavItem; /** the first heart on this device: show the first-save note */ first: boolean; /** kept in this page's memory only */ session: boolean }
  | { kind: 'exists'; item: FavItem }
  | { kind: 'cap' }
  | { kind: 'failed'; reason: Failure };

type Run<T> = ReturnType<typeof updateFavourites<T>>;

/** Runs a change against the device's storage; a store that refuses or drops the write falls back to memory and runs it once more there. */
function run<T>(change: (env: FavouritesEnvelope) => { envelope: FavouritesEnvelope | null; value: T }): { r: Run<T>; session: boolean } {
  let probe = mineStorage();
  let r = updateFavourites(probe.storage, FAV_LOCAL_KEY, change);
  if (!r.ok && probe.kind === 'local' && (r.reason === 'blocked' || r.reason === 'unverified' || r.reason === 'quota')) {
    probe = fallBackToMemory();
    r = updateFavourites(probe.storage, FAV_LOCAL_KEY, change);
  }
  const session = probe.kind === 'memory';
  if (session && r.ok) setSession(r.envelope.items.map(handleOf));
  return { r, session };
}

/** Adds a favourite, newest first. The first one on a device also marks the note seen, in the same write. */
export function addHeart(input: FavInput, now: Date = new Date()): AddOutcome {
  const { r, session } = run((env) => {
    const a = addFavourite(env, input, { now });
    if (!a.ok) return { envelope: null, value: a as ReturnType<typeof addFavourite> };
    return { envelope: a.unchanged ? a.envelope : a.first ? markNoteSeen(a.envelope, now) : a.envelope, value: a as ReturnType<typeof addFavourite> };
  });
  if (r.ok) {
    const a = r.value;
    if (!a.ok) return { kind: 'failed', reason: 'invalid' };
    if (a.unchanged) return { kind: 'exists', item: a.item };
    notifyMineChanged();
    return { kind: 'added', item: a.item, first: a.first, session };
  }
  const a = r.value;
  if (r.reason === 'refused' && a && !a.ok) return a.reason === 'cap' ? { kind: 'cap' } : { kind: 'failed', reason: 'invalid' };
  return { kind: 'failed', reason: r.reason };
}

/** Removes a favourite by page; returns the row for the toast's Undo. */
export function removeHeart(space: FavSpace, slug: string): { ok: true; removed: FavItem } | { ok: false; reason: Failure | 'absent' } {
  const { r } = run((env) => {
    const x = removeFavourite(env, space, slug);
    return x.removed ? { envelope: x.envelope, value: x.removed } : { envelope: null, value: null };
  });
  if (r.ok && r.value) {
    notifyMineChanged();
    return { ok: true, removed: r.value };
  }
  if (!r.ok && r.reason === 'refused') return { ok: false, reason: 'absent' };
  return { ok: false, reason: r.ok ? 'absent' : r.reason };
}

/** Undo of a removal: the row goes back where its time puts it. False when it was hearted again meanwhile or the list is full. */
export function restoreHeart(item: FavItem): boolean {
  const { r } = run((env) => {
    const x = restoreFavourite(env, item);
    return x.ok ? { envelope: x.envelope, value: null } : { envelope: null, value: null };
  });
  if (r.ok) notifyMineChanged();
  return r.ok;
}
