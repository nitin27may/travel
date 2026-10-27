// plan-draft/1: a visitor's own trip plan from the trip builder (trip-builder.md 2.4, 15.1 ISO-6; owner answers QB1 and QI1 of 27 Oct
// 2026). One draft is one document, the same on the device and later in the account table's `doc` column (TB-SY), so the sign-in
// merge copies a document verbatim. On the device the drafts sit in a list (`plan-drafts/1`, at most 10 drafts of 16 KB each) under
// the builder's own storage key, whose name lives only in the builder's own keys module (ISO-3).
//
// ISOLATION (15.1). This file is builder-owned: it imports only the public API's shared shapes (./api/common.ts, ./api/limits.ts) and
// the constants of ../config/plans.ts, and nothing from the copy, customise or favourites envelopes, the schedule engine or the
// privacy module (the browser loads it). Nothing outside the builder's paths imports it (web/tests/plan/isolation.test.ts G1); the
// account routes and Mine sync that edit-my-trip adds (EM-1, EM-2) need extension points there first (ISO-6 is superseded by EM1).
//
// WHAT A DRAFT HOLDS (2.4), and what it never holds:
//   - inputs: where (trip mode: a country and region ids; near mode: a start and a one-way drive limit), nights, pace, moves
//     preference, month, picks (public refs and slugs, a must flag), bases (towns-layer ids, pinned or accepted), the visitor's edits
//     to the order with their locks, an optional seed (a public trip slug), and the origin for "Getting there";
//   - outputs: the last build (days, bases, did-not-fit reasons), recomputable at any time, so never authoritative;
//   - NEVER a trip kind: the kind is derived from the nights by `planKindOf` (trip-kinds-and-interest-profile TK1) and a draft holding
//     `kind` is invalid, so the two can never disagree;
//   - NEVER a coordinate: an origin is a typed reference (a public hub, an airport code or a towns-layer id) or null. A device location
//     becomes its nearest towns-layer id on the device before it reaches a draft (trip-builder 7);
//   - NEVER the device party: a builder draft names its source (`party: "device"`); the build reads the device party at build time and
//     sends it in the POST body only (2.4, 7). A draft that chose its own party (`party: "trip"`, edit-my-trip Q-EM4) holds that
//     party as an age snapshot in `travellers`, never a reference to the device or the account profile;
//   - NEVER a private or dated ref: picks are public refs (`<layer>/...`, no `loc:` or `proto:` key, no month next to a year,
//     public-ref-aliases 5.2).
//
// VALIDATION. The raw zod objects keep to the JSON Schema subset (no refine or transform) so they export to OpenAPI and JSON Schema;
// the cross-field rules (unique picks, edits name picks, locks inside their day, regions inside the country, nights by mode, the byte
// caps) live in rule functions. Never call `.parse` or `.safeParse` on the raw objects: use `parsePlanDraft`, `parsePlanDrafts` or
// `readPlanDrafts` (core/test/plan/plan-draft.test.ts fails on a bare call anywhere in core/src or web/).
//
// VERSIONING: envelopes only grow (builder-forward-compat F4). Objects are strict, so a key this reader does not know makes a draft
// `invalid`, never silently dropped on a rewrite. Until the first draft is stored anywhere (FS-1 ships), a new OPTIONAL key or a wider
// enum may be added to `/1` (TK-C4 adds `act`, `sea`, `x`, `dated`); after that every new key is `plan-draft/2`, read beside `/1`, and
// no field is ever removed, renamed or narrowed. A stored value naming a later version is reported `newer` and left untouched.
//
// ONE EDITABLE TRIP DOCUMENT (edit-my-trip.md 1, 2, EM1; task EM-C, 27 Oct 2026; Q-EM1). The same document now holds a visitor's copy
// of one of our trips as well as a builder plan, in one of two MODES, told apart by the `template` key (`planModeOf`):
//   - built mode: `template` absent. Everything above holds unchanged; a builder draft parses byte for byte as before (R2).
//   - template mode: `template` present. The draft follows a public trip and holds only the person's changes to it (the delta that
//     the retired copy-delta document reserved, field names kept so the CUS, STY and REQ specs still read): versions, added, removed
//     and moved places, inserted and dropped days, notes, the Maybe list. The builder inputs stay empty (R1); a builder route
//     refuses such a draft until "Open in the builder" converts it (R4, PLAN_TEMPLATE_REFUSAL).
// Both modes may carry `start` (Day 1), the trip's own party (`party: "trip"` with `travellers`), and the origin keys `fromRef` and
// `gw`. These are household data (edit-my-trip 7): `travellers` is an AGE SNAPSHOT (adults, and each child's age in whole years),
// never a birth date, a birth month or a name (account-profile-and-travellers 9.5 rules 1 and 2); the detector fails a served body
// that carries them. The draft-level rules R1 to R7 live in `planDraftRules`.
//
// The copy mapper, the sign-in merge's content key and the account row's derived columns are in core/src/plan/doc.ts; the edit
// operations, their inverses and `rebase` in core/src/plan/ops.ts; the outbox in core/src/plan/sync.ts. The caps are
// core/src/config/plans.ts (pure constants: the browser may load them).
import { z } from "zod";
import { PLAN_DOC_LIMITS } from "../config/plans.ts";
import { apiPlaceRef, apiSlug, apiTownId, NO_DATED_FOLDER_RE } from "./api/common.ts";

export const PLAN_DRAFT_SCHEMA = "plan-draft/1";
/** The device list of drafts (the value of the builder's `local` storage key). */
export const PLAN_DRAFTS_SCHEMA = "plan-drafts/1";

/**
 * The builder's caps, written once (trip-builder 2.4, 5, 15.1 ISO-3; trip-kinds 1.1). The API caps in ./api/plan.ts extend these.
 * `nights` 21 is the longer-holiday kind's top; `days` is nights plus one. `nearNights` and `driveLimitMin.max` are the week kind's near
 * limits (trip-kinds section 11 widens trip-builder 2.2's 5 nights and 4 h).
 */
export const PLAN_LIMITS = {
  /** drafts on one device (TB7) */
  drafts: 10,
  /** bytes of one draft, as UTF-8 JSON (TB7) */
  draftBytes: 16 * 1024,
  /** picks in one draft or build (5) */
  picks: 40,
  nights: 21,
  days: 22,
  nearNights: 9,
  /** bases in one plan (4.4 Kmax) */
  bases: 4,
  /** region groups or regions chosen in one country */
  regions: 20,
  /** one-way drive limit in near mode, minutes, in steps of `step` */
  driveLimitMin: { min: 30, max: 480, step: 15 },
  /** reasons carried by one base, day or left-out pick */
  reasons: 4,
  /** warning codes on one built day (the 16 day checks) */
  warnings: 16,
  /** the device list's own fields beyond its drafts */
  listOverheadBytes: 4 * 1024,
} as const;

// ---- trip kinds: derived, never stored --------------------------------------------------------------------------------------------

/** trip-kinds TK1: five kinds as presets, derived from the nights. */
export const PLAN_KINDS = ["day", "weekend", "long_weekend", "week", "holiday"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];
/** The lowest nights of each kind, in order: day 0, weekend 1 to 2, long weekend 3 to 4, week 5 to 9, holiday 10 to 21. */
export const PLAN_KIND_FLOOR: Readonly<Record<PlanKind, number>> = { day: 0, weekend: 1, long_weekend: 3, week: 5, holiday: 10 };

/**
 * The kind of a plan of `nights` nights, or null when the nights are not chosen yet or are outside 0 to PLAN_LIMITS.nights. The one
 * derivation: a draft never stores a kind (TK1), and TK-E's `tripKindOf` (core/src/derive/length.ts) delegates here.
 */
export function planKindOf(nights: number | null | undefined): PlanKind | null {
  if (nights === null || nights === undefined || !Number.isInteger(nights) || nights < 0 || nights > PLAN_LIMITS.nights) return null;
  let kind: PlanKind = "day";
  for (const k of PLAN_KINDS) if (nights >= PLAN_KIND_FLOOR[k]) kind = k;
  return kind;
}

// ---- shared shapes (the draft and the build API) ----------------------------------------------------------------------------------

export const PLAN_MODES = ["trip", "near"] as const;
/** The scheduler's paces (core/src/schedule PACE_RULES keys; pinned by core/test/plan/plan-draft.test.ts). */
export const PLAN_PACES = ["relaxed", "standard", "full"] as const;
/** The moves preference (4.4 `M`): fewer moves, balanced, shorter drives. */
export const PLAN_MOVES = ["fewer", "balanced", "shorter"] as const;

/** ISO 3166-1 alpha-2, upper case. */
export const PLAN_COUNTRY_RE = /^[A-Z]{2}$/;
/**
 * A region (the locations store's `<CC>/<code>`, `IT/veneto`, `AR/C`) or a region group (TB-RG, `<cc>-<id>`, `it-ne`). Both name their
 * country, so `planDraftRules` checks a draft's regions against its country.
 */
export const PLAN_REGION_RE = /^(?:[A-Z]{2}\/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*|[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*)$/;
export const planRegionId = z.string().max(48).regex(PLAN_REGION_RE, "a region (CC/code) or a region group (cc-id)");

/** A public hub id (short-trips 4.1; MX `hubs.json`): a slug. */
export const PLAN_HUB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PLAN_IATA_RE = /^[A-Z]{3}$/;

/**
 * Where a plan starts or a visitor flies from: a public hub, an airport, or a towns-layer town (what "Use my location" becomes on the
 * device). A reference only; the label and the point come from public reference files on the server. NEVER a coordinate (7, OR9).
 */
export const planOrigin = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("hub"), id: z.string().max(60).regex(PLAN_HUB_RE) }),
  z.strictObject({ kind: z.literal("airport"), iata: z.string().regex(PLAN_IATA_RE) }),
  z.strictObject({ kind: z.literal("town"), id: apiTownId }),
]);
export type PlanOrigin = z.infer<typeof planOrigin>;

/**
 * An origin as one token, for a query parameter (`hub:toronto`, `iata:YYZ`, `town:ca-on-toronto`): the grammar of trip-custom's
 * ORIGIN_REFERENCE without its GeoNames form. Private wherever it is stored; never echoed in a served body (the detector's `from` rule).
 */
export const PLAN_ORIGIN_TOKEN_RE = /^(?:hub:[a-z0-9]+(?:-[a-z0-9]+)*|iata:[A-Z]{3}|town:[a-z]{2}-[a-z0-9]+-[a-z0-9-]+)$/;
export const originToken = (o: PlanOrigin): string => (o.kind === "airport" ? `iata:${o.iata}` : `${o.kind}:${o.id}`);
/** The origin a token names, or null for anything else (never a throw: a query string is the visitor's text). */
export function originOfToken(s: string): PlanOrigin | null {
  if (typeof s !== "string" || s.length > 120 || !PLAN_ORIGIN_TOKEN_RE.test(s)) return null;
  const i = s.indexOf(":");
  const head = s.slice(0, i);
  const rest = s.slice(i + 1);
  const o = head === "iata" ? { kind: "airport", iata: rest } : { kind: head, id: rest };
  const r = planOrigin.safeParse(o);
  return r.success ? r.data : null;
}

/** A private origin key anywhere in a ref (store.ts A24; the detector's ORIGIN_REF). */
const NO_ORIGIN_KEY = /^(?![\s\S]*\b(?:loc|proto):)/;
/** No control characters. */
const NO_CONTROL = /^[^\u0000-\u001f\u007f]+$/;
/**
 * A pick's identity: the public place ref the candidate row carried (`<layer>/...`, its dated folder already aliased), never a private
 * origin key and never a month next to a year (public-ref-aliases 5.2).
 */
export const planRef = apiPlaceRef.regex(NO_ORIGIN_KEY, "a public ref, never a private origin key").regex(NO_CONTROL, "no control characters");
/** A public slug with no month and year in it (public-ref-aliases 2: the line). */
export const planSlug = apiSlug.regex(NO_DATED_FOLDER_RE, "a public slug holds no month and year");
const name = z.string().min(1).max(120).regex(/\S/, "not blank");
const isoDateTime = z.iso.datetime();

/** Trip mode: one country (TB14) and the chosen region groups or regions (empty until step 2). */
export const planWhereTrip = z.strictObject({
  mode: z.literal("trip"),
  cc: z.string().regex(PLAN_COUNTRY_RE),
  regions: z.array(planRegionId).max(PLAN_LIMITS.regions),
});
/** Near mode: the start and the one-way drive limit (2.2). */
export const planWhereNear = z.strictObject({
  mode: z.literal("near"),
  start: planOrigin,
  driveLimitMin: z.int().min(PLAN_LIMITS.driveLimitMin.min).max(PLAN_LIMITS.driveLimitMin.max).multipleOf(PLAN_LIMITS.driveLimitMin.step),
});
export const planWhere = z.discriminatedUnion("mode", [planWhereTrip, planWhereNear]);

export const planPick = z.strictObject({
  ref: planRef,
  /** the public slug the share link carries (`p=`) */
  slug: planSlug,
  /** snapshot of the row's name (P8), so the draft lists offline */
  name,
  /** "must see": never dropped by the packer; a must that cannot fit is a did-not-fit with a fix */
  must: z.boolean(),
});

/** A base: a towns-layer town, pinned by the visitor (a constraint at any step, TB2) or accepted from a suggestion. */
export const planBaseChoice = z.strictObject({
  town: apiTownId,
  /** null until the nights are shared out (4.5) */
  nights: z.int().min(0).max(PLAN_LIMITS.nights).nullable(),
  pinned: z.boolean(),
});

/** One day the visitor edited (`o=` of 2.5): its picks in order; `locked` ones keep their day and position on every rebuild (4.6). */
export const planDayEdit = z.strictObject({
  day: z.int().min(1).max(PLAN_LIMITS.days),
  refs: z.array(planRef).max(PLAN_LIMITS.picks),
  locked: z.array(planRef).max(PLAN_LIMITS.picks),
});

// ---- outputs: the last build ------------------------------------------------------------------------------------------------------

/** The honest "cannot fit" codes (4.7). */
export const PLAN_MISS_CODES = ["TB_TOO_FAR", "TB_CLOSED", "TB_FIT", "TB_TIME", "TB_BOOKING", "TB_UNKNOWN"] as const;
/** The one fix offered with a left-out pick (4.7). `add_days` carries `days`; `swap` carries `ref`; `add_base` may carry `town`. */
export const PLAN_FIX_KINDS = ["add_base", "drop", "change_month", "family_variant", "add_days", "swap", "ask_us"] as const;
/** Where a drive figure comes from: a routed matrix cell, or the straight-line estimate shown with ≈ (4.10). */
export const PLAN_BASIS = ["routed", "estimate"] as const;
/** A day-check warning code (core/src/checks, `W_DAYLIGHT`, `W_PACE`, ...). Loose: a new check never invalidates a stored draft. */
export const PLAN_WARNING_RE = /^W_[A-Z0-9_]{2,40}$/;
/** An engine version (`tb-e1.1`): which engine made the build, so a stale build can be told apart. */
export const PLAN_ENGINE_RE = /^[a-z0-9][a-z0-9.-]{0,31}$/;

/**
 * A reason built from the numbers the engine used (4.9): a code, its values, and the words. A reason without a number or a source is
 * never made, so `values` is never empty.
 */
export const planReason = z.strictObject({
  code: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/),
  values: z.record(z.string().regex(/^[a-z][A-Za-z0-9]{0,23}$/), z.union([z.number(), z.string().max(120)])),
  text: z.string().min(1).max(240),
});
const reasons = z.array(planReason).max(PLAN_LIMITS.reasons);

export const planBaseOut = z.strictObject({
  town: apiTownId,
  name,
  nights: z.int().min(0).max(PLAN_LIMITS.nights),
  pinned: z.boolean(),
  /** picks assigned to this base */
  picks: z.int().min(0).max(PLAN_LIMITS.picks),
  reasons,
});

export const planItemOut = z.strictObject({
  ref: planRef,
  slug: planSlug,
  name,
  /** minutes after midnight the visit starts (past 1440 is the next morning), or null when the scheduler left it untimed */
  startMin: z.int().min(0).max(2879).nullable(),
  /** time on site */
  visitMin: z.int().min(0).max(1440),
  /** the drive into this item from the previous stop or the base; null for the first item of a walk-in day */
  driveMin: z.int().min(0).max(1440).nullable(),
  basis: z.enum(PLAN_BASIS).nullable(),
  locked: z.boolean(),
});

export const planDayOut = z.strictObject({
  day: z.int().min(1).max(PLAN_LIMITS.days),
  /** the base slept at after this day; null on a day trip's one day and the last day home */
  base: apiTownId.nullable(),
  /** a move day ends at another base than it starts */
  move: z.boolean(),
  items: z.array(planItemOut).max(PLAN_LIMITS.picks),
  /** the drive back to the base (or home) after the last item */
  returnMin: z.int().min(0).max(1440).nullable(),
  /** every day-check warning the scheduler raised; the builder shows them all and hides none (4.6) */
  warnings: z.array(z.string().regex(PLAN_WARNING_RE)).max(PLAN_LIMITS.warnings),
  reasons,
});

export const planFix = z.strictObject({
  kind: z.enum(PLAN_FIX_KINDS),
  /** add_days: the smallest number of days (1 to 3) the engine confirmed fits every must pick (4.7) */
  days: z.int().min(1).max(3).optional(),
  /** swap: the pick to swap with */
  ref: planRef.optional(),
  /** add_base: the town suggested near the pick */
  town: apiTownId.optional(),
});

/** A pick that is on no day, with its reason and at most one fix (U6: nothing vanishes silently). */
export const planMiss = z.strictObject({
  ref: planRef,
  code: z.enum(PLAN_MISS_CODES),
  fix: planFix.nullable(),
  reasons,
});

/** What a build returns that a draft keeps (2.4: "the last build"). The picks matrix is not kept: it is fetched again on a rebuild. */
export const planOutputsShape = {
  engine: z.string().regex(PLAN_ENGINE_RE),
  /** every leg routed, every leg estimated (≈), or both */
  basis: z.enum(["routed", "estimate", "mixed"]),
  bases: z.array(planBaseOut).max(PLAN_LIMITS.bases),
  days: z.array(planDayOut).max(PLAN_LIMITS.days),
  didNotFit: z.array(planMiss).max(PLAN_LIMITS.picks),
  /** days left over after every pick fitted: offered as suggestions near a base, never filled silently (4.5) */
  spareDays: z.int().min(0).max(PLAN_LIMITS.days),
};
export const planOutputs = z.strictObject({ ...planOutputsShape, builtAt: isoDateTime });

// ---- the draft --------------------------------------------------------------------------------------------------------------------

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** A draft's id: a lower-case UUID v4 made on the device. */
export const planDraftId = z.string().regex(UUID_V4, "a lower-case UUID v4");

// ---- template mode: the delta on a public trip (edit-my-trip.md 2) ------------------------------------------------------------------
//
// The atoms below mirror the device copy's (`copies/1`: timeline profile, overrides, travellers, origin reference, airports, content
// revision) exactly; core/test/plan/plan-doc.test.ts pins the JSON Schemas equal, because the copy module cannot import this file
// (the builder fence) and this file does not import the copy module (its own isolation rule).

/** The two modes of one document; the account row's `kind` column holds the same words. */
export const PLAN_DOC_MODES = ["template", "built"] as const;
export type PlanDocMode = (typeof PLAN_DOC_MODES)[number];

/** R4: what a builder route answers for a template draft ("Open in the builder" converts it first). */
export const PLAN_TEMPLATE_REFUSAL = { status: 409, code: "TEMPLATE_DRAFT" } as const;

/**
 * An operation id (R7): `o-` and 1 to 40 letters, digits, `_` or `-`. Made on the device (a random token), unique across a draft's
 * template block, so undo and the rebase of 4.4 can name one change; the copy mapper numbers a copy's additions `o-1`, `o-2`, ...
 */
export const PLAN_OP_ID_RE = /^o-[A-Za-z0-9_-]{1,40}$/;
export const planOpId = z.string().regex(PLAN_OP_ID_RE, "an operation id (o-...)");

/**
 * A schedule id (R6; trip-timeline 1.2): a plan item's own id (`moose-lake-loop`) or a generated `${day}-${lane}-${kind}-${n}`. A
 * token, never a name (no spaces), never a private origin key, never a dated folder.
 */
export const PLAN_SCHEDULE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:#/-]{0,119}$/;
export const planScheduleId = z
  .string()
  .regex(PLAN_SCHEDULE_ID_RE, "a schedule id, never a name")
  .regex(NO_ORIGIN_KEY, "never a private origin key")
  .regex(NO_DATED_FOLDER_RE, "a schedule id holds no month and year");

/** A day of the published plan, 1 to 99. Day numbers in a template block always count the PUBLISHED days, so they survive a rebase. */
export const planTemplateDay = z.number().int().min(1).max(PLAN_DOC_LIMITS.templateDays);
/** A day of the copy: a published day, or the operation id of a day the person inserted. */
export const planDayRef = z.union([planTemplateDay, planOpId]);

/** The timeline profile a copy plans for (the copy's `profile`; `walk` is the walk limit in km, null from the ages). */
export const planProfile = z.strictObject({
  party: z.enum(["adults", "family"]),
  youngest: z.number().int().min(0).max(17).nullable(),
  pace: z.enum(PLAN_PACES),
  adults: z.number().int().min(1).max(12),
  walk: z.number().positive().max(100).nullable(),
  split: z.boolean(),
});

/** Day number (an object key, 1 to 99) to the version chosen for it. At most PLAN_DOC_LIMITS.overrides keys (a rule). */
export const planOverrides = z.record(z.string().regex(/^[1-9]\d?$/, "a day number 1 to 99"), z.enum(["A", "B", "C"]));

/**
 * The trip's own party as an AGE SNAPSHOT (edit-my-trip 7, Q-EM4; account-profile-and-travellers 9.5): the number of adults and each
 * child's age in whole years at the time it was chosen. No names, no birth date or month: strict, so any other key is refused.
 */
export const planTravellers = z.strictObject({
  adults: z.number().int().min(1).max(12),
  children: z.array(z.number().int().min(0).max(17)).max(12),
});

/** An origin reference (trip-origin-and-nearest-airport 10): `iata:BOM`, `hub:toronto`, `town:<towns-layer id>` or `gn:<GeoNames id>`. */
export const PLAN_ORIGIN_REFERENCE_RE = /^(?:iata:[A-Z]{3}|hub:[a-z0-9][a-z0-9-]{0,59}|town:[a-z0-9][a-z0-9-]{0,99}|gn:[1-9]\d{0,9})$/;
export const planOriginRef = z.string().regex(PLAN_ORIGIN_REFERENCE_RE, "an origin reference: iata:XXX, hub:<id>, town:<id> or gn:<number>");
/** The arrival and departure airports picked (`gw=yeg,yyc`). */
export const planGateways = z.strictObject({ in: z.string().regex(PLAN_IATA_RE), out: z.string().regex(PLAN_IATA_RE) });
/** The public trip's content revision when the copy was last reconciled with it (a hash or a date stamp). */
export const planSourceRevision = z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/, "a content revision");
/** A best-time window id (OVR). */
export const planWindowId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/, "a window id");

/** A catalogue place the person added to a day; `after` is the schedule id it follows (absent: the end of the day). */
export const planAdded = z.strictObject({ op: planOpId, day: planDayRef, ref: planRef, after: planScheduleId.optional() });
/** A published stop the person removed. */
export const planRemoved = z.strictObject({ op: planOpId, day: planTemplateDay, item: planScheduleId });
/** A published stop the person moved: from `day` to `toDay` (the same day for a reorder), after `after` (absent: the start). */
export const planMoved = z.strictObject({ op: planOpId, day: planTemplateDay, item: planScheduleId, toDay: planDayRef, after: planScheduleId.optional() });
/** A day inserted after a day (0: before Day 1), or a published day dropped. */
export const planDayOp = z.discriminatedUnion("kind", [
  z.strictObject({ op: planOpId, kind: z.literal("insert"), after: z.number().int().min(0).max(PLAN_DOC_LIMITS.templateDays) }),
  z.strictObject({ op: planOpId, kind: z.literal("drop"), day: planTemplateDay }),
]);
/** A place on the Maybe list. */
export const planMaybe = z.strictObject({ op: planOpId, ref: planRef });

/** A note's key: the trip, a published day, or an inserted day's operation id. */
export const PLAN_NOTE_KEY_RE = /^(?:trip|[1-9]\d?|o-[A-Za-z0-9_-]{1,40})$/;
/** A note: free text (line breaks and tabs allowed, no other control character). Personal: never public, never sent to research. */
export const planNoteText = z
  .string()
  .min(1)
  .max(PLAN_DOC_LIMITS.noteChars)
  .regex(/\S/, "not blank")
  .regex(/^[^\u0000-\u0008\u000b-\u001f\u007f]*$/, "no control characters");
export const planNotes = z.record(z.string().regex(PLAN_NOTE_KEY_RE, "trip, a day number or an inserted day"), planNoteText);

/** The template block (edit-my-trip 2): the public trip a copy follows and the person's changes to it. `custom` and `stays` (REQ, STY-2C) are not in `/1`: their shapes are not specified yet, so they arrive as `plan-draft/2`. */
export const planTemplate = z.strictObject({
  /** the public trip's slug (the account row's `source_trip`) */
  trip: planSlug,
  rev: planSourceRevision.nullable(),
  /** the timeline profile, or null for the trip's default */
  profile: planProfile.nullable(),
  window: planWindowId.nullable(),
  overrides: planOverrides,
  added: z.array(planAdded).max(PLAN_DOC_LIMITS.added),
  removed: z.array(planRemoved).max(PLAN_DOC_LIMITS.removed),
  moved: z.array(planMoved).max(PLAN_DOC_LIMITS.moved),
  days: z.array(planDayOp).max(PLAN_DOC_LIMITS.dayOps),
  notes: planNotes,
  maybe: z.array(planMaybe).max(PLAN_DOC_LIMITS.maybe),
});

export const planDraft = z.strictObject({
  schema: z.literal(PLAN_DRAFT_SCHEMA),
  /** a random UUID v4 made on the device (the URL's `draft` key, ISO-1); the sign-in merge is idempotent on it */
  id: planDraftId,
  /** the visitor's own title, or null for the derived one */
  title: name.nullable(),
  where: planWhere,
  /**
   * null until step 4 (days are pre-filled from the picks, TB3); the kind is `planKindOf(nights)`. A built draft plans at most
   * PLAN_LIMITS.nights (a rule); a template draft has the published trip's nights plus its inserted days, less its dropped ones
   */
  nights: z.int().min(0).max(PLAN_DOC_LIMITS.templateDays - 1).nullable(),
  pace: z.enum(PLAN_PACES),
  moves: z.enum(PLAN_MOVES),
  /** 1 to 12; null for no month chosen */
  month: z.int().min(1).max(12).nullable(),
  /**
   * the party's source: `device`, the device profile read at build time and never copied here (2.4); or `trip`, this trip's own party
   * in `travellers` (edit-my-trip 2, R3)
   */
  party: z.enum(["device", "trip"]),
  picks: z.array(planPick).max(PLAN_LIMITS.picks),
  bases: z.array(planBaseChoice).max(PLAN_LIMITS.bases),
  edits: z.array(planDayEdit).max(PLAN_LIMITS.days),
  /** trip mode's "Getting there" (step 7): where the visitor starts; null until chosen. Near mode starts at `where.start` */
  origin: planOrigin.nullable(),
  /** the public trip this draft started from (2.6, ISO-7): read once, never written back */
  seed: planSlug.nullable(),
  lastBuild: planOutputs.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  // ---- edit-my-trip 2 (EM-C): optional, so every builder draft reads as before ----
  /** template mode: the public trip followed and the person's changes (absent: built mode) */
  template: planTemplate.optional(),
  /** Day 1 as an ISO date; absent for an undated plan (Mine's "No date" group). Household data */
  start: z.iso.date().optional(),
  /** only with `party: "trip"` (R3): the trip's own party as an age snapshot. Household data */
  travellers: planTravellers.optional(),
  /** the visitor's origin for this trip (the stored name of the URL's `from`). Household data */
  fromRef: planOriginRef.optional(),
  /** the airports picked. Household data */
  gw: planGateways.optional(),
});

export const planDrafts = z.strictObject({
  schema: z.literal(PLAN_DRAFTS_SCHEMA),
  items: z.array(planDraft).max(PLAN_LIMITS.drafts),
});

export type PlanWhere = z.infer<typeof planWhere>;
export type PlanPick = z.infer<typeof planPick>;
export type PlanBaseChoice = z.infer<typeof planBaseChoice>;
export type PlanDayEdit = z.infer<typeof planDayEdit>;
export type PlanReason = z.infer<typeof planReason>;
export type PlanBaseOut = z.infer<typeof planBaseOut>;
export type PlanItemOut = z.infer<typeof planItemOut>;
export type PlanDayOut = z.infer<typeof planDayOut>;
export type PlanMiss = z.infer<typeof planMiss>;
export type PlanOutputs = z.infer<typeof planOutputs>;
export type PlanDraft = z.infer<typeof planDraft>;
export type PlanDrafts = z.infer<typeof planDrafts>;
export type PlanTemplate = z.infer<typeof planTemplate>;
export type PlanProfile = z.infer<typeof planProfile>;
export type PlanTravellers = z.infer<typeof planTravellers>;
export type PlanGateways = z.infer<typeof planGateways>;
export type PlanAdded = z.infer<typeof planAdded>;
export type PlanRemoved = z.infer<typeof planRemoved>;
export type PlanMoved = z.infer<typeof planMoved>;
export type PlanDayOp = z.infer<typeof planDayOp>;
export type PlanMaybe = z.infer<typeof planMaybe>;
export type PlanDayRef = z.infer<typeof planDayRef>;
/** A template draft: the document with its `template` block present. */
export type PlanTemplateDraft = PlanDraft & { template: PlanTemplate };

/** The mode of a draft (edit-my-trip 2): template when it follows a public trip, else built. */
export const planModeOf = (d: Pick<PlanDraft, "template">): PlanDocMode => (d.template === undefined ? "built" : "template");
export const isTemplateDraft = (d: PlanDraft): d is PlanTemplateDraft => d.template !== undefined;

/** The lists of a template block that hold operation entries, in a fixed order (R7 reads them all). */
export const PLAN_TEMPLATE_LISTS = ["days", "added", "removed", "moved", "maybe"] as const;
export type PlanTemplateList = (typeof PLAN_TEMPLATE_LISTS)[number];

/** An empty template block on a public trip: what a fresh copy starts from. */
export const emptyPlanTemplate = (trip: string, rev: string | null = null): PlanTemplate => ({
  trip,
  rev,
  profile: null,
  window: null,
  overrides: {},
  added: [],
  removed: [],
  moved: [],
  days: [],
  notes: {},
  maybe: [],
});

export const emptyPlanDrafts = (): PlanDrafts => ({ schema: PLAN_DRAFTS_SCHEMA, items: [] });

// ---- the rules JSON Schema cannot hold --------------------------------------------------------------------------------------------

export type Checked<T> = { success: true; data: T } | { success: false; issues: string[] };

/** UTF-8 bytes. */
export const byteLength = (s: string): number => new TextEncoder().encode(s).length;

/**
 * zod issues as `path: rule`, never a value (a draft is the visitor's data). A record's key (a note's or an override's key) is data,
 * so a path element that is not a plain field name reads `[key]`.
 */
function issuesOf(e: z.ZodError): string[] {
  const seg = (p: PropertyKey): string => (typeof p === "number" ? `[${p}]` : typeof p === "string" && /^[A-Za-z_]{1,40}$/.test(p) ? `.${p}` : "[key]");
  return e.issues.map((i) => `$${i.path.map(seg).join("")}: ${i.code}`);
}
/** The same, for the plan modules that parse their own envelopes (core/src/plan/ops.ts, sync.ts). */
export const planIssuesOf = issuesOf;

const dupes = (xs: readonly string[]): string[] => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))];

/** The inputs' rules, shared by a draft and a build body: paths and rules only, never a value. */
export function planInputRules(
  d: { where: PlanWhere; nights: number | null; picks: readonly { ref: string; slug?: string }[]; bases: readonly PlanBaseChoice[]; edits: readonly PlanDayEdit[] },
  at = "$",
): string[] {
  const out: string[] = [];
  const w = d.where;
  if (w.mode === "trip") {
    const cc = w.cc;
    w.regions.forEach((r, i) => {
      if (!(r.startsWith(`${cc}/`) || r.startsWith(`${cc.toLowerCase()}-`))) out.push(`${at}.where.regions[${i}]: a region of the draft's country`);
    });
    if (dupes(w.regions).length) out.push(`${at}.where.regions: each region once`);
  } else if (d.nights !== null && d.nights > PLAN_LIMITS.nearNights) {
    out.push(`${at}.nights: near mode plans at most ${PLAN_LIMITS.nearNights} nights`);
  }
  const refs = d.picks.map((p) => p.ref);
  if (dupes(refs).length) out.push(`${at}.picks: each place once`);
  const slugs = d.picks.flatMap((p) => (p.slug === undefined ? [] : [p.slug]));
  if (dupes(slugs).length) out.push(`${at}.picks: each slug once`);
  const towns = d.bases.map((b) => b.town);
  if (dupes(towns).length) out.push(`${at}.bases: each town once`);
  if (d.nights !== null) {
    const shared = d.bases.reduce((n, b) => n + (b.nights ?? 0), 0);
    if (shared > d.nights) out.push(`${at}.bases: base nights add up to at most the plan's nights`);
  }
  if (d.nights === 0 && d.bases.length) out.push(`${at}.bases: a day trip has no base`);
  const picked = new Set(refs);
  const days = d.edits.map((e) => e.day);
  if (dupes(days.map(String)).length) out.push(`${at}.edits: each day once`);
  const placed: string[] = [];
  d.edits.forEach((e, i) => {
    if (d.nights !== null && e.day > d.nights + 1) out.push(`${at}.edits[${i}].day: a day of the plan`);
    if (e.refs.some((r) => !picked.has(r))) out.push(`${at}.edits[${i}].refs: only picks`);
    const inDay = new Set(e.refs);
    if (e.locked.some((r) => !inDay.has(r))) out.push(`${at}.edits[${i}].locked: a locked place is in its day`);
    if (dupes(e.locked).length) out.push(`${at}.edits[${i}].locked: each place once`);
    placed.push(...e.refs);
  });
  if (dupes(placed).length) out.push(`${at}.edits: a place is on one day at most`);
  return out;
}

/** The month (1 to 12) of an ISO date `YYYY-MM-DD`. */
const monthOfDate = (iso: string): number => Number(iso.slice(5, 7));

/**
 * A template block's own rules (edit-my-trip 2 R5 to R7): at most 60 overrides and 2,000 note characters; every operation id once
 * across the block (R7); an inserted day named by a place, a move or a note exists; a published stop removed once and moved once; a
 * place added once and on the Maybe list once; a published day dropped once. Paths and rules only, never a value.
 */
export function planTemplateRules(t: PlanTemplate, at = "$.template"): string[] {
  const out: string[] = [];
  if (Object.keys(t.overrides).length > PLAN_DOC_LIMITS.overrides) out.push(`${at}.overrides: at most ${PLAN_DOC_LIMITS.overrides} overrides`);
  const chars = Object.values(t.notes).reduce((n, s) => n + s.length, 0);
  if (chars > PLAN_DOC_LIMITS.noteChars) out.push(`${at}.notes: at most ${PLAN_DOC_LIMITS.noteChars} characters in all`);
  const ops = [...t.days, ...t.added, ...t.removed, ...t.moved, ...t.maybe].map((e) => e.op);
  if (dupes(ops).length) out.push(`${at}: each operation id once (R7)`);
  const inserted = new Set(t.days.flatMap((x) => (x.kind === "insert" ? [x.op] : [])));
  const known = (day: PlanDayRef): boolean => typeof day === "number" || inserted.has(day);
  t.added.forEach((a, i) => {
    if (!known(a.day)) out.push(`${at}.added[${i}].day: an inserted day of this draft`);
  });
  t.moved.forEach((m, i) => {
    if (!known(m.toDay)) out.push(`${at}.moved[${i}].toDay: an inserted day of this draft`);
  });
  for (const k of Object.keys(t.notes)) if (k.startsWith("o-") && !inserted.has(k)) out.push(`${at}.notes: a note's inserted day exists`);
  if (dupes(t.removed.map((r) => `${r.day}\u0000${r.item}`)).length) out.push(`${at}.removed: each stop once`);
  if (dupes(t.moved.map((m) => `${m.day}\u0000${m.item}`)).length) out.push(`${at}.moved: each stop once`);
  if (dupes(t.added.map((a) => a.ref)).length) out.push(`${at}.added: each place once`);
  if (dupes(t.maybe.map((m) => m.ref)).length) out.push(`${at}.maybe: each place once`);
  if (dupes(t.days.flatMap((x) => (x.kind === "drop" ? [String(x.day)] : []))).length) out.push(`${at}.days: each day dropped once`);
  return out;
}

/**
 * The mode rules (edit-my-trip 2): R3 for both modes (`party: "trip"` needs `travellers`, `party: "device"` forbids them), one origin
 * (`origin` or `fromRef`), a start's month is the draft's month; R2 for a built draft (at most PLAN_LIMITS.nights, so builder drafts
 * read exactly as before); R1 for a template draft (no picks, bases, edits, last build or seed; trip mode with no regions; nights
 * known; the origin in `fromRef`; the pace is the profile's) plus `planTemplateRules`.
 */
export function planModeRules(d: PlanDraft, at = "$"): string[] {
  const out: string[] = [];
  if (d.party === "trip" && d.travellers === undefined) out.push(`${at}.travellers: a trip's own party needs its travellers (R3)`);
  if (d.party === "device" && d.travellers !== undefined) out.push(`${at}.travellers: only with party "trip"; the device party is never copied (R3)`);
  if (d.origin !== null && d.fromRef !== undefined) out.push(`${at}.fromRef: one origin, in origin or in fromRef`);
  if (d.start !== undefined && d.month !== monthOfDate(d.start)) out.push(`${at}.month: the month of start`);
  const t = d.template;
  if (t === undefined) {
    if (d.nights !== null && d.nights > PLAN_LIMITS.nights) out.push(`${at}.nights: a built plan has at most ${PLAN_LIMITS.nights} nights (R2)`);
    return out;
  }
  if (d.picks.length) out.push(`${at}.picks: a template draft has none (R1)`);
  if (d.bases.length) out.push(`${at}.bases: a template draft has none (R1)`);
  if (d.edits.length) out.push(`${at}.edits: a template draft has none (R1)`);
  if (d.lastBuild !== null) out.push(`${at}.lastBuild: a template draft has none (R1)`);
  if (d.seed !== null) out.push(`${at}.seed: a template draft has none (R1)`);
  if (d.where.mode !== "trip" || d.where.regions.length) out.push(`${at}.where: trip mode with no regions (R1)`);
  if (d.nights === null) out.push(`${at}.nights: a template draft has the trip's nights (R1)`);
  if (d.origin !== null) out.push(`${at}.origin: a template draft keeps its origin in fromRef (R1)`);
  if (t.profile !== null && d.pace !== t.profile.pace) out.push(`${at}.pace: the profile's pace (R1)`);
  out.push(...planTemplateRules(t, `${at}.template`));
  return out;
}

/** A draft's rules: the inputs', the modes' (R1 to R7), the last build's, and the 16 KB cap. */
export function planDraftRules(d: PlanDraft, at = "$"): string[] {
  const out = [...planInputRules(d, at), ...planModeRules(d, at)];
  if (Date.parse(d.updatedAt) < Date.parse(d.createdAt)) out.push(`${at}.updatedAt: not before createdAt`);
  const b = d.lastBuild;
  if (b) {
    const bdays = b.days.map((x) => x.day);
    if (dupes(bdays.map(String)).length) out.push(`${at}.lastBuild.days: each day once`);
    if (d.nights !== null && bdays.some((n) => n > d.nights! + 1)) out.push(`${at}.lastBuild.days: a day of the plan`);
  }
  if (byteLength(JSON.stringify(d)) > PLAN_LIMITS.draftBytes) out.push(`${at}: a draft is at most ${PLAN_LIMITS.draftBytes} bytes`);
  return out;
}

/** The device list's rules: each draft's, unique ids, and the list's byte cap. */
export function planDraftsRules(l: PlanDrafts): string[] {
  const out = l.items.flatMap((d, i) => planDraftRules(d, `$.items[${i}]`));
  if (dupes(l.items.map((d) => d.id)).length) out.push("$.items: each draft has its own id");
  const max = PLAN_LIMITS.drafts * PLAN_LIMITS.draftBytes + PLAN_LIMITS.listOverheadBytes;
  if (byteLength(JSON.stringify(l)) > max) out.push(`$: the list is at most ${max} bytes`);
  return out;
}

/** One draft (a device item, or later an account row's `doc`): the schema, then the rules. */
export function parsePlanDraft(x: unknown): Checked<PlanDraft> {
  const r = planDraft.safeParse(x);
  if (!r.success) return { success: false, issues: issuesOf(r.error) };
  const rules = planDraftRules(r.data);
  return rules.length ? { success: false, issues: rules } : { success: true, data: r.data };
}

/** The device list: the schema, then the rules. */
export function parsePlanDrafts(x: unknown): Checked<PlanDrafts> {
  const r = planDrafts.safeParse(x);
  if (!r.success) return { success: false, issues: issuesOf(r.error) };
  const rules = planDraftsRules(r.data);
  return rules.length ? { success: false, issues: rules } : { success: true, data: r.data };
}

/** The version a value names under `schema`, for one of the two names (`plan-draft/2` gives 2), else null. */
function versionOf(x: unknown, base: "plan-draft" | "plan-drafts"): number | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const s = (x as { schema?: unknown }).schema;
  const m = typeof s === "string" ? new RegExp(`^${base}/(\\d+)$`).exec(s) : null;
  return m ? Number(m[1]) : null;
}

export type ReadPlanDrafts =
  | { ok: true; list: PlanDrafts; /** nothing was stored */ fresh: boolean }
  | { ok: false; reason: "corrupt" | "newer" | "invalid"; issues: string[] };

/**
 * Reads the stored text of the device list. Absent: an empty list. Not JSON: `corrupt`. The list or any draft in it names a later
 * version: `newer`. Anything else that fails: `invalid`. A failed read never writes: the caller shows the error state and leaves the
 * value untouched (as copies/1). Issues name a path and a rule, never a value.
 */
export function readPlanDrafts(raw: string | null): ReadPlanDrafts {
  if (raw === null) return { ok: true, list: emptyPlanDrafts(), fresh: true };
  let x: unknown;
  try {
    x = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt", issues: ["$: not JSON"] };
  }
  const v = versionOf(x, "plan-drafts");
  if (v !== null && v > 1) return { ok: false, reason: "newer", issues: [`$.schema: ${PLAN_DRAFTS_SCHEMA.replace(/\d+$/, String(v))}`] };
  const items = x && typeof x === "object" && Array.isArray((x as { items?: unknown }).items) ? ((x as { items: unknown[] }).items) : [];
  const newer = items.findIndex((it) => (versionOf(it, "plan-draft") ?? 0) > 1);
  if (newer >= 0) return { ok: false, reason: "newer", issues: [`$.items[${newer}].schema: a later plan-draft`] };
  const r = parsePlanDrafts(x);
  return r.success ? { ok: true, list: r.data, fresh: false } : { ok: false, reason: "invalid", issues: r.issues };
}
