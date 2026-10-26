// The sign-in merge of favourites (visitor spec 4.4; navigation-and-mine.md 4.2): pure, so the route (FAV-2) and its property tests
// share one rule. Same shape as NAV-C's `planMerge` (copies.ts):
//   - union: every device favourite that resolves to a public page and that the account lacks is inserted;
//   - the account wins: a ref it already holds keeps its own `favoured_at` (`insert ... on conflict (user_id, ref) do nothing`);
//   - cap 500: the account's rows first, then the device's newest first; what does not fit stays on the device;
//   - idempotent and crash safe: re-planning against the account after the insert inserts nothing, and the device is emptied only from
//     the server's answer (`keep`), so a tab that dies between the two steps re-merges to the same result.
// Removal is not merged (spec 4.4 rule 7: no tombstones for removals); withdrawn and unknown refs are dropped and counted.
import { FAVOURITES_CAP, type AccountFavourite, type FavItem, type FavouritesEnvelope, type MergeAnswer, type MergeItem, type ResolveRow } from "../schema/favourites.ts";
import { handleOf, newestFirst } from "./envelope.ts";

/** Resolves one handle or public ref (resolve.ts `resolveOne` over the server's index). */
export type Resolve = (asked: string) => ResolveRow;

const live = (r: ResolveRow | null): r is ResolveRow & { ref: string; slug: string } =>
  r !== null && (r.state === "current" || r.state === "moved" || r.state === "merged") && r.ref !== null && r.slug !== null;

/** Where a device item stands now: by its ref when it has one (stable across renames), else, or when that fails, by its handle. */
export function resolveItem(item: MergeItem, resolve: Resolve): ResolveRow {
  const byRef = item.ref !== null ? resolve(item.ref) : null;
  if (live(byRef) && byRef.space === item.space) return byRef;
  return resolve(handleOf(item));
}

export interface FavMergePlan {
  /** rows to insert, newest first; each `favouredAt` is the earliest of the device items that resolved to it */
  insert: AccountFavourite[];
  /** device handles taken by an insert (more than one when two slugs resolve to one survivor) */
  inserted: string[];
  /** device handles whose ref the account already holds: the account wins, or a re-run after a crash */
  already: string[];
  /** device handles that no longer name a public page */
  dropped: { handle: string; state: "withdrawn" | "unknown" }[];
  /** device handles over the cap: they stay on the device */
  overCap: string[];
}

/**
 * Plans one device list into one account. Every device item lands in exactly one of `inserted`, `already`, `dropped`, `overCap`.
 * Never more than `cap` rows in the account (an account already over it gains nothing), never two rows with one ref.
 */
export function planFavouritesMerge(
  device: readonly MergeItem[],
  account: readonly AccountFavourite[],
  resolve: Resolve,
  cap: number = FAVOURITES_CAP,
): FavMergePlan {
  const held = new Set(account.map((a) => a.ref));
  const plan: FavMergePlan = { insert: [], inserted: [], already: [], dropped: [], overCap: [] };
  // group the device items by the ref they resolve to now
  const groups = new Map<string, { ref: string; space: AccountFavourite["space"]; handles: string[]; newest: string; earliest: string }>();
  for (const item of device) {
    const h = handleOf(item);
    const r = resolveItem(item, resolve);
    if (!live(r)) {
      plan.dropped.push({ handle: h, state: r.state === "withdrawn" ? "withdrawn" : "unknown" });
      continue;
    }
    if (held.has(r.ref)) {
      plan.already.push(h);
      continue;
    }
    const g = groups.get(r.ref);
    if (g) {
      g.handles.push(h);
      if (item.favouredAt > g.newest) g.newest = item.favouredAt;
      if (item.favouredAt < g.earliest) g.earliest = item.favouredAt;
    } else groups.set(r.ref, { ref: r.ref, space: r.space ?? item.space, handles: [h], newest: item.favouredAt, earliest: item.favouredAt });
  }
  let room = Math.max(0, cap - account.length);
  const order = [...groups.values()].sort((a, b) => b.newest.localeCompare(a.newest) || a.ref.localeCompare(b.ref));
  for (const g of order) {
    if (room <= 0) {
      plan.overCap.push(...g.handles);
      continue;
    }
    room--;
    plan.insert.push({ ref: g.ref, space: g.space, favouredAt: g.earliest });
    plan.inserted.push(...g.handles);
  }
  return plan;
}

/** The account after the plan's insert ran with `on conflict do nothing`. */
export function applyPlan(account: readonly AccountFavourite[], plan: FavMergePlan): AccountFavourite[] {
  const held = new Set(account.map((a) => a.ref));
  return [...account, ...plan.insert.filter((r) => !held.has(r.ref))];
}

/**
 * The account rows as the cache shows them (visitor spec 4.4 step 3): resolved, with snapshots, newest first. A merged row folds into
 * its survivor (one row per ref, the earlier time); a withdrawn row is a tombstone under its reserved slug ("No longer listed"). A row
 * that resolves to nothing at all has no slug to show: it is returned in `unresolvable` for the route to report or clean up (FAV-2).
 */
export function cacheItemsOf(rows: readonly AccountFavourite[], resolve: Resolve, at: Date): { items: FavItem[]; unresolvable: string[] } {
  const byRef = new Map<string, FavItem>();
  const unresolvable: string[] = [];
  for (const row of rows) {
    const r = resolve(row.ref);
    if (live(r)) {
      const space = r.space ?? row.space;
      const prev = byRef.get(r.ref);
      if (prev) {
        if (row.favouredAt < prev.favouredAt) byRef.set(r.ref, { ...prev, favouredAt: row.favouredAt });
        continue;
      }
      byRef.set(r.ref, { space, slug: r.slug, ref: r.ref, name: r.name, kind: space === "trip" ? null : r.kind, cc: r.cc, favouredAt: row.favouredAt, unlistedAt: null });
    } else if (r.state === "withdrawn" && r.slug !== null) {
      // keyed by the account's ref so the Remove button can delete that row
      byRef.set(row.ref, { space: row.space, slug: r.slug, ref: row.ref, name: null, kind: null, cc: null, favouredAt: row.favouredAt, unlistedAt: at.toISOString() });
    } else unresolvable.push(row.ref);
  }
  // one row per handle too: a tombstone never shares a slug with a live row of its space, but guard it
  const seen = new Set<string>();
  const items = newestFirst([...byRef.values()]).filter((i) => (seen.has(handleOf(i)) ? false : (seen.add(handleOf(i)), true)));
  return { items: items.slice(0, FAVOURITES_CAP), unresolvable };
}

/** The merge route's answer, from the plan and the account after it. */
export function mergeAnswerOf(plan: FavMergePlan, accountAfter: readonly AccountFavourite[], resolve: Resolve, at: Date): MergeAnswer {
  return {
    items: cacheItemsOf(accountAfter, resolve, at).items,
    added: plan.insert.length,
    dropped: plan.dropped.length,
    overCap: plan.overCap.length,
    keep: [...plan.overCap],
  };
}

/**
 * After the server answered: the device keeps only what did not fit, and `merged[h]` records the account (once per device and account).
 * Run only after the account cache was written, so a crash before this re-merges to the same result.
 */
export function markFavouritesMerged(env: FavouritesEnvelope, keep: readonly string[], accountHash: string, at: Date): FavouritesEnvelope {
  const k = new Set(keep);
  return { ...env, items: env.items.filter((i) => k.has(handleOf(i))), merged: { ...env.merged, [accountHash]: at.toISOString() } };
}

/** The identity fields a device sends (P8: no snapshot leaves the device; the server resolves). */
export const mergeItemsOf = (env: FavouritesEnvelope): MergeItem[] =>
  env.items.map((i) => ({ space: i.space, slug: i.slug, ref: i.ref, favouredAt: i.favouredAt }));

/**
 * Whether this device should merge now (nav 4.2: on /account/ and /mine/ only): whenever the signed-out list holds anything. Spec 4.4
 * step 1 also asks for `merged[h]` absent, but its event table merges again what was saved signed out after the first merge, and the
 * merge is idempotent, so the list is never stranded; `merged[h]` only tells the first merge (the fuller toast) from a later one.
 */
export const mergeDue = (env: FavouritesEnvelope): boolean => env.items.length > 0;

/** True when this device has merged into this account before. */
export const mergedBefore = (env: FavouritesEnvelope, accountHash: string): boolean => accountHash in env.merged;
