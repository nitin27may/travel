// The account cache (visitor spec 4.2, 4.4): `travel.fav.acct.<h>`, the hash, which keys to delete on sign-out or a user switch, and the
// offline write queue (`pending`). Pure apart from `accountHash`, which uses Web Crypto (the browser's and Node's `crypto.subtle`).
import type { StorageLike } from "../schema/copies.ts";
import { ACCOUNT_HASH_RE, FAV_ACCOUNT_KEY_PREFIX, FAV_LOCAL_KEY, FAVOURITES_CAP, PENDING_MAX, emptyFavourites, type FavItem, type FavouritesEnvelope, type FavPending } from "../schema/favourites.ts";
import { handleOf, newestFirst, parseMergeAnswer, updateFavourites } from "./envelope.ts";
import { markFavouritesMerged } from "./merge.ts";

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

export type FinishResult =
  | { ok: true; local: FavouritesEnvelope; cache: FavouritesEnvelope }
  | { ok: false; step: "answer" | "unload" | "cache" | "local"; reason: string };

/**
 * The device side of a merge, after the server answered (visitor spec 4.4 step 3), in the one order that is safe to crash anywhere:
 *   1. unload every other account's cache (V12: a shared computer must not show the previous person's list);
 *   2. write this account's cache from the answer (compare-and-set);
 *   3. remove from the local list the handles the server confirmed (`taken`), and record the account in `merged` (compare-and-set).
 * A failure at any step returns before the next, so the local list is never emptied unless the account's list is on this device too;
 * a re-run (the next visit to /account/ or /mine/) asks the server again, which answers the same (the merge is idempotent).
 * `keys` lists the storage keys present (the browser's `Object.keys(localStorage)`).
 */
export function finishMerge(storage: StorageLike, opts: { hash: string; answer: unknown; at: Date; keys: Iterable<string> }): FinishResult {
  const a = parseMergeAnswer(opts.answer);
  if (!a.success) return { ok: false, step: "answer", reason: a.issues.join("; ") };
  try {
    for (const k of staleCacheKeys(opts.keys, opts.hash)) storage.removeItem(k);
  } catch {
    return { ok: false, step: "unload", reason: "blocked" };
  }
  let cacheKey: string;
  try {
    cacheKey = accountCacheKey(opts.hash);
  } catch {
    return { ok: false, step: "answer", reason: "not an account hash" };
  }
  const cache = updateFavourites(storage, cacheKey, (prev) => ({ envelope: cacheFrom(a.data.items, prev), value: null }));
  if (!cache.ok) return { ok: false, step: "cache", reason: cache.reason };
  let markIssue: string | null = null;
  const local = updateFavourites(storage, FAV_LOCAL_KEY, (env) => {
    const m = markFavouritesMerged(env, a.data, opts.hash, opts.at);
    if (!m.success) markIssue = m.issues.join("; ");
    return { envelope: m.success ? m.data : null, value: null };
  });
  if (!local.ok) return { ok: false, step: "local", reason: markIssue ?? local.reason };
  return { ok: true, local: local.envelope, cache: cache.envelope };
}
