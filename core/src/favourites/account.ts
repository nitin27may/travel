// The account cache (visitor spec 4.2, 4.4): `travel.fav.acct.<h>`, the hash, which keys to delete on sign-out or a user switch, and the
// offline write queue (`pending`). Pure apart from `accountHash`, which uses Web Crypto (the browser's and Node's `crypto.subtle`).
import { ACCOUNT_HASH_RE, FAV_ACCOUNT_KEY_PREFIX, FAVOURITES_CAP, PENDING_MAX, emptyFavourites, type FavItem, type FavouritesEnvelope, type FavPending } from "../schema/favourites.ts";
import { handleOf, newestFirst } from "./envelope.ts";

/**
 * SHA-256 of the user id, the first 16 hex characters (visitor spec 4.2). It names the cache key and the `merged` map entry; it is not a
 * secret and not an identifier the server accepts. Also a valid `copies/1` merged key, so Mine uses one hash for both envelopes.
 */
export async function accountHash(userId: string): Promise<string> {
  const bytes = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId)));
  return [...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function accountCacheKey(h: string): string {
  if (!ACCOUNT_HASH_RE.test(h)) throw new Error("an account hash is 16 lower-case hex characters");
  return `${FAV_ACCOUNT_KEY_PREFIX}${h}`;
}

/** The hash a cache key names, or null when the key is not an account cache. */
export function hashOfCacheKey(key: string): string | null {
  if (!key.startsWith(FAV_ACCOUNT_KEY_PREFIX)) return null;
  const h = key.slice(FAV_ACCOUNT_KEY_PREFIX.length);
  return ACCOUNT_HASH_RE.test(h) ? h : null;
}

/**
 * The cache keys to delete (spec 4.4 table, V12): on sign-out (`current` null) every account cache; when an account signs in, every
 * cache but its own (the previous account's is deleted first). A session that merely expired deletes nothing: the caller hides the cache
 * and calls this only on sign-out or a confirmed different account.
 */
export function staleCacheKeys(keys: Iterable<string>, current: string | null): string[] {
  return [...keys].filter((k) => {
    const h = hashOfCacheKey(k);
    return h !== null && h !== current;
  });
}

/** A fresh account cache from the server's list (merge answer, `read`), carrying any writes still waiting to be sent. */
export function cacheFrom(serverItems: readonly FavItem[], prev: FavouritesEnvelope | null): FavouritesEnvelope {
  const base = prev ?? emptyFavourites();
  const pending = base.pending;
  return { ...base, items: withPending(serverItems, pending, base.items), merged: {}, pending };
}

/**
 * Queues an offline write. Only the last write per favourite matters, so an earlier one for the same handle is dropped: the queue never
 * holds two entries for one handle and so stays within PENDING_MAX. Replay is in order.
 */
export function queuePending(env: FavouritesEnvelope, op: FavPending): FavouritesEnvelope {
  const h = handleOf(op);
  const rest = env.pending.filter((p) => handleOf(p) !== h && (op.ref === null || p.ref !== op.ref));
  const pending = [...rest, op].slice(-PENDING_MAX);
  return { ...env, pending };
}

/** After the server confirmed the writes up to and including `upTo` entries of the queue. */
export const dropSent = (env: FavouritesEnvelope, upTo: number): FavouritesEnvelope => ({ ...env, pending: env.pending.slice(Math.max(0, upTo)) });

/**
 * The list a signed-in visitor sees while writes wait: the server's list with the queue applied on top (an add the server lacks shows,
 * a remove hides its row). An add that would pass the cap is not shown; the server will refuse it the same way.
 */
export function withPending(serverItems: readonly FavItem[], pending: readonly FavPending[], known: readonly FavItem[] = []): FavItem[] {
  let items = [...serverItems];
  for (const p of pending) {
    const h = handleOf(p);
    const match = (i: FavItem) => handleOf(i) === h || (p.ref !== null && i.ref === p.ref);
    if (p.op === "remove") items = items.filter((i) => !match(i));
    else if (!items.some(match) && items.length < FAVOURITES_CAP) {
      // the snapshot the device already showed for it, if any
      const seen = known.find(match);
      items.push({ space: p.space, slug: p.slug, ref: p.ref ?? seen?.ref ?? null, name: seen?.name ?? null, kind: seen?.kind ?? null, cc: seen?.cc ?? null, favouredAt: p.at, unlistedAt: null });
    }
  }
  return newestFirst(items);
}
