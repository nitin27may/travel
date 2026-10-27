// copies/1: the trip copies a visitor keeps in this browser without an account (navigation-and-mine.md 3). One envelope under
// `travel.copies.local`, validated on every read; a bad or newer envelope is left untouched and the list shows its error state.
//
// What lives here, all pure (no window, no DOM: web/lib/mine/** passes the browser's storage in, so this runs in a test or a server):
//   - the envelope and item schemas, with the Q204 limits (one copy per trip, 20 per device) and the size rules (nav 3.1);
//   - `probeStorage`: can this browser keep data, and if not, why (nav 3.3); `memoryStorage` is the per-tab fallback;
//   - `writeCopies` and `updateCopies`: compare-and-set writes, so a stale tab never overwrites a newer envelope or another tab's
//     change (review NAV-C C1);
//   - `moveLegacyCopies`: `travel:v1:copy-drafts` into the envelope, once per device (`LEGACY_MOVED_KEY`), each draft mapped leniently,
//     the old key rewritten only after a good write (nav 3.2; NAV-2C);
//   - the device mutations (add, replace, remove, restore) that the copy sheet and Mine call;
//   - the sign-in merge rule (nav 4.2, superseded in part by edit-my-trip.md 4.2 M1 to M4): idempotent on the copy id; a copy with
//     the same trip and start as an account draft is skipped when its content is identical and kept beside it, titled "(from this
//     device)", when it differs (M3); the account's 50-draft cap honoured with the newest copies first. The merge entry points take
//     `unknown` and parse (review C2): the route receives JSON.
//   - the content key (`templateContentKey`) the M3 comparison reads, shared with the plan document's side.
//
// THE ACCOUNT ROW'S DOCUMENT (edit-my-trip EM1, EM-C). A copy merges into the account as a `plan-draft/1` in template mode, mapped by
// `copyToPlanDraft` and `copyToPlanRow` in core/src/plan/doc.ts. They live there, not here, because the builder's fence
// (web/tests/plan/isolation.test.ts G1) forbids a file outside the builder's paths from importing the plan document; that module
// passes its mapper to `planMerge` (`opts.toRow`). The old mapping onto the retired `trip-custom/1` (`copyToTripCustom`,
// `copyToDraftRow`, and `planMerge`'s default row) is kept only so stored tests read; no route may use it.
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
import { PLAN_DOC_LIMITS } from "../config/plans.ts";
import {
  byteLength,
  type Checked,
  gateways,
  issuesOf,
  MAX_ADULTS,
  MAX_CHILDREN,
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

/** Q204 (owner, 25 Oct 2026): one copy per trip, 20 per device, 50 per account (core/src/config/plans.ts holds the numbers). */
export const DEVICE_COPY_CAP: number = PLAN_DOC_LIMITS.devicePlans;
export const ACCOUNT_DRAFT_CAP: number = PLAN_DOC_LIMITS.accountPlans;
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

// ---- moving the old key (nav 3.2; NAV-2C, handoff M3, L3, L5) ----

/**
 * Set (an ISO instant) once this device's old-key move has completed: the envelope written and read back. While it is set the move
 * is a no-op, so drafts kept under the old key (over the cap, or unusable) never refill a slot the visitor frees later (Remove, then
 * the toast's Undo would fail on the cap; a removed copy would come back). Its own key, not an envelope field (D9): the envelope
 * schema is unchanged.
 */
export const LEGACY_MOVED_KEY = "travel.copies.legacyMovedAt";

/** The snapshot of a trip's light row; until FAV-C's resolveRefs, the caller may know nothing but the slug. */
export type Snapshot = Pick<CopyItem, "title" | "days" | "cc" | "photo">;
export const placeholderSnapshot = (): Snapshot => ({ title: PLACEHOLDER_TITLE, days: null, cc: null, photo: null });

export interface MoveOptions {
  /** a fresh UUID v4 (crypto.randomUUID in the browser) */
  newId: () => string;
  /** the trip's light row, when known; an invalid or throwing answer falls back to the placeholder */
  snapshot?: (slug: string) => Snapshot | null;
  /** the move time: `copiedAt` of a draft with no usable `savedAt`, and the marker's value. Defaults to now. */
  now?: Date;
}

export type MoveResult =
  | { status: "none" }
  | {
      status: "moved";
      moved: number;
      /** drafts the envelope already holds, or holds a newer copy of the same trip (a re-copy replaces, Q204) */
      superseded: number;
      /** good drafts over the device cap, left under the old key and never moved later ("N older copies did not fit") */
      kept: number;
      /** entries that cannot become a copy (not an object, or no valid `slug` or `start`); left under the old key, never shown */
      dropped: number;
    }
  | { status: "failed"; reason: "read-failed" | "legacy-unreadable" | "envelope-unreadable" | "newer" | "changed" | "write-failed" };

/** A legacy draft mapped: the item, and whether its time came from the draft (`savedAt`) or is the move time. */
interface Mapped {
  item: CopyItem;
  dated: boolean;
}

const OVERRIDE_DAY = /^[1-9]\d?$/;
const VARIANT = new Set(["A", "B", "C"]);

/** A finite number, or a string of digits, as an integer; anything else null. */
function intOf(x: unknown): number | null {
  const n = typeof x === "number" ? x : typeof x === "string" && /^\s*-?\d+(?:\.\d+)?\s*$/.test(x) ? Number(x) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** A `YYYY-MM-DD` that is a real calendar date (the schema's own check), else null. */
function dateOf(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const r = copyItem.shape.start.safeParse(x.trim());
  return r.success ? r.data : null;
}

/** `savedAt` as a UTC `Z` instant the schema accepts, else null (missing, unparsable, or outside years 0000 to 9999). */
function savedAtOf(x: unknown): string | null {
  if (typeof x !== "string" && typeof x !== "number") return null;
  const ms = typeof x === "number" ? x : Date.parse(x);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  const iso = d.toISOString();
  return copyItem.shape.copiedAt.safeParse(iso).success ? iso : null;
}

/** Valid day overrides only, lowest days first, at most MAX_OVERRIDES; an invalid key or variant is dropped. */
function overridesOf(x: unknown): Record<string, "A" | "B" | "C"> {
  if (!x || typeof x !== "object" || Array.isArray(x)) return {};
  const ok = Object.entries(x as Record<string, unknown>)
    .map(([k, v]) => [k.trim(), typeof v === "string" ? v.trim().toUpperCase() : v] as const)
    .filter((e): e is readonly [string, "A" | "B" | "C"] => OVERRIDE_DAY.test(e[0]) && typeof e[1] === "string" && VARIANT.has(e[1]))
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .slice(0, MAX_OVERRIDES);
  return Object.fromEntries(ok);
}

/** Valid additions only, in order, at most COPY_MAX_ADDED; an invalid one is dropped. */
function addedOf(x: unknown): CopyItem["added"] {
  if (!Array.isArray(x)) return [];
  const out: CopyItem["added"] = [];
  for (const a of x) {
    if (out.length >= COPY_MAX_ADDED) break;
    const r = copyAdded.safeParse(a);
    if (r.success) out.push(r.data);
  }
  return out;
}

/** The party clamped to the schema: adults 1 to 12, each child's age 0 to 17, at most 12 children; non-numbers dropped. */
function partyOf(adults: unknown, children: unknown, profileAdults: number | null): { adults: number; children: number[] } {
  const a = intOf(adults);
  const kids = Array.isArray(children) ? children.map(intOf).filter((n): n is number => n !== null).map((n) => clamp(n, 0, 17)) : [];
  // no usable count: the profile's (1, or 2 for two or more), else two, the copy sheet's usual party
  return { adults: a === null ? (profileAdults ?? 2) : clamp(a, 1, MAX_ADULTS), children: kids.slice(0, MAX_CHILDREN) };
}

/** The timeline profile, or null (the trip's default) when it does not parse: the profile codec re-checks it when the copy opens. */
function profileOf(x: unknown): CopyItem["profile"] {
  if (x === null || x === undefined) return null;
  const r = timelineProfile.safeParse(x);
  return r.success ? r.data : null;
}

function snapshotOf(slug: string, opts: MoveOptions): Snapshot {
  try {
    const s = opts.snapshot?.(slug);
    if (!s) return placeholderSnapshot();
    const shape = copyItem.shape;
    const ok = shape.title.safeParse(s.title).success && shape.days.safeParse(s.days).success && shape.cc.safeParse(s.cc).success && shape.photo.safeParse(s.photo).success;
    return ok ? { title: s.title, days: s.days, cc: s.cc, photo: s.photo } : placeholderSnapshot();
  } catch {
    return placeholderSnapshot();
  }
}

/**
 * One old CopyDraft as a copy, mapped leniently (NAV-2C, handoff M3): an invalid override, addition or profile is dropped, the party
 * is clamped to the schema, `copiedAt` is `savedAt` or else the move time, the snapshot is the trip's light row or the placeholder,
 * and a copy over 4 KB sheds additions, then overrides, until it fits. Null only for an entry with no valid `slug` or `start` (or not
 * an object): those are counted as `dropped`. Legacy drafts never carried `fromRef`, `gw` or `rev`; any such key is ignored.
 */
function fromLegacy(d: unknown, opts: MoveOptions, now: Date): Mapped | null {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const o = d as Record<string, unknown>;
  const slug = typeof o.slug === "string" && SLUG.test(o.slug.trim()) ? o.slug.trim() : null;
  const start = dateOf(o.start);
  if (slug === null || start === null) return null;
  const profile = profileOf(o.profile);
  const savedAt = savedAtOf(o.savedAt);
  const item: CopyItem = {
    id: opts.newId(),
    slug,
    ...snapshotOf(slug, opts),
    start,
    ...partyOf(o.adults, o.children, profile?.adults ?? null),
    profile,
    overrides: overridesOf(o.overrides),
    added: addedOf(o.added),
    copiedAt: savedAt ?? now.toISOString(),
  };
  // shed what makes it too big, newest addition first, then the highest day's override; then the snapshot
  for (;;) {
    const r = parseCopy(item);
    if (r.success) return { item: r.data, dated: savedAt !== null };
    if (item.added.length) item.added = item.added.slice(0, -1);
    else if (Object.keys(item.overrides).length) item.overrides = Object.fromEntries(Object.entries(item.overrides).slice(0, -1));
    else if (item.title !== PLACEHOLDER_TITLE) Object.assign(item, placeholderSnapshot());
    else return null; // unreachable for a valid slug and start (a bad newId); counted as dropped all the same
  }
}

/** Dated drafts newest first (the cap keeps the most recent), then undated ones (older than anything dated), each by id. */
function moveOrder(a: Mapped, b: Mapped): number {
  if (a.dated !== b.dated) return a.dated ? -1 : 1;
  return newestFirst(a.item, b.item);
}

/**
 * Moves `travel:v1:copy-drafts` into the envelope ONCE per device (NAV-2C). A no-op when LEGACY_MOVED_KEY is set or the old key is
 * absent. Each draft maps leniently (`fromLegacy`); a draft of a trip the envelope holds a newer or the same copy of is superseded,
 * as a re-copy replaces (Q204), and an undated draft never replaces a copy. Good drafts over the device cap are `kept` and unusable
 * entries `dropped`: both stay under the old key, rewritten to hold only them, so nothing is deleted that did not move.
 *
 * Order, for crash safety (review M6): (1) the envelope, compare-and-set against what this run read, written and read back; a
 * failure here leaves both keys exactly as they were (`newer` and `changed` are the compare-and-set refusals, the rest
 * `write-failed`). (2) The old key rewritten or deleted, best effort: if it throws, it still holds moved drafts, which the marker
 * hides from every later run. (3) The marker. If it cannot be written, the next run moves again: dated drafts are superseded (equal
 * instants), undated ones never replace, and the old key no longer holds what moved, so nothing duplicates or comes back; only the `kept`
 * drafts may then fill a freed slot, as before NAV-2C, and only while the store refuses the marker's few bytes.
 */
export function moveLegacyCopies(storage: StorageLike, opts: MoveOptions): MoveResult {
  const now = opts.now ?? new Date();
  let raw: string | null;
  let currentRaw: string | null;
  try {
    if (storage.getItem(LEGACY_MOVED_KEY) !== null) return { status: "none" };
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
  const kept: unknown[] = [];
  const dropped: unknown[] = [];
  const mapped: { d: unknown; m: Mapped }[] = [];
  for (const d of list) {
    const m = fromLegacy(d, opts, now);
    if (m) mapped.push({ d, m });
    else dropped.push(d);
  }
  mapped.sort((a, b) => moveOrder(a.m, b.m));
  let moved = 0;
  let superseded = 0;
  for (const { d, m } of mapped) {
    const { item } = m;
    const same = items.findIndex((x) => x.slug === item.slug);
    if (same >= 0) {
      // one per trip, and a re-copy replaces (Q204): the newer copy wins. An equal instant is this draft, moved by an earlier run whose
      // marker write failed; an older draft is the one a re-copy replaced; an undated draft is older than any copy
      if (!m.dated || instant(items[same]!.copiedAt) >= instant(item.copiedAt)) {
        superseded++;
        continue;
      }
      items.splice(same, 1, item);
      moved++;
      continue;
    }
    if (items.length >= DEVICE_COPY_CAP) {
      kept.push(d);
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
  const left = [...kept, ...dropped];
  try {
    if (left.length) storage.setItem(LEGACY_COPIES_KEY, JSON.stringify(left));
    else storage.removeItem(LEGACY_COPIES_KEY);
  } catch {
    // the envelope holds the moved copies; the old key still holds them too, and the marker keeps every later run from reading it
  }
  try {
    storage.setItem(LEGACY_MOVED_KEY, now.toISOString());
  } catch {
    // the next run moves again; see the order above
  }
  return { status: "moved", moved, superseded, kept: kept.length, dropped: dropped.length };
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

// ---- the sign-in merge (nav 4.2; edit-my-trip 4.2 M1 to M4) ----

/**
 * Whether the merge should run for a signed-in visitor (owner, 26 Oct 2026, review NAV-C Q2): whenever this device holds copies,
 * whatever `merged` says. The server's plan decides what the account does not hold yet; `merged[h]` only suppresses a repeated toast.
 */
export const needsMerge = (env: CopiesEnvelope): boolean => env.items.length > 0;

/**
 * What the merge needs of an account draft (read from the database, trusted). `start` is the doc's `start`, null with no date.
 * `content` is `templateContentKey` of the row's document (core/src/plan/doc.ts `draftContentKey`), read only for rows with the same
 * trip and start as a device copy: null for a row with no document. ABSENT means the caller did not read it, and the old rule 3
 * applies (the account wins); the account route must always pass it (`planCopyMerge` in core/src/plan/doc.ts requires it).
 */
export interface AccountDraftKey {
  id: string;
  source_trip: string | null;
  start: string | null;
  content?: string | null;
}

/**
 * A `planner_draft` row made from a copy under the RETIRED `trip-custom/1` (nav 4.2 rule 2). Kept only as `planMerge`'s default row
 * so stored tests read; the account route maps with `copyToPlanRow` (core/src/plan/doc.ts) instead.
 * @deprecated edit-my-trip EM1: the account row's document is `plan-draft/1`.
 */
export interface DraftRow {
  id: string;
  title: string;
  source_trip: string;
  source_revision: string | null;
  doc: TripCustom;
}

/** Makes the row a copy becomes; null when it cannot (not a public trip, an unknown country): that copy stays on the device. */
export type CopyRowMapper<R> = (c: CopyItem, title: string) => R | null;

export interface MergePlan<R = DraftRow> {
  /** rows to insert, newest copy first; `insert ... on conflict (id) do nothing returning id` makes a re-run safe */
  insert: R[];
  /** copies whose id the account already holds: a re-run after a crash between the write and emptying the envelope */
  already: string[];
  /**
   * copies with the same trip and start as an account draft whose content is identical (M3), or whose content the caller did not
   * read (the old rule 3): skipped, and they leave the device
   */
  sameTrip: string[];
  /**
   * M3: copies with the same trip and start as an account draft but different content. Inserted beside it (their rows are in
   * `insert`, titled "<title> (from this device)"), so no edit is lost
   */
  both: string[];
  /** copies over the account's cap, left on the device (rule 4: the newest go first) */
  overCap: string[];
  /** copies the mapper could not turn into a row: left on the device */
  refused: string[];
}

export interface MergeOptions<R> {
  /** the row a copy becomes (default: the retired `trip-custom/1` row, for stored tests only) */
  toRow?: CopyRowMapper<R>;
  /** a copy's content key (default `copyContentKey`); the account route passes one that maps a dated slug to its public alias */
  contentKey?: (c: CopyItem) => string;
  /** the account's name for a copy's trip (`source_trip`): its public slug (default: the copy's slug as it is) */
  tripOf?: (slug: string) => string;
}

/** What a device copy is titled when it is kept beside an account draft of the same trip and start (M3). */
export const FROM_DEVICE_SUFFIX = " (from this device)";
/** The longest title a copy or a draft holds. */
export const TITLE_MAX = 120;

/** `<title> (from this device)`, the title shortened first so the whole stays within TITLE_MAX. */
export function fromDeviceTitle(title: string, max: number = TITLE_MAX): string {
  const room = Math.max(1, max - FROM_DEVICE_SUFFIX.length);
  const head = title.length > room ? title.slice(0, room).trimEnd() : title;
  return `${head || title.slice(0, room)}${FROM_DEVICE_SUFFIX}`;
}

/**
 * The person's changes to one public trip, in one canonical form for both the device copy and the account document, so M3 can tell
 * "identical" from "different" without either side importing the other. Titles, operation ids, the content revision and the times
 * are not content. Inserted days are named by their position among the day operations (`@0`, `@1`), not by their operation id.
 */
export interface TemplateContent {
  trip: string;
  start: string | null;
  travellers: { adults: number; children: readonly number[] } | null;
  profile: { party: string; youngest: number | null; pace: string; adults: number; walk: number | null; split: boolean } | null;
  window: string | null;
  overrides: Readonly<Record<string, string>>;
  added: readonly { op?: string; day: number | string; ref: string; after?: string }[];
  removed: readonly { day: number; item: string }[];
  moved: readonly { day: number; item: string; toDay: number | string; after?: string }[];
  days: readonly ({ op?: string; kind: "insert"; after: number } | { op?: string; kind: "drop"; day: number })[];
  notes: Readonly<Record<string, string>>;
  maybe: readonly { ref: string }[];
  fromRef: string | null;
  gw: { in: string; out: string } | null;
}

/** Note keys in a fixed order: days by number, then `trip`, then inserted days by position. */
const noteOrder = (k: string): string => (/^\d+$/.test(k) ? `0${k.padStart(3, "0")}` : k === "trip" ? "1" : `2${k.slice(1).padStart(3, "0")}`);
const byNoteKey = (a: readonly [string, string], b: readonly [string, string]): number => {
  const x = noteOrder(a[0]);
  const y = noteOrder(b[0]);
  return x < y ? -1 : x > y ? 1 : 0;
};

/** The canonical JSON of a template's content (M3): equal strings mean the same changes to the same trip on the same start. */
export function templateContentKey(c: TemplateContent): string {
  const inserted = c.days.flatMap((d) => (d.kind === "insert" && d.op !== undefined ? [d.op] : []));
  const dayRef = (d: number | string): number | string => (typeof d === "number" ? d : `@${inserted.indexOf(d)}`);
  const noteKey = (k: string): string => (k.startsWith("o-") ? `@${inserted.indexOf(k)}` : k);
  const canonical = {
    trip: c.trip,
    start: c.start,
    travellers: c.travellers ? { adults: c.travellers.adults, children: [...c.travellers.children].sort((a, b) => a - b) } : null,
    profile: c.profile
      ? { party: c.profile.party, youngest: c.profile.youngest, pace: c.profile.pace, adults: c.profile.adults, walk: c.profile.walk, split: c.profile.split }
      : null,
    window: c.window,
    overrides: Object.entries(c.overrides).sort((a, b) => Number(a[0]) - Number(b[0])),
    added: c.added.map((a) => [dayRef(a.day), a.ref, a.after ?? null]),
    removed: c.removed.map((r) => [r.day, r.item]),
    moved: c.moved.map((m) => [m.day, m.item, dayRef(m.toDay), m.after ?? null]),
    days: c.days.map((d) => (d.kind === "insert" ? ["insert", d.after] : ["drop", d.day])),
    notes: Object.entries(c.notes)
      .map(([k, v]) => [noteKey(k), v] as const)
      .sort(byNoteKey),
    maybe: c.maybe.map((m) => m.ref),
    fromRef: c.fromRef,
    gw: c.gw ? { in: c.gw.in, out: c.gw.out } : null,
  };
  return JSON.stringify(canonical);
}

/** A copy's content (M3), with its trip slug as `trip` (or as `publicSlug` maps it). */
export function copyContent(c: CopyItem, publicSlug: (slug: string) => string = (s) => s): TemplateContent {
  return {
    trip: publicSlug(c.slug),
    start: c.start,
    travellers: { adults: c.adults, children: c.children },
    profile: c.profile,
    window: null,
    overrides: c.overrides,
    added: c.added.map((a) => ({ day: a.day, ref: `place/${a.placeSlug}` })),
    removed: [],
    moved: [],
    days: [],
    notes: {},
    maybe: [],
    fromRef: c.fromRef ?? null,
    gw: c.gw ?? null,
  };
}

/** `templateContentKey` of a copy. */
export const copyContentKey = (c: CopyItem, publicSlug?: (slug: string) => string): string => templateContentKey(copyContent(c, publicSlug));

/**
 * M3 as one decision: a device copy against the account drafts with the same trip and start. `same` when one holds the identical
 * content (skip it), `both` when none does (keep both), `legacy` when the caller read no content for one of them (the old rule 3:
 * skip it). Pure; `planMerge` applies it.
 */
export function sameTripChoice(copyKey: string, accountContents: readonly (string | null | undefined)[]): "same" | "both" | "legacy" {
  if (accountContents.some((x) => x === undefined)) return "legacy";
  return accountContents.includes(copyKey) ? "same" : "both";
}

/** The doc of a parsed copy under the retired `trip-custom/1`. Private: every caller outside this file goes through a parsing entry point. */
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

const rowOf = (c: CopyItem, title: string = c.title): DraftRow => ({ id: c.id, title, source_trip: c.slug, source_revision: c.rev ?? null, doc: docOf(c) });

/**
 * The `trip-custom/1` doc of a copy. Parses.
 * @deprecated edit-my-trip EM1: use `copyToPlanDraft` (core/src/plan/doc.ts).
 */
export function copyToTripCustom(x: unknown): Checked<TripCustom> {
  const c = parseCopy(x);
  return c.success ? { success: true, data: docOf(c.data) } : c;
}

/**
 * The retired `trip-custom/1` row of a copy. Parses (review C2): the id is a client-chosen primary key.
 * @deprecated edit-my-trip EM1: use `copyToPlanRow` (core/src/plan/doc.ts).
 */
export function copyToDraftRow(x: unknown): Checked<DraftRow> {
  const c = parseCopy(x);
  return c.success ? { success: true, data: rowOf(c.data) } : c;
}

/**
 * The merge rule, pure, so the route and its tests share it. Takes the copies as received (JSON from the browser) and parses them as
 * a list (review C2); a list that fails is refused whole, with paths. Idempotent: the plan for copies already merged inserts nothing
 * (M1). Never more than `cap` drafts in the account (M4). A copy with the same trip and start as an account draft is skipped when the
 * content is identical and kept beside it, retitled, when it differs (M3, `sameTripChoice`); never two rows with the same trip and
 * start from one merge otherwise. `opts.toRow` makes the rows (the account route passes `copyToPlanRow` through `planCopyMerge`).
 */
export function planMerge<R = DraftRow>(input: unknown, account: readonly AccountDraftKey[], cap: number = ACCOUNT_DRAFT_CAP, opts: MergeOptions<R> = {}): Checked<MergePlan<R>> {
  const parsed = parseCopyList(input);
  if (!parsed.success) return parsed;
  const toRow = (opts.toRow ?? ((c: CopyItem, title: string) => rowOf(c, title))) as CopyRowMapper<R>;
  const contentKey = opts.contentKey ?? ((c: CopyItem) => copyContentKey(c));
  const ids = new Set(account.map((a) => a.id));
  const tripStart = (trip: string | null, start: string | null): string => `${trip ?? ""}\u0000${start ?? ""}`;
  const contents = new Map<string, (string | null | undefined)[]>();
  for (const a of account) {
    if (a.source_trip === null || a.start === null) continue;
    const k = tripStart(a.source_trip, a.start);
    contents.set(k, [...(contents.get(k) ?? []), a.content]);
  }
  const plan: MergePlan<R> = { insert: [], already: [], sameTrip: [], both: [], overCap: [], refused: [] };
  let room = Math.max(0, cap - account.length);
  for (const c of [...parsed.data].sort(newestFirst)) {
    if (ids.has(c.id)) {
      plan.already.push(c.id);
      continue;
    }
    const k = tripStart(opts.tripOf ? opts.tripOf(c.slug) : c.slug, c.start);
    const there = contents.get(k);
    const choice = there ? sameTripChoice(contentKey(c), there) : null;
    if (choice === "same" || choice === "legacy") {
      plan.sameTrip.push(c.id);
      continue;
    }
    if (room <= 0) {
      plan.overCap.push(c.id);
      continue;
    }
    const row = toRow(c, choice === "both" ? fromDeviceTitle(c.title) : c.title);
    if (row === null) {
      plan.refused.push(c.id);
      continue;
    }
    room--;
    contents.set(k, [...(there ?? []), contentKey(c)]);
    plan.insert.push(row);
    if (choice === "both") plan.both.push(c.id);
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
 * After the server answered: the copies it confirmed (inserted per `returning id`, which includes the M3 rows kept beside an account
 * draft, already held, or skipped for the same trip, start and content) leave the device; everything else stays (over the cap,
 * refused, a row the cap trigger refused, an id another account holds), so a copy never leaves the device without being in the
 * account the toast names. `merged[h]` records the account, keeping the MERGED_MAX most recent. Rule 8: a shared computer then shows
 * nothing of the previous person except what did not fit.
 */
export function markMerged(env: CopiesEnvelope, taken: MergeTaken, accountHash: string, at: Date): CopiesEnvelope {
  const gone = new Set([...taken.inserted, ...taken.already, ...taken.sameTrip]);
  const merged = Object.entries({ ...env.merged, [accountHash]: at.toISOString() })
    .sort((a, b) => instant(b[1]) - instant(a[1]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, MERGED_MAX);
  return { ...env, items: env.items.filter((x) => !gone.has(x.id)), merged: Object.fromEntries(merged) };
}
