// plan-draft/1: a visitor's own trip plan from the trip builder (trip-builder.md 2.4, 15.1 ISO-6; owner answers QB1 and QI1 of 27 Oct
// 2026). One draft is one document, the same on the device and later in the account table's `doc` column (TB-SY), so the sign-in
// merge copies a document verbatim. On the device the drafts sit in a list (`plan-drafts/1`, at most 10 drafts of 16 KB each) under
// the builder's own storage key, whose name lives only in the builder's own keys module (ISO-3).
//
// ISOLATION (15.1). This file is builder-owned: it imports only the public API's shared shapes (./api/common.ts, ./api/limits.ts) and
// nothing from the copy, customise or favourites envelopes, the schedule engine or the privacy module (the browser loads it). Nothing
// outside the builder's paths imports it (web/tests/plan/isolation.test.ts).
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
//   - NEVER the party: the draft names its source (`party: "device"`); the build reads the device party at build time and sends it in
//     the POST body only (2.4, 7);
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
import { z } from "zod";
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

export const planDraft = z.strictObject({
  schema: z.literal(PLAN_DRAFT_SCHEMA),
  /** a random UUID v4 made on the device (the URL's `draft` key, ISO-1); the sign-in merge is idempotent on it */
  id: z.string().regex(UUID_V4, "a lower-case UUID v4"),
  /** the visitor's own title, or null for the derived one */
  title: name.nullable(),
  where: planWhere,
  /** null until step 4 (days are pre-filled from the picks, TB3); the kind is `planKindOf(nights)` */
  nights: z.int().min(0).max(PLAN_LIMITS.nights).nullable(),
  pace: z.enum(PLAN_PACES),
  moves: z.enum(PLAN_MOVES),
  /** 1 to 12; null for no month chosen */
  month: z.int().min(1).max(12).nullable(),
  /** the party's source: the device profile, read at build time and never copied here (2.4) */
  party: z.enum(["device"]),
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

export const emptyPlanDrafts = (): PlanDrafts => ({ schema: PLAN_DRAFTS_SCHEMA, items: [] });

// ---- the rules JSON Schema cannot hold --------------------------------------------------------------------------------------------

export type Checked<T> = { success: true; data: T } | { success: false; issues: string[] };

/** UTF-8 bytes. */
export const byteLength = (s: string): number => new TextEncoder().encode(s).length;

/** zod issues as `path: rule`, never a value (a draft is the visitor's data). */
function issuesOf(e: z.ZodError): string[] {
  return e.issues.map((i) => `$${i.path.map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`)).join("")}: ${i.code}`);
}

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

/** A draft's rules: the inputs', the last build's, and the 16 KB cap. */
export function planDraftRules(d: PlanDraft, at = "$"): string[] {
  const out = planInputRules(d, at);
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
