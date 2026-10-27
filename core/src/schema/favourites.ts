// favourites/1: the places and trips a visitor hearts (visitor-suggestions-and-favourites.md 4; navigation-and-mine.md 2, 4: the list is
// the Favourites tab of /mine/). The shapes only, all pure; the rules that act on them live in core/src/favourites/**.
//
// It shares NAV-C's conventions (./copies.ts) so the two device envelopes behave the same:
//   - one envelope per localStorage key, `schema: "<name>/<n>"`, validated on every read; a corrupt, invalid or newer envelope is
//     reported and never overwritten (the list shows its error state);
//   - the one storage probe and the per-tab fallback (`probeStorage`, `memoryStorage` in copies.ts), and a write that reads back;
//   - `noteSeen`, `snoozedUntil` and `merged` (account hash -> when this device last merged into it) with the same meaning;
//   - the sign-in merge is a pure planner: union, the account wins, a cap with the newest first, idempotent, and the device keeps only
//     what did not fit.
//
// Identity: a favourite is a slug in a space (`place` or `trip`), written as the handle `place:<slug>` or `trip:<slug>`. The heart on a
// page knows only its slug (visitor spec 7: no new props cross the server boundary), so the slug is the device key; the stable public
// `ref` is filled in by `resolveRefs` and is what the account table keys on (FAV-D: primary key (user_id, ref)).
//
// VALIDATION. The raw zod objects here do not hold the cross-field rules (one row per page and per ref, a trip has no kind, the
// envelope's byte size, at most MERGED_MAX accounts), which live in rule functions so the schemas stay exportable to JSON Schema. Never
// call `.parse` or `.safeParse` on them outside the parsing entry points (core/src/favourites/envelope.ts `parseFavourites`,
// `readFavourites`, `parseMergeItems`, `parseResolveRows`, `parseAccountRows`, `parseMergeAnswer`, and resolve.ts for the query):
// core/test/favourites/boundary.test.ts fails on a bare call anywhere else in core/src or web/ (review NAV-C C2, mirrored).
//
// Times are UTC instants with `Z` (`toISOString`), any fraction, and are compared as instants (`Date.parse`), never as strings (M1).
//
// Snapshot fields are `name`, `kind` and `cc` only (P8: no facts, links, times or suitability). `favouredAt` is private: the detector
// fails a public body holding `favouredAt` or `favourites` (visitor spec 8.3).
import { z } from "zod";
import { NO_DATED_FOLDER_RE, REF_MAX, REF_RE } from "./api/common.ts";
import { SLUG } from "./trip-custom.ts";

export const FAVOURITES_SCHEMA = "favourites/1";
/** The signed-out list (visitor spec 4.2). */
export const FAV_LOCAL_KEY = "travel.fav.local";
/** The account cache: `travel.fav.acct.<h>`, `h` the account hash (core/src/favourites/account.ts). */
export const FAV_ACCOUNT_KEY_PREFIX = "travel.fav.acct.";

/** Q108: 500 per device and 500 per account. */
export const FAVOURITES_CAP = 500;
/** `resolveRefs`: handles in one call (visitor spec 4.5, 7: the visible page of 48). 49 is `too_large`. */
export const RESOLVE_MAX = 48;
/** The merge route's body cap (visitor spec 8.2). 500 items of identity fields are about 60 KB at most. */
export const MERGE_BODY_MAX_BYTES = 64 * 1024;
/** Offline account writes kept for replay: at most one per favourite after compaction, so twice the cap bounds it. */
export const PENDING_MAX = 2 * FAVOURITES_CAP;
/** The whole envelope (review L2, mirrored): 500 long rows plus a full pending queue fit; anything larger is refused, never written. */
export const ENVELOPE_MAX_BYTES = 640 * 1024;
/** `merged` keeps the most recent accounts only; it is a hint, never the rule (owner, 26 Oct 2026). */
export const MERGED_MAX = 10;
/** The notice's "Got it" snooze: until 10 more favourites or 30 days (visitor spec 14). */
export const SNOOZE_DAYS = 30;
export const SNOOZE_MORE = 10;

export const FAV_SPACES = ["place", "trip"] as const;
export type FavSpace = (typeof FAV_SPACES)[number];

/** SHA-256 of the user id, first 16 hex (visitor spec 4.2). Also a valid `copies/1` merged key, so one hash serves both envelopes. */
export const ACCOUNT_HASH_RE = /^[0-9a-f]{16}$/;
/** A device handle: the space, a colon, the slug. Never a public ref: every ref has a slash after its first word (REF_RE). */
export const HANDLE_RE = /^(place|trip):([a-z0-9][a-z0-9-]{0,99})$/;

/** UTC with `Z` only, any fraction (review M1): an offset would make two spellings of one instant. */
const isoDateTime = z.iso.datetime();
const space = z.enum(FAV_SPACES);
const slug = z.string().regex(SLUG);
/** A private origin key anywhere in a ref (store.ts A24; the detector's ORIGIN_REF). */
const NO_ORIGIN_KEY = /^(?![\s\S]*\b(?:loc|proto):)/;
/**
 * The SHAPE of a ref (D-B2): a layer word, a slash, the rest; spaces, `:` and `#` occur (`trip/<id>/sight:ragged falls`), so only length,
 * no control characters and no private origin key are checked. Internal: what the resolver accepts as a question, so a dated ref asked
 * answers `unknown` like any other unknown ref (public-ref-aliases 5.3, QR4) rather than `invalid_input`.
 */
export const favRefShape = z.string().min(3).max(REF_MAX).regex(REF_RE, "a public ref").regex(NO_ORIGIN_KEY, "a public ref").regex(/^[^\u0000-\u001f\u007f]+$/, "no control characters");
/**
 * A public ref as rows carry it: the shape above, and no dated legacy folder (public-ref-aliases 5.2: a month next to a year is never in
 * a public id; the public form carries the folder alias, `canadian-rockies-2029`). A stored favourite or account row holding a dated ref
 * fails here, so a leak cannot be written back.
 */
export const favRef = favRefShape.regex(NO_DATED_FOLDER_RE, "a public ref (no month and year)");
/** A place kind word. Loose on purpose: a new kind in the catalogue must never turn a stored envelope invalid. */
const kindWord = z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/);
const name = z.string().min(1).max(120).regex(/\S/, "not blank");
const cc = z.string().regex(/^[A-Z]{2}$/);

export const favItem = z.strictObject({
  space,
  /** the slug the visitor hearted, or the current one after a resolve moved it */
  slug,
  /** the stable public ref; null until a resolve answered it */
  ref: favRef.nullable(),
  // snapshot of the light row (P8); null until known
  name: name.nullable(),
  /** a place's kind; always null for a trip */
  kind: kindWord.nullable(),
  cc: cc.nullable(),
  /** private: when the visitor hearted it */
  favouredAt: isoDateTime,
  /**
   * The tombstone (visitor spec 4.5): when a resolve first answered `withdrawn` or `unknown`. The row stays, reading "No longer listed"
   * with Remove, and is never dropped silently; a later `current` answer clears it (a withdrawn record that returns).
   */
  unlistedAt: isoDateTime.nullable(),
});

/** An account write made while offline, replayed in order on reconnect (visitor spec 4.2). */
export const favPending = z.strictObject({
  op: z.enum(["add", "remove"]),
  space,
  slug,
  ref: favRef.nullable(),
  at: isoDateTime,
});

export const favouritesEnvelope = z.strictObject({
  schema: z.literal(FAVOURITES_SCHEMA),
  items: z.array(favItem).max(FAVOURITES_CAP),
  /** when the first-save toast was shown on this device (once per device) */
  noteSeen: isoDateTime.nullable(),
  /** the notice's "Got it" snooze: hidden until this time ... */
  snoozedUntil: isoDateTime.nullable(),
  /** ... or until the list holds SNOOZE_MORE more than it did when snoozed */
  snoozedAtCount: z.int().min(0).max(FAVOURITES_CAP).nullable(),
  /**
   * account hash -> when this device last merged into that account. A HINT only (owner, 26 Oct 2026): the merge runs whenever the list
   * holds items (`mergeDue`); this only tells a first merge from a later one. At most MERGED_MAX entries, the most recent kept.
   */
  merged: z.record(z.string().regex(ACCOUNT_HASH_RE), isoDateTime),
  /** the account cache's offline writes; always empty in the signed-out list */
  pending: z.array(favPending).max(PENDING_MAX),
});

export type FavItem = z.infer<typeof favItem>;
export type FavPending = z.infer<typeof favPending>;
export type FavouritesEnvelope = z.infer<typeof favouritesEnvelope>;

export const emptyFavourites = (): FavouritesEnvelope => ({
  schema: FAVOURITES_SCHEMA,
  items: [],
  noteSeen: null,
  snoozedUntil: null,
  snoozedAtCount: null,
  merged: {},
  pending: [],
});

// ---- resolveRefs: the read contract (visitor spec 4.5, 8.2) ----

/**
 * The answer for one handle:
 *   - `current`: the handle names a live public page as it is;
 *   - `moved`: the same page under a new slug (a retired slug) or a new ref (an alias); `slug` and `ref` are the current ones;
 *   - `merged`: the record was merged into another; `slug` and `ref` are the survivor's;
 *   - `withdrawn`: the registry tombstoned it; its slug stays reserved and answers not_found;
 *   - `unknown`: never a public page, or not public now (a trip made private). Told apart from `withdrawn` only by the registry, so
 *     neither reveals anything a visitor did not already hold.
 */
export const RESOLVE_STATES = ["current", "moved", "merged", "withdrawn", "unknown"] as const;
export type ResolveState = (typeof RESOLVE_STATES)[number];

/** A handle (`place:<slug>`, `trip:<slug>`) or a public ref (`route/johnston-canyon`, `place/<slug>`, `trip/<id>`). */
export const resolveInput = z.string().min(1).max(REF_MAX);
export const resolveQuery = z.strictObject({ refs: z.array(resolveInput).min(1) });
export type ResolveQuery = z.infer<typeof resolveQuery>;

export const resolveRow = z.strictObject({
  /** the handle or ref as asked, verbatim */
  asked: resolveInput,
  state: z.enum(RESOLVE_STATES),
  /** the space asked for, or the one the ref was found in; null for an unknown ref */
  space: space.nullable(),
  /** the current slug (`current`, `moved`, `merged`), the reserved slug (`withdrawn`), or null (`unknown`) */
  slug: slug.nullable(),
  /** the current public ref; null for `withdrawn` and `unknown` */
  ref: favRef.nullable(),
  name: name.nullable(),
  kind: kindWord.nullable(),
  cc: cc.nullable(),
});
export type ResolveRow = z.infer<typeof resolveRow>;

/** One row per asked value, in the order asked (a repeated value answers twice). */
export const resolveAnswer = z.strictObject({ items: z.array(resolveRow) });
export type ResolveAnswer = z.infer<typeof resolveAnswer>;

/** The light row behind a snapshot: what the resolver reads from the catalogue index, nothing more (P8). */
export interface LightRow {
  name: string;
  kind: string | null;
  cc: string | null;
}

// ---- the account routes' bodies (FAV-2; /api/account/* stays out of OpenAPI) ----

/** What a device sends to merge: identity only. The server resolves every item and never trusts a snapshot. */
export const mergeItem = z.strictObject({ space, slug, ref: favRef.nullable(), favouredAt: isoDateTime });
export const mergeInput = z.strictObject({ userId: z.string().min(1).max(200), items: z.array(mergeItem).max(FAVOURITES_CAP) });
export type MergeItem = z.infer<typeof mergeItem>;
export type MergeInput = z.infer<typeof mergeInput>;

/** An `account_favourite` row as the routes read and write it (FAV-D). */
export const accountFavourite = z.strictObject({ ref: favRef, space, favouredAt: isoDateTime });
export type AccountFavourite = z.infer<typeof accountFavourite>;

/** The merge answer (visitor spec 4.4 step 2): the account list after the merge, resolved for the cache, and the counts for the toast. */
export const mergeAnswer = z.strictObject({
  items: z.array(favItem).max(FAVOURITES_CAP),
  added: z.int().min(0),
  dropped: z.int().min(0),
  overCap: z.int().min(0),
  /**
   * The device handles the server CONFIRMED (review M2): inserted per the insert's `returning ref`, already held, or dropped as gone.
   * The device removes these and only these; everything else stays (over the cap, a row the cap trigger refused). Additive to the
   * spec's `{ items, added, dropped, overCap }`; it replaces the earlier `keep` list, which removed what the server never confirmed.
   */
  taken: z.array(z.string().regex(HANDLE_RE)).max(FAVOURITES_CAP),
});
export type MergeAnswer = z.infer<typeof mergeAnswer>;
