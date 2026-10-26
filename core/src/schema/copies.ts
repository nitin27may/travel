// copies/1: the trip copies a visitor keeps in this browser without an account (navigation-and-mine.md 3). One envelope under
// `travel.copies.local`, validated on every read; a bad or newer envelope is left untouched and the list shows its error state.
//
// What lives here, all pure (no window, no DOM: web/lib/mine/** passes the browser's storage in, so this runs in a test or a server):
//   - the envelope and item schemas, with the Q204 limits (one copy per trip, 20 per device) and the size rules (nav 3.1);
//   - `probeStorage`: can this browser keep data, and if not, why (nav 3.3); `memoryStorage` is the per-tab fallback;
//   - `writeCopies` and `updateCopies`: compare-and-set writes, so a stale tab never overwrites a newer envelope or another tab's
//     change (review NAV-C C1);
//   - `moveLegacyCopies`: `travel:v1:copy-drafts` into the envelope, the old key deleted only after a good write (nav 3.2);
//   - the device mutations (add, replace, remove, restore) that the copy sheet and Mine call;
//   - the sign-in merge rule (nav 4.2): idempotent on the copy id, a copy with the same trip and start as an account draft skipped,
//     the account's 50-draft cap honoured with the newest copies first, and the mapping of a copy onto a `planner_draft` row whose
//     doc is `trip-custom/1` (./trip-custom.ts). The merge entry points take `unknown` and parse (review C2): the route receives JSON.
//
// VALIDATION. The raw zod objects (`copyItem`, `copiesEnvelope`) do not hold the cross-field rules (size, 60 overrides, unique ids,
// one copy per trip), which live in rule functions so the schema files stay exportable to JSON Schema (core/test/subset.test.ts).
// Never call `.parse` or `.safeParse` on them: use `parseCopy`, `parseEnvelope` or `readCopies`. core/test/schema/copies-boundary.test.ts
// fails on a bare call anywhere in core/src or web/.
//
// Times are UTC instants with `Z` (`toISOString`) and are compared as instants (`Date.parse`), never as strings (review M1).
//
// Private fields (household data): `adults`, `children`, `profile.youngest`, `added`, `copiedAt`, and the reserved `fromRef` and `gw`
// (trip-origin-and-nearest-airport.md 10; stored as `fromRef`, owner 26 Oct 2026). The privacy detector fails a public body holding
// `copiedAt`, `travellers`, `fromRef`, `gw` or `added`, or an origin reference under `from`. Snapshot fields are `title`, `days`, `cc`
// and `photo` only (P8: no facts, links, times or suitability).
//
// Forward compatibility: see the header of ./trip-custom.ts. Once NAV-2 stores envelopes, a new key is `copies/2`.
import { z } from "zod";
import {
  byteLength,
  type Checked,
  gateways,
  issuesOf,
  MAX_OVERRIDES,
  originRef,
  overrides,
  parseTripCustom,
  SLUG,
  sourceRevision,
  timelineProfile,
  travellers as travellersSchema,
  TRIP_CUSTOM_SCHEMA,
  type TripCustom,
} from "./trip-custom.ts";

export const COPIES_SCHEMA = "copies/1";
/** The envelope's localStorage key. */
export const COPIES_KEY = "travel.copies.local";
/** The pre-NAV key web/lib/export/draft.ts wrote: an array of CopyDraft, no version, no id, no cap. */
export const LEGACY_COPIES_KEY = "travel:v1:copy-drafts";
/** The key the storage probe writes and removes. */
export const PROBE_KEY = "travel.probe";

/** Q204 (owner, 25 Oct 2026): one copy per trip, 20 per device, 50 per account. */
export const DEVICE_COPY_CAP = 20;
export const ACCOUNT_DRAFT_CAP = 50;
/** nav 3.1: at most 4 KB per copy, 30 additions, 60 overrides. */
export const COPY_MAX_BYTES = 4096;
export const COPY_MAX_ADDED = 30;
/** The whole envelope: 20 full copies plus 4 KB for the rest (review L2). The route caps its request body by the same number. */
export const ENVELOPE_MAX_BYTES = DEVICE_COPY_CAP * COPY_MAX_BYTES + 4096;
/** `merged` keeps the most recent accounts only (review L2); it is a hint, never the rule (owner, 26 Oct 2026). */
export const MERGED_MAX = 10;
/** The title a copy moved from the old key carries until its row refreshes from the trip (nav 3.2). */
export const PLACEHOLDER_TITLE = "Trip";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** UTC with `Z` only, any fraction (review M1): an offset would make two spellings of one instant. */
const isoDateTime = z.iso.datetime();
/**
 * A site path for an image: one leading slash, then not a second slash or a backslash (a protocol-relative URL loads from another
 * host; browsers read `\` as `/`), and no space, quote, angle bracket or backslash anywhere (review L1).
 */
export const SITE_PATH = /^\/(?![/\\])[^\s"<>\\]{1,299}$/;

export const copyAdded = z.strictObject({ day: z.number().int().min(1).max(99), placeSlug: z.string().regex(SLUG) });

export const copyItem = z.strictObject({
  /** UUID v4 made on the device at copy time: the merge is idempotent on it */
  id: z.string().regex(UUID_V4, "a lower-case UUID v4"),
  slug: z.string().regex(SLUG),
  // snapshot of the trip's light row at copy time (P8); null until a moved copy's row refreshes
  title: z.string().min(1).max(120).regex(/\S/, "not blank"),
  days: z.number().int().min(1).max(366).nullable(),
  cc: z.string().regex(/^[A-Z]{2}$/).nullable(),
  photo: z.string().regex(SITE_PATH, "a site path").nullable(),
  // the visitor's choices (private)
  start: z.iso.date(),
  adults: travellersSchema.shape.adults,
  children: travellersSchema.shape.children,
  profile: timelineProfile.nullable(),
  overrides,
  added: z.array(copyAdded).max(COPY_MAX_ADDED),
  copiedAt: isoDateTime,
  /** reserved (origin spec 10): the visitor's origin for this copy; the stored name of the URL's `from` */
  fromRef: originRef.optional(),
  /** reserved (origin spec 10): the airports the visitor picked */
  gw: gateways.optional(),
  /** reserved: the public trip's content revision when copied; becomes `planner_draft.source_revision` at the merge */
  rev: sourceRevision.optional(),
});

export const copiesEnvelope = z.strictObject({
  schema: z.literal(COPIES_SCHEMA),
  items: z.array(copyItem).max(DEVICE_COPY_CAP),
  /** when the device notice was last seen */
  noteSeen: isoDateTime.nullable(),
  /** the notice's "Got it" snooze */
  snoozedUntil: isoDateTime.nullable(),
  /**
   * account hash -> when this device last merged into that account. A HINT only (owner, 26 Oct 2026): the merge runs whenever the
   * device holds copies (`needsMerge`); this suppresses a repeated toast. At most MERGED_MAX entries, the most recent kept.
   */
  merged: z.record(z.string().regex(/^[A-Za-z0-9_-]{8,128}$/), isoDateTime),
});

export type CopyItem = z.infer<typeof copyItem>;
export type CopiesEnvelope = z.infer<typeof copiesEnvelope>;
/** What the copy sheet supplies; the id and the time are made here. */
export type CopyInput = Omit<CopyItem, "id" | "copiedAt">;

export const emptyCopies = (): CopiesEnvelope => ({ schema: COPIES_SCHEMA, items: [], noteSeen: null, snoozedUntil: null, merged: {} });

/** An ISO instant in ms; the only way times are compared here. */
const instant = (s: string): number => Date.parse(s);
/** Newest first, then by id: a total order independent of locale and spelling. */
const newestFirst = (a: CopyItem, b: CopyItem): number => instant(b.copiedAt) - instant(a.copiedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The rules JSON Schema cannot hold (core/test/subset.test.ts): 4 KB a copy, 60 overrides. Paths and rules only, never a value. */
export function copyRules(c: CopyItem, at = "$"): string[] {
  const out: string[] = [];
  if (Object.keys(c.overrides).length > MAX_OVERRIDES) out.push(`${at}.overrides: at most ${MAX_OVERRIDES} overrides`);
  if (byteLength(JSON.stringify(c)) > COPY_MAX_BYTES) out.push(`${at}: a copy is at most ${COPY_MAX_BYTES} bytes`);
  return out;
}

/** One id per copy and one copy per trip (Q204), over a list. */
function listRules(items: readonly CopyItem[], at: string): string[] {
  const out = items.flatMap((c, i) => copyRules(c, `${at}.${i}`));
  const ids = items.map((i) => i.id);
  if (new Set(ids).size !== ids.length) out.push(`${at}: each copy has its own id`);
  const slugs = items.map((i) => i.slug);
  if (new Set(slugs).size !== slugs.length) out.push(`${at}: one copy per trip (Q204)`);
  return out;
}

/** The envelope's rules: each copy's, unique ids, one copy per trip, at most MERGED_MAX accounts, at most ENVELOPE_MAX_BYTES. */
export function envelopeRules(e: CopiesEnvelope): string[] {
  const out = listRules(e.items, "$.items");
  if (Object.keys(e.merged).length > MERGED_MAX) out.push(`$.merged: at most ${MERGED_MAX} accounts`);
  if (byteLength(JSON.stringify(e)) > ENVELOPE_MAX_BYTES) out.push(`$: an envelope is at most ${ENVELOPE_MAX_BYTES} bytes`);
  return out;
}

/** A copy: the schema, then the rules. */
export function parseCopy(x: unknown): Checked<CopyItem> {
  const r = copyItem.safeParse(x);
  if (!r.success) return { success: false, issues: issuesOf(r.error) };
  const rules = copyRules(r.data);
  return rules.length ? { success: false, issues: rules } : { success: true, data: r.data };
}

/** A list of copies as a client sends it to the merge route: at most 20, unique ids, one per trip. */
export function parseCopyList(x: unknown): Checked<CopyItem[]> {
  const r = z.array(copyItem).max(DEVICE_COPY_CAP).safeParse(x);
  if (!r.success) return { success: false, issues: issuesOf(r.error) };
  const rules = listRules(r.data, "$");
  return rules.length ? { success: false, issues: rules } : { success: true, data: r.data };
}

/** An envelope: the schema, then the rules. */
export function parseEnvelope(x: unknown): Checked<CopiesEnvelope> {
  const r = copiesEnvelope.safeParse(x);
  if (!r.success) return { success: false, issues: issuesOf(r.error) };
  const rules = envelopeRules(r.data);
  return rules.length ? { success: false, issues: rules } : { success: true, data: r.data };
}

// ---- reading ----

export type ReadResult =
  | { ok: true; envelope: CopiesEnvelope; /** nothing was stored: a fresh envelope */ fresh: boolean }
  | { ok: false; reason: "corrupt" | "newer" | "invalid"; issues: string[] };

/** The schema version a stored value names, if it names one: `copies/2` gives 2. */
function versionOf(x: unknown): number | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const s = (x as { schema?: unknown }).schema;
  const m = typeof s === "string" ? /^copies\/(\d+)$/.exec(s) : null;
  return m ? Number(m[1]) : null;
}

/** True when the stored text names a later version than this code reads. */
function isNewerText(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    const v = versionOf(JSON.parse(raw));
    return v !== null && v > 1;
  } catch {
    return false;
  }
}

/**
 * Reads the stored text. Absent: a fresh envelope. Not JSON: `corrupt`. A later version (`copies/2` written by a newer tab): `newer`.
 * Anything else that fails: `invalid`. A failed read never writes; the caller shows the error state and leaves the value untouched.
 * Issues name a path and a rule, never a value (the party is household data).
 */
export function readCopies(raw: string | null): ReadResult {
  if (raw === null) return { ok: true, envelope: emptyCopies(), fresh: true };
  let x: unknown;
  try {
    x = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt", issues: ["$: not JSON"] };
  }
  const v = versionOf(x);
  if (v !== null && v > 1) return { ok: false, reason: "newer", issues: [`$.schema: copies/${v}`] };
  const r = parseEnvelope(x);
  return r.success ? { ok: true, envelope: r.data, fresh: false } : { ok: false, reason: "invalid", issues: r.issues };
}

// ---- storage ----

/** The part of the Web Storage API this module uses; `window.localStorage` satisfies it. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A per-tab store: what a copy lives in when the browser keeps nothing (nav 3.3). */
export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  };
}

export type ProbeResult = { kind: "local"; storage: StorageLike } | { kind: "memory"; storage: StorageLike; reason: "blocked" | "quota" };

/** A DOMException for a full store, across engines (Chrome and Safari 22 / QuotaExceededError, Firefox 1014). */
export function isQuotaError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const { name, code } = e as { name?: unknown; code?: unknown };
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014;
}

/**
 * The one storage probe (nav 3.3), shared by copies and favourites: reaching `localStorage` may throw (blocked cookies, a sandboxed
 * frame), and a write may throw (quota, some private modes). `get` is a function so the throwing property access happens in here.
 * Writes and removes `travel.probe`; never calls `navigator.storage.persist()` (Firefox prompts).
 */
export function probeStorage(get: () => StorageLike | null | undefined): ProbeResult {
  let s: StorageLike | null | undefined;
  try {
    s = get();
  } catch {
    return { kind: "memory", storage: memoryStorage(), reason: "blocked" };
  }
  if (!s) return { kind: "memory", storage: memoryStorage(), reason: "blocked" };
  try {
    s.setItem(PROBE_KEY, "1");
    const back = s.getItem(PROBE_KEY);
    s.removeItem(PROBE_KEY);
    if (back !== "1") return { kind: "memory", storage: memoryStorage(), reason: "blocked" };
  } catch (e) {
    return { kind: "memory", storage: memoryStorage(), reason: isQuotaError(e) ? "quota" : "blocked" };
  }
  return { kind: "local", storage: s };
}

export type WriteResult = { ok: true; raw: string } | { ok: false; reason: "invalid" | "newer" | "changed" | "quota" | "blocked" | "unverified" };

/**
 * Compare-and-set (review C1). `base` is the raw text the caller read (null when nothing was stored). Re-reads the key first and
 * refuses with `newer` when it now names a later version (a newer tab upgraded it) and with `changed` when it differs from `base`
 * (another tab wrote meanwhile); the caller re-reads, re-applies its change once and writes again (`updateCopies`). Then validates,
 * writes and reads back: `unverified` when the read-back differs (a store that drops writes). Never writes an invalid envelope.
 * Browsers no longer hold a storage mutex across tabs, so this narrows the lost-update window to the gap between the re-read and the
 * write (one synchronous task), rather than closing it; that is enough for a visitor's own tabs.
 */
export function writeCopies(storage: StorageLike, env: CopiesEnvelope, base: string | null): WriteResult {
  if (!parseEnvelope(env).success) return { ok: false, reason: "invalid" };
  const text = JSON.stringify(env);
  try {
    const now = storage.getItem(COPIES_KEY);
    if (isNewerText(now)) return { ok: false, reason: "newer" };
    if (now !== base) return { ok: false, reason: "changed" };
    storage.setItem(COPIES_KEY, text);
    if (storage.getItem(COPIES_KEY) !== text) return { ok: false, reason: "unverified" };
  } catch (e) {
    return { ok: false, reason: isQuotaError(e) ? "quota" : "blocked" };
  }
  return { ok: true, raw: text };
}

export type UpdateResult<T> =
  | { ok: true; envelope: CopiesEnvelope; value: T }
  | { ok: false; reason: "corrupt" | "newer" | "invalid" | "changed" | "quota" | "blocked" | "unverified" | "refused"; value?: T };

/**
 * Read, change, compare-and-set; on `changed` (another tab wrote between this tab's read and write) it re-reads and re-applies the
 * change once against the fresh envelope, so neither tab's change is lost. `change` returns the next envelope and a value for the
 * caller (an AddResult, the removed item), or null to refuse (the replace prompt, the cap): nothing is written then.
 */
export function updateCopies<T>(storage: StorageLike, change: (env: CopiesEnvelope) => { envelope: CopiesEnvelope; value: T } | { envelope: null; value: T }, tries = 2): UpdateResult<T> {
  let last: UpdateResult<T> = { ok: false, reason: "changed" };
  for (let i = 0; i < tries; i++) {
    let raw: string | null;
    try {
      raw = storage.getItem(COPIES_KEY);
    } catch {
      return { ok: false, reason: "blocked" };
    }
    const cur = readCopies(raw);
    if (!cur.ok) return { ok: false, reason: cur.reason };
    const next = change(cur.envelope);
    if (next.envelope === null) return { ok: false, reason: "refused", value: next.value };
    const w = writeCopies(storage, next.envelope, raw);
    if (w.ok) return { ok: true, envelope: next.envelope, value: next.value };
    last = { ok: false, reason: w.reason, value: next.value };
    if (w.reason !== "changed") return last;
  }
  return last;
}

// ---- moving the old key (nav 3.2) ----

/** The snapshot of a trip's light row; until FAV-C's resolveRefs, the caller may know nothing but the slug. */
export type Snapshot = Pick<CopyItem, "title" | "days" | "cc" | "photo">;
export const placeholderSnapshot = (): Snapshot => ({ title: PLACEHOLDER_TITLE, days: null, cc: null, photo: null });

export interface MoveOptions {
  /** a fresh UUID v4 (crypto.randomUUID in the browser) */
  newId: () => string;
  /** the trip's light row, when known */
  snapshot?: (slug: string) => Snapshot | null;
}

export type MoveResult =
  | { status: "none" }
  | {
      status: "moved";
      moved: number;
      /** drafts the envelope already holds, or holds a newer copy of the same trip (a re-copy replaces, Q204) */
      superseded: number;
      /** drafts left under the old key: over the device cap, or not a draft this code wrote */
      kept: number;
    }
  | { status: "failed"; reason: "read-failed" | "legacy-unreadable" | "envelope-unreadable" | "newer" | "changed" | "write-failed" };

/** One old CopyDraft as an item, or null when it is not a draft this code wrote. NAV-2 widens this (handoff M3). */
function fromLegacy(d: unknown, opts: MoveOptions): CopyItem | null {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const o = d as Record<string, unknown>;
  const snap = (typeof o.slug === "string" && opts.snapshot?.(o.slug)) || placeholderSnapshot();
  const added = Array.isArray(o.added) ? o.added : [];
  const savedAt = typeof o.savedAt === "string" && !Number.isNaN(Date.parse(o.savedAt)) ? new Date(o.savedAt).toISOString() : null;
  const item = {
    id: opts.newId(),
    slug: o.slug,
    ...snap,
    start: o.start,
    adults: o.adults,
    children: o.children,
    profile: o.profile ?? null,
    overrides: o.overrides ?? {},
    added,
    copiedAt: savedAt,
  };
  const r = parseCopy(item);
  return r.success ? r.data : null;
}

/**
 * Moves `travel:v1:copy-drafts` into the envelope. Runs on the first read and is a no-op once the old key is gone. The old key is
 * deleted only after the envelope was written (compare-and-set against what this run read) and read back. A draft that cannot move
 * (over the device cap, or one that does not parse) stays under the old key, rewritten to hold only those, so nothing is lost; a
 * draft of a trip the envelope holds a newer or the same copy of is superseded, as a re-copy replaces (Q204).
 * A failed write leaves both keys exactly as they were; `newer` and `changed` are the compare-and-set refusals.
 */
export function moveLegacyCopies(storage: StorageLike, opts: MoveOptions): MoveResult {
  let raw: string | null;
  let currentRaw: string | null;
  try {
    raw = storage.getItem(LEGACY_COPIES_KEY);
    if (raw === null) return { status: "none" };
    currentRaw = storage.getItem(COPIES_KEY);
  } catch {
    return { status: "failed", reason: "read-failed" };
  }
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return { status: "failed", reason: "legacy-unreadable" };
  }
  if (!Array.isArray(list)) return { status: "failed", reason: "legacy-unreadable" };

  const cur = readCopies(currentRaw);
  if (!cur.ok) return { status: "failed", reason: cur.reason === "newer" ? "newer" : "envelope-unreadable" };

  const items = [...cur.envelope.items];
  const keep: unknown[] = [];
  // newest first, so the cap keeps the most recent copies; unparsable drafts last
  const drafts = list
    .map((d) => ({ d, item: fromLegacy(d, opts) }))
    .sort((a, b) => (a.item && b.item ? newestFirst(a.item, b.item) : a.item ? -1 : b.item ? 1 : 0));
  let moved = 0;
  let superseded = 0;
  for (const { d, item } of drafts) {
    if (!item) {
      keep.push(d);
      continue;
    }
    const same = items.findIndex((x) => x.slug === item.slug);
    if (same >= 0) {
      // one per trip, and a re-copy replaces (Q204): the newer copy wins. An equal instant is this draft, moved by an earlier run whose
      // delete failed; an older draft is the one a re-copy replaced
      if (instant(items[same]!.copiedAt) >= instant(item.copiedAt)) {
        superseded++;
        continue;
      }
      items.splice(same, 1, item);
      moved++;
      continue;
    }
    if (items.length >= DEVICE_COPY_CAP) {
      keep.push(d);
      continue;
    }
    items.push(item);
    moved++;
  }
  const next: CopiesEnvelope = { ...cur.envelope, items };
  if (moved > 0 || cur.fresh) {
    const w = writeCopies(storage, next, currentRaw);
    if (!w.ok) return { status: "failed", reason: w.reason === "newer" || w.reason === "changed" ? w.reason : "write-failed" };
  }
  try {
    if (keep.length) storage.setItem(LEGACY_COPIES_KEY, JSON.stringify(keep));
    else storage.removeItem(LEGACY_COPIES_KEY);
  } catch {
    // the envelope holds the moved copies; the old key still holds them too, and the next run finds each one already moved
  }
  return { status: "moved", moved, superseded, kept: keep.length };
}

// ---- device mutations ----

export type AddResult =
  | { ok: true; envelope: CopiesEnvelope; item: CopyItem; replaced: CopyItem | null }
  | { ok: false; reason: "exists"; existing: CopyItem }
  | { ok: false; reason: "cap" }
  | { ok: false; reason: "invalid"; issues: string[] };

/**
 * Adds a copy. A second copy of the same trip returns `exists` with the first (the copy sheet asks "Copy again to replace it");
 * with `replace` it takes the first one's place under a new id. The 21st copy returns `cap` (copy in nav 9).
 */
export function addCopy(env: CopiesEnvelope, input: CopyInput, opts: { now: Date; newId: () => string; replace?: boolean }): AddResult {
  const existing = env.items.find((x) => x.slug === input.slug) ?? null;
  if (existing && !opts.replace) return { ok: false, reason: "exists", existing };
  if (!existing && env.items.length >= DEVICE_COPY_CAP) return { ok: false, reason: "cap" };
  const r = parseCopy({ ...input, id: opts.newId(), copiedAt: opts.now.toISOString() });
  if (!r.success) return { ok: false, reason: "invalid", issues: r.issues };
  const items = existing ? env.items.map((x) => (x.id === existing.id ? r.data : x)) : [...env.items, r.data];
  return { ok: true, envelope: { ...env, items }, item: r.data, replaced: existing };
}

/** Removes a copy by id; returns the removed item for the toast's Undo. */
export function removeCopy(env: CopiesEnvelope, id: string): { envelope: CopiesEnvelope; removed: CopyItem | null } {
  const removed = env.items.find((x) => x.id === id) ?? null;
  return { envelope: removed ? { ...env, items: env.items.filter((x) => x.id !== id) } : env, removed };
}

/** Undo of remove: puts the item back unless its trip was copied again meanwhile or the cap is reached. */
export function restoreCopy(env: CopiesEnvelope, item: CopyItem): { ok: boolean; envelope: CopiesEnvelope } {
  if (env.items.some((x) => x.id === item.id || x.slug === item.slug) || env.items.length >= DEVICE_COPY_CAP) return { ok: false, envelope: env };
  return { ok: true, envelope: { ...env, items: [...env.items, item] } };
}

// ---- the sign-in merge (nav 4.2) ----

/**
 * Whether the merge should run for a signed-in visitor (owner, 26 Oct 2026, review NAV-C Q2): whenever this device holds copies,
 * whatever `merged` says. The server's plan decides what the account does not hold yet; `merged[h]` only suppresses a repeated toast.
 */
export const needsMerge = (env: CopiesEnvelope): boolean => env.items.length > 0;

/** What the merge needs of an account draft (read from the database, trusted). `start` is the doc's `start`, null with no date. */
export interface AccountDraftKey {
  id: string;
  source_trip: string | null;
  start: string | null;
}

/**
 * A `planner_draft` row made from a copy (nav 4.2 rule 2). `title` is the client's snapshot: the NAV-3 route replaces it from the
 * catalogue by `source_trip` and refuses a `source_trip` that is not a public, listed trip (handoff to NAV-3).
 */
export interface DraftRow {
  id: string;
  title: string;
  source_trip: string;
  source_revision: string | null;
  doc: TripCustom;
}

export interface MergePlan {
  /** rows to insert, newest copy first; `insert ... on conflict (id) do nothing returning id` makes a re-run safe */
  insert: DraftRow[];
  /** copies whose id the account already holds: a re-run after a crash between the write and emptying the envelope */
  already: string[];
  /** copies with the same trip and start as an account draft: the account wins (rule 3) */
  sameTrip: string[];
  /** copies over the account's cap, left on the device (rule 4: the newest go first) */
  overCap: string[];
}

/** The doc of a parsed copy. Private: every caller outside this file goes through a parsing entry point. */
function docOf(c: CopyItem): TripCustom {
  const doc: TripCustom = {
    schema: TRIP_CUSTOM_SCHEMA,
    profile: c.profile,
    overrides: { ...c.overrides },
    added: c.added.map((a, i) => ({ op: `o-${i + 1}`, day: a.day, ref: `place/${a.placeSlug}` })),
    start: c.start,
    travellers: { adults: c.adults, children: [...c.children] },
    ...(c.fromRef !== undefined ? { fromRef: c.fromRef } : {}),
    ...(c.gw !== undefined ? { gw: { ...c.gw } } : {}),
    ...(c.rev !== undefined ? { rev: c.rev } : {}),
  };
  const r = parseTripCustom(doc);
  // a valid copy always maps to a valid doc (4 KB and 30 additions sit inside 64 KB); a failure here is a bug, so it throws
  if (!r.success) throw new Error(`a copy maps to an invalid trip-custom/1: ${r.issues.join("; ")}`);
  return r.data;
}

const rowOf = (c: CopyItem): DraftRow => ({ id: c.id, title: c.title, source_trip: c.slug, source_revision: c.rev ?? null, doc: docOf(c) });

/** The `trip-custom/1` doc of a copy: the timeline choices, plus `start`, `travellers` and, when set, `fromRef`, `gw` and `rev`. Parses. */
export function copyToTripCustom(x: unknown): Checked<TripCustom> {
  const c = parseCopy(x);
  return c.success ? { success: true, data: docOf(c.data) } : c;
}

/** The `planner_draft` row of a copy. Parses (review C2): the id is a client-chosen primary key. */
export function copyToDraftRow(x: unknown): Checked<DraftRow> {
  const c = parseCopy(x);
  return c.success ? { success: true, data: rowOf(c.data) } : c;
}

/**
 * The merge rule, pure, so the route (NAV-3) and its tests share it. Takes the copies as received (JSON from the browser) and parses
 * them as a list (review C2); a list that fails is refused whole, with paths. Idempotent: the plan for copies already merged inserts
 * nothing. Never more than `cap` drafts in the account; never two drafts with the same trip and start from one merge.
 */
export function planMerge(input: unknown, account: readonly AccountDraftKey[], cap: number = ACCOUNT_DRAFT_CAP): Checked<MergePlan> {
  const parsed = parseCopyList(input);
  if (!parsed.success) return parsed;
  const ids = new Set(account.map((a) => a.id));
  const tripStart = (trip: string | null, start: string | null): string => `${trip ?? ""}\u0000${start ?? ""}`;
  const taken = new Set(account.filter((a) => a.source_trip !== null && a.start !== null).map((a) => tripStart(a.source_trip, a.start)));
  const plan: MergePlan = { insert: [], already: [], sameTrip: [], overCap: [] };
  let room = Math.max(0, cap - account.length);
  for (const c of [...parsed.data].sort(newestFirst)) {
    if (ids.has(c.id)) {
      plan.already.push(c.id);
      continue;
    }
    const k = tripStart(c.slug, c.start);
    if (taken.has(k)) {
      plan.sameTrip.push(c.id);
      continue;
    }
    if (room <= 0) {
      plan.overCap.push(c.id);
      continue;
    }
    room--;
    taken.add(k);
    plan.insert.push(rowOf(c));
  }
  return { success: true, data: plan };
}

/** What the server confirmed (review M2): `inserted` is the route's `returning id`, never the plan's insert list. */
export interface MergeTaken {
  inserted: readonly string[];
  already: readonly string[];
  sameTrip: readonly string[];
}

/**
 * After the server answered: the copies it confirmed (inserted per `returning id`, already held, or skipped for the same trip and
 * start) leave the device; everything else stays (over the cap, a row the cap trigger refused, an id another account holds), so a
 * copy never leaves the device without being in the account the toast names. `merged[h]` records the account, keeping the
 * MERGED_MAX most recent. Rule 8: a shared computer then shows nothing of the previous person except what did not fit.
 */
export function markMerged(env: CopiesEnvelope, taken: MergeTaken, accountHash: string, at: Date): CopiesEnvelope {
  const gone = new Set([...taken.inserted, ...taken.already, ...taken.sameTrip]);
  const merged = Object.entries({ ...env.merged, [accountHash]: at.toISOString() })
    .sort((a, b) => instant(b[1]) - instant(a[1]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, MERGED_MAX);
  return { ...env, items: env.items.filter((x) => !gone.has(x.id)), merged: Object.fromEntries(merged) };
}
