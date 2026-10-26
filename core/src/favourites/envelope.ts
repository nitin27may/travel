// The device rules of favourites/1 (visitor spec 4.2 to 4.5): parse, read, write, add, remove, undo, the notice, and applying a
// resolve answer (moved, merged, withdrawn). Pure: the browser's storage is passed in (web/lib/favourites/** in FAV-1), so every rule
// runs in a test or a server. Storage probing is NAV-C's one probe (copies.ts `probeStorage`), shared, not repeated.
import { isQuotaError, type StorageLike, type WriteResult } from "../schema/copies.ts";
import { issuesOf, type Checked } from "../schema/trip-custom.ts";
import {
  FAVOURITES_CAP,
  favItem,
  favouritesEnvelope,
  HANDLE_RE,
  SNOOZE_DAYS,
  SNOOZE_MORE,
  emptyFavourites,
  type FavItem,
  type FavouritesEnvelope,
  type FavSpace,
  type ResolveRow,
} from "../schema/favourites.ts";

/** The device key of a favourite: `place:<slug>` or `trip:<slug>`, the same handle `resolveRefs` takes. */
export const handleOf = (x: { space: FavSpace; slug: string }): string => `${x.space}:${x.slug}`;

/** A handle's parts, or null when it is not a handle (a public ref, or junk). */
export function parseHandle(h: string): { space: FavSpace; slug: string } | null {
  const m = HANDLE_RE.exec(h);
  return m ? { space: m[1] as FavSpace, slug: m[2]! } : null;
}

// ---- parsing ----

/** The rules JSON Schema cannot hold: one row per handle, one row per known ref, a trip has no kind. Paths and rules, never a value. */
export function favouritesRules(e: FavouritesEnvelope): string[] {
  const out: string[] = [];
  const handles = e.items.map(handleOf);
  if (new Set(handles).size !== handles.length) out.push("$.items: one favourite per page");
  const refs = e.items.map((i) => i.ref).filter((r): r is string => r !== null);
  if (new Set(refs).size !== refs.length) out.push("$.items: one favourite per ref");
  e.items.forEach((i, n) => {
    if (i.space === "trip" && i.kind !== null) out.push(`$.items.${n}.kind: a trip has no kind`);
  });
  return out;
}

export function parseFavourites(x: unknown): Checked<FavouritesEnvelope> {
  const r = favouritesEnvelope.safeParse(x);
  if (!r.success) return { success: false, issues: issuesOf(r.error) };
  const rules = favouritesRules(r.data);
  return rules.length ? { success: false, issues: rules } : { success: true, data: r.data };
}

// ---- reading and writing (the copies.ts pattern) ----

export type FavReadResult =
  | { ok: true; envelope: FavouritesEnvelope; /** nothing was stored: a fresh envelope */ fresh: boolean }
  | { ok: false; reason: "corrupt" | "newer" | "invalid"; issues: string[] };

function versionOf(x: unknown): number | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const s = (x as { schema?: unknown }).schema;
  const m = typeof s === "string" ? /^favourites\/(\d+)$/.exec(s) : null;
  return m ? Number(m[1]) : null;
}

/**
 * Reads the stored text of either key. Absent: a fresh envelope. Not JSON: `corrupt`. `favourites/2` from a newer tab: `newer`. Anything
 * else that fails: `invalid`. A failed read never writes; the caller shows the error state and leaves the value as it is.
 */
export function readFavourites(raw: string | null): FavReadResult {
  if (raw === null) return { ok: true, envelope: emptyFavourites(), fresh: true };
  let x: unknown;
  try {
    x = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt", issues: ["$: not JSON"] };
  }
  const v = versionOf(x);
  if (v !== null && v > 1) return { ok: false, reason: "newer", issues: [`$.schema: favourites/${v}`] };
  const r = parseFavourites(x);
  return r.success ? { ok: true, envelope: r.data, fresh: false } : { ok: false, reason: "invalid", issues: r.issues };
}

/** Validates, writes and reads back (copies.ts `writeCopies`); never writes an envelope that fails its own rules. */
export function writeFavourites(storage: StorageLike, key: string, env: FavouritesEnvelope): WriteResult {
  if (!parseFavourites(env).success) return { ok: false, reason: "invalid" };
  const text = JSON.stringify(env);
  try {
    storage.setItem(key, text);
    if (storage.getItem(key) !== text) return { ok: false, reason: "unverified" };
  } catch (e) {
    return { ok: false, reason: isQuotaError(e) ? "quota" : "blocked" };
  }
  return { ok: true };
}

// ---- device mutations ----

/** What the heart supplies: the page's slug, and the light row when the page has it (else the first resolve fills it). */
export interface FavInput {
  space: FavSpace;
  slug: string;
  ref?: string | null;
  name?: string | null;
  kind?: string | null;
  cc?: string | null;
}

export type FavAddResult =
  | {
      ok: true;
      envelope: FavouritesEnvelope;
      item: FavItem;
      /** already a favourite (same page, or the same ref under an old slug): the envelope is returned as it was */
      unchanged: boolean;
      /** the first heart since the toast was last unseen on this device: show the first-save toast, then `markNoteSeen` */
      first: boolean;
    }
  | { ok: false; reason: "cap" }
  | { ok: false; reason: "invalid"; issues: string[] };

export const isFavourite = (env: FavouritesEnvelope, space: FavSpace, slug: string): boolean => env.items.some((x) => x.space === space && x.slug === slug);

/**
 * Adds a favourite, newest first. A second heart on the same page (or the same ref under an old slug) is `unchanged`: dedupe, never a
 * second row. The 501st is `cap` (copy "You have 500 favourites, the most we keep."). A tap on a tombstoned row is unchanged too.
 */
export function addFavourite(env: FavouritesEnvelope, input: FavInput, opts: { now: Date }): FavAddResult {
  const existing = env.items.find((x) => (x.space === input.space && x.slug === input.slug) || (input.ref && x.ref === input.ref)) ?? null;
  if (existing) return { ok: true, envelope: env, item: existing, unchanged: true, first: false };
  if (env.items.length >= FAVOURITES_CAP) return { ok: false, reason: "cap" };
  const r = favItem.safeParse({
    space: input.space,
    slug: input.slug,
    ref: input.ref ?? null,
    name: input.name ?? null,
    kind: input.space === "trip" ? null : (input.kind ?? null),
    cc: input.cc ?? null,
    favouredAt: opts.now.toISOString(),
    unlistedAt: null,
  });
  if (!r.success) return { ok: false, reason: "invalid", issues: issuesOf(r.error) };
  return { ok: true, envelope: { ...env, items: [r.data, ...env.items] }, item: r.data, unchanged: false, first: env.noteSeen === null };
}

/** Removes by page; returns the removed row for the toast's Undo. */
export function removeFavourite(env: FavouritesEnvelope, space: FavSpace, slug: string): { envelope: FavouritesEnvelope; removed: FavItem | null } {
  const removed = env.items.find((x) => x.space === space && x.slug === slug) ?? null;
  return { envelope: removed ? { ...env, items: env.items.filter((x) => x !== removed) } : env, removed };
}

/** Undo of remove: back in its place by time, unless hearted again meanwhile or the cap is reached. */
export function restoreFavourite(env: FavouritesEnvelope, item: FavItem): { ok: boolean; envelope: FavouritesEnvelope } {
  const clash = env.items.some((x) => handleOf(x) === handleOf(item) || (item.ref !== null && x.ref === item.ref));
  if (clash || env.items.length >= FAVOURITES_CAP) return { ok: false, envelope: env };
  return { ok: true, envelope: { ...env, items: newestFirst([...env.items, item]) } };
}

/** Newest first, then by handle, so two devices order the same list the same way. */
export const newestFirst = (items: readonly FavItem[]): FavItem[] =>
  [...items].sort((a, b) => b.favouredAt.localeCompare(a.favouredAt) || handleOf(a).localeCompare(handleOf(b)));

// ---- the note and the notice (visitor spec 14) ----

/** After the first-save toast was shown. */
export const markNoteSeen = (env: FavouritesEnvelope, at: Date): FavouritesEnvelope => (env.noteSeen ? env : { ...env, noteSeen: at.toISOString() });

/** "Got it": hidden for SNOOZE_DAYS, or until SNOOZE_MORE more favourites. */
export function snoozeNotice(env: FavouritesEnvelope, at: Date): FavouritesEnvelope {
  const until = new Date(at.getTime() + SNOOZE_DAYS * 86_400_000).toISOString();
  return { ...env, snoozedUntil: until, snoozedAtCount: env.items.length };
}

/** Whether the signed-out device notice shows: a non-empty list that is not snoozed. */
export function noticeDue(env: FavouritesEnvelope, now: Date): boolean {
  if (env.items.length === 0) return false;
  if (env.snoozedUntil === null) return true;
  if (now.getTime() >= Date.parse(env.snoozedUntil)) return true;
  return env.snoozedAtCount !== null && env.items.length >= env.snoozedAtCount + SNOOZE_MORE;
}

// ---- applying a resolve answer (visitor spec 4.5) ----

export interface ResolutionReport {
  envelope: FavouritesEnvelope;
  /** rows whose slug or ref changed (`moved`, or `merged` into a survivor not yet held) */
  moved: number;
  /** rows merged into a survivor the list already held: folded into it */
  folded: number;
  /** rows newly tombstoned */
  unlisted: number;
  /** tombstones lifted (the page is listed again) */
  relisted: number;
  /** true when anything changed: the caller writes only then */
  changed: boolean;
}

/**
 * Applies `resolveRefs` rows to the list: snapshots refresh, a moved row takes its new slug and ref, a merged row becomes its survivor
 * (folded into the survivor's row if the list holds it, keeping the earlier `favouredAt`), a withdrawn or unknown row is tombstoned (it
 * stays, reading "No longer listed", never removed silently) and a listed-again row loses its tombstone. Rows are matched by the handle
 * or ref they were asked by (`asked`). Idempotent: applying the same answer twice changes nothing the second time.
 */
export function applyResolution(env: FavouritesEnvelope, rows: readonly ResolveRow[], at: Date): ResolutionReport {
  const byAsked = new Map(rows.map((r) => [r.asked, r]));
  let moved = 0;
  let folded = 0;
  let unlisted = 0;
  let relisted = 0;
  const out: FavItem[] = [];
  const indexOf = (x: { space: FavSpace; slug: string; ref: string | null }): number =>
    out.findIndex((y) => handleOf(y) === handleOf(x) || (x.ref !== null && y.ref === x.ref));
  // rows that do not move first, so a survivor already held keeps its own row and a merged row folds into it
  const answerOf = (i: FavItem): ResolveRow | undefined => byAsked.get(handleOf(i)) ?? (i.ref ? byAsked.get(i.ref) : undefined);
  const order = [...env.items].sort((a, b) => rank(answerOf(a)) - rank(answerOf(b)));
  for (const item of order) {
    const a = answerOf(item);
    if (!a || (a.space !== null && a.space !== item.space)) {
      out.push(item);
      continue;
    }
    if (a.state === "withdrawn" || a.state === "unknown") {
      if (item.unlistedAt === null) unlisted++;
      out.push(item.unlistedAt === null ? { ...item, unlistedAt: at.toISOString() } : item);
      continue;
    }
    const next: FavItem = {
      ...item,
      slug: a.slug ?? item.slug,
      ref: a.ref ?? item.ref,
      name: a.name ?? item.name,
      kind: item.space === "trip" ? null : (a.kind ?? item.kind),
      cc: a.cc ?? item.cc,
      unlistedAt: null,
    };
    if (item.unlistedAt !== null) relisted++;
    const held = indexOf(next);
    if (held >= 0) {
      const keep = out[held]!;
      out[held] = keep.favouredAt <= next.favouredAt ? keep : { ...keep, favouredAt: next.favouredAt };
      folded++;
      continue;
    }
    if (a.state === "moved" || a.state === "merged") moved++;
    out.push(next);
  }
  const items = newestFirst(out);
  const changed = JSON.stringify(items) !== JSON.stringify(newestFirst(env.items));
  return { envelope: changed ? { ...env, items } : env, moved, folded, unlisted, relisted, changed };
}

const rank = (a: ResolveRow | undefined): number => (a && (a.state === "moved" || a.state === "merged") ? 1 : 0);

/** The handles to resolve for one page of the list (at most RESOLVE_MAX): the visible rows, as `resolveRefs` takes them. */
export const handlesFor = (items: readonly FavItem[]): string[] => items.map(handleOf);
