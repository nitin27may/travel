// The sign-in merge of favourites (visitor spec 4.4; navigation-and-mine.md 4.2): pure, so the route (FAV-2) and its property tests
// share one rule. Same shape as NAV-C's `planMerge` (copies.ts):
//   - union: every device favourite that resolves to a public page and that the account lacks is inserted;
//   - the account wins: a ref it already holds keeps its own `favoured_at` (`insert ... on conflict (user_id, ref) do nothing
//     returning ref`);
//   - cap 500: the account's rows first, then the device's newest first; what does not fit stays on the device;
//   - idempotent and crash safe: re-planning against the account after the insert inserts nothing, and a device row leaves the device
//     only when the server CONFIRMED it (the answer's `taken`: inserted per `returning ref`, already held, or gone), review M2.
// Removal is not merged (spec 4.4 rule 7: no tombstones for removals); withdrawn and unknown refs are dropped and counted.
//
// Every entry point that receives JSON (the device list, account rows, the answer) takes `unknown` and parses (review C2).
import type { Checked } from "../schema/trip-custom.ts";
import { FAVOURITES_CAP, MERGED_MAX, type AccountFavourite, type FavItem, type FavouritesEnvelope, type MergeAnswer, type MergeItem, type ResolveRow } from "../schema/favourites.ts";
import { byCodePoint, handleOf, instant, newestFirst, parseAccountRows, parseMergeAnswer, parseMergeItems } from "./envelope.ts";

/** Resolves one handle or public ref (resolve.ts `resolveOne` over the server's index). */
export type Resolve = (asked: string) => ResolveRow;

const live = (r: ResolveRow | null): r is ResolveRow & { ref: string; slug: string } =>
  r !== null && (r.state === "current" || r.state === "moved" || r.state === "merged") && r.ref !== null && r.slug !== null;

/** Where a device item stands now: by its ref when it has one (stable across renames), else, or when that fails, by its handle. */
function resolveItem(item: MergeItem, resolve: Resolve): ResolveRow {
  const byRef = item.ref !== null ? resolve(item.ref) : null;
  if (live(byRef) && byRef.space === item.space) return byRef;
  return resolve(handleOf(item));
}

export interface FavMergePlan {
  /** rows to insert, newest first; each `favouredAt` is the earliest of the device items that resolved to it */
  insert: AccountFavourite[];
  /** ref -> the device handles an insert of it would take (more than one when two slugs resolve to one survivor) */
  handlesByRef: Record<string, string[]>;
  /** device handles whose ref the account already holds: the account wins, or a re-run after a crash */
  already: string[];
  /** device handles that no longer name a public page */
  dropped: { handle: string; state: "withdrawn" | "unknown" }[];
  /** device handles over the cap: they stay on the device */
  overCap: string[];
}

/** Every device handle an insert would take. */
export const insertedHandles = (p: FavMergePlan): string[] => p.insert.flatMap((r) => p.handlesByRef[r.ref] ?? []);

/**
 * Plans one device list into one account. The device list is parsed whole (a list that fails is refused, with paths); the account
 * rows too. Every device item lands in exactly one of an insert, `already`, `dropped`, `overCap`. Never more than `cap` rows in the
 * account (an account already over it gains nothing), never two rows with one ref.
 */
export function planFavouritesMerge(deviceInput: unknown, accountInput: unknown, resolve: Resolve, cap: number = FAVOURITES_CAP): Checked<FavMergePlan> {
  const device = parseMergeItems(deviceInput);
  if (!device.success) return device;
  const account = parseAccountRows(accountInput);
  if (!account.success) return { success: false, issues: account.issues.map((i) => `account ${i}`) };
  const held = new Set(account.data.map((a) => a.ref));
  const plan: FavMergePlan = { insert: [], handlesByRef: {}, already: [], dropped: [], overCap: [] };
  const groups = new Map<string, { ref: string; space: AccountFavourite["space"]; handles: string[]; newest: string; earliest: string }>();
  for (const item of device.data) {
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
      if (instant(item.favouredAt) > instant(g.newest)) g.newest = item.favouredAt;
      if (instant(item.favouredAt) < instant(g.earliest)) g.earliest = item.favouredAt;
    } else groups.set(r.ref, { ref: r.ref, space: r.space ?? item.space, handles: [h], newest: item.favouredAt, earliest: item.favouredAt });
  }
  let room = Math.max(0, cap - account.data.length);
  const order = [...groups.values()].sort((a, b) => instant(b.newest) - instant(a.newest) || byCodePoint(a.ref, b.ref));
  for (const g of order) {
    if (room <= 0) {
      plan.overCap.push(...g.handles);
      continue;
    }
    room--;
    plan.insert.push({ ref: g.ref, space: g.space, favouredAt: g.earliest });
    plan.handlesByRef[g.ref] = g.handles;
  }
  return { success: true, data: plan };
}

/**
 * What a database does with the plan's insert (`on conflict do nothing returning ref`), for tests and an in-memory store: the account
 * after it and the refs it returned. `refuse` simulates rows the cap trigger rejected.
 */
export function applyPlan(account: readonly AccountFavourite[], plan: FavMergePlan, refuse: ReadonlySet<string> = new Set()): { account: AccountFavourite[]; returned: string[] } {
  const held = new Set(account.map((a) => a.ref));
  const rows = plan.insert.filter((r) => !held.has(r.ref) && !refuse.has(r.ref));
  return { account: [...account, ...rows], returned: rows.map((r) => r.ref) };
}

/**
 * The account rows as the cache shows them (visitor spec 4.4 step 3): parsed, resolved, with snapshots, newest first. A merged row
 * folds into its survivor (one row per ref, the earlier instant); a withdrawn row is a tombstone under its reserved slug ("No longer
 * listed"). A row that resolves to nothing has no slug to show: it is returned in `unresolvable` for FAV-2 to report or clean up.
 */
export function cacheItemsOf(rowsInput: unknown, resolve: Resolve, at: Date): Checked<{ items: FavItem[]; unresolvable: string[] }> {
  const rows = parseAccountRows(rowsInput);
  if (!rows.success) return rows;
  const byRef = new Map<string, FavItem>();
  const unresolvable: string[] = [];
  for (const row of rows.data) {
    const r = resolve(row.ref);
    if (live(r)) {
      const space = r.space ?? row.space;
      const prev = byRef.get(r.ref);
      if (prev) {
        if (instant(row.favouredAt) < instant(prev.favouredAt)) byRef.set(r.ref, { ...prev, favouredAt: row.favouredAt });
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
  return { success: true, data: { items: items.slice(0, FAVOURITES_CAP), unresolvable } };
}

/**
 * The merge route's answer. `returned` is the insert's `returning ref`, never the plan's insert list (review M2): a row the cap trigger
 * refused, or one another request inserted first, is not confirmed, so its handles stay on the device and the next merge finds them
 * `already` held or tries again. `accountAfter` is the account as read after the write.
 */
export function mergeAnswerOf(plan: FavMergePlan, returned: readonly string[], accountAfter: unknown, resolve: Resolve, at: Date): Checked<MergeAnswer> {
  const cache = cacheItemsOf(accountAfter, resolve, at);
  if (!cache.success) return cache;
  const got = new Set(returned);
  const confirmed = plan.insert.filter((r) => got.has(r.ref));
  return {
    success: true,
    data: {
      items: cache.data.items,
      added: confirmed.length,
      dropped: plan.dropped.length,
      overCap: plan.overCap.length,
      taken: [...confirmed.flatMap((r) => plan.handlesByRef[r.ref] ?? []), ...plan.already, ...plan.dropped.map((d) => d.handle)],
    },
  };
}

/**
 * After the server answered (parsed here): the device removes the handles the server confirmed and keeps everything else, and
 * `merged[h]` records the account (a hint; the MERGED_MAX most recent kept). Run only after the account cache was written, so a crash
 * before this re-merges to the same result.
 */
export function markFavouritesMerged(env: FavouritesEnvelope, answer: unknown, accountHash: string, at: Date): Checked<FavouritesEnvelope> {
  const a = parseMergeAnswer(answer);
  if (!a.success) return a;
  const gone = new Set(a.data.taken);
  const merged = Object.entries({ ...env.merged, [accountHash]: at.toISOString() })
    .sort((x, y) => instant(y[1]) - instant(x[1]) || byCodePoint(x[0], y[0]))
    .slice(0, MERGED_MAX);
  return { success: true, data: { ...env, items: env.items.filter((i) => !gone.has(handleOf(i))), merged: Object.fromEntries(merged) } };
}

/** The identity fields a device sends (P8: no snapshot leaves the device; the server resolves). */
export const mergeItemsOf = (env: FavouritesEnvelope): MergeItem[] =>
  env.items.map((i) => ({ space: i.space, slug: i.slug, ref: i.ref, favouredAt: i.favouredAt }));

/**
 * Whether this device should merge now (nav 4.2: on /account/ and /mine/ only): whenever the signed-out list holds anything (owner,
 * 26 Oct 2026). `merged[h]` is a hint only: it tells the first merge (the fuller toast) from a later one.
 */
export const mergeDue = (env: FavouritesEnvelope): boolean => env.items.length > 0;

/** True when this device has merged into this account before. */
export const mergedBefore = (env: FavouritesEnvelope, accountHash: string): boolean => accountHash in env.merged;
