// capture/1 (research/method/capture-contract.md sections 2 and 3): the identity, layer and relations of a place, route, offer
// or event, plus the base-contract values no suitability or relevance field holds (hours, season, price, window, links, photos).
//
// A third sidecar beside suitability/1 and relevance/1 (they stay the homes of their groups). It joins them by `ref`. The value
// wrapper is the suitability `val`, so every value carries its basis, sources and the date it was read.
// Subset rule (meta.ts): no refine, transform or lazy schemas. Cross-field rules (type exists, layer is allowed for the type,
// relation targets resolve, derived relations not stored, link-only kinds) live in core/src/validate/capture.ts.
import { z } from "zod";
import * as E from "../enums.ts";
import { sourceRow, val } from "../suitability.ts";
import { date, json, pattern, table, text } from "../meta.ts";
import { TYPE_ID_RE } from "./typesFile.ts";
import { GEONAMES_ID_RE, nearTownValue } from "./points.ts";
import { rowMetaSlot } from "../rowMeta.ts";

/** The internal note on a record (owner Q173): a planning remark or a lead, never served, never exported (PRIVATE_KEYS). */
export const NOTES_PRIVATE_MAX = 1000;

const mmdd = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const int = z.number().int();
const ref = z.string().min(1);

/** K section 9: opening hours. `always_open` stands in for periods; last_* are the times that strand people. */
export const hours = z.strictObject({
  tz: z.string().min(1),
  always_open: z.boolean().optional(),
  periods: z.array(z.strictObject({ days: z.array(int.min(1).max(7)), open: hhmm, close: hhmm, from: mmdd.optional(), to: mmdd.optional() })).optional(),
  closed_days: z.array(int.min(1).max(7)).optional(),
  breaks: z.array(z.strictObject({ days: z.array(int.min(1).max(7)), from: hhmm, to: hhmm })).optional(),
  closures: z.array(z.strictObject({ from: z.string().min(1), to: z.string().min(1), why: z.string().optional() })).optional(),
  last_entry: hhmm.optional(),
  last_up: hhmm.optional(),
  last_down: hhmm.optional(),
});

/** Operating season rows (D7): when it runs, not when you can get there (that is `access_season`). */
export const seasonRow = z.strictObject({
  from: mmdd,
  to: mmdd,
  status: z.enum(["open", "limited", "closed"]),
  applies_to: z.string().regex(/^\d{4}$/).optional(),
  note: z.string().optional(),
});

export const bestWindowRow = z.strictObject({
  from: mmdd,
  to: mmdd,
  why: z.enum(["foliage", "flow", "larch", "bloom", "wildlife", "snow", "water_temp"]),
});

export const bestTimeRow = z.strictObject({
  slot: z.enum(["sunrise", "golden_am", "morning", "midday", "afternoon", "golden_pm", "sunset", "night"]),
  why: z.enum(["light", "crowds", "wildlife", "heat", "tide"]),
  months: z.array(int.min(1).max(12)).optional(),
});

export const priceRow = z.strictObject({
  amount: z.number().min(0),
  currency: z.string().regex(/^[A-Z]{3}$/),
  per: z.enum(E.PRICE_PER_V2),
  age_from: int.min(0).optional(),
  age_to: int.min(0).optional(),
  applies_to: z.string().regex(/^\d{4}$/).optional(),
  note: z.string().optional(),
});

/** D8: one booking window shape for access and experience offers. */
export const windowSpec = z.strictObject({
  rule: z.enum(["fixed_date", "rolling", "monthly_release", "lottery", "same_day", "anytime", "on_arrival"]),
  days_before: int.min(0).optional(),
  opens_time: hhmm.optional(),
  tz: z.string().min(1).optional(),
  sellout: z.strictObject({ kind: z.enum(["never", "minutes", "days", "weeks", "months", "unknown"]), lead: int.min(0).optional() }).optional(),
  fallback: z.string().optional(),
});

// ---- RIS-H homes (docs/v2/features/catalogue-intake-and-storage.md 5.3; DATA-PLAN row 24) ----------------------------------------

/** A booking page: an http(s) URL. A link-only platform (OTA, reseller) is refused by the validator (E_CAP_LINK_ONLY). */
export const BOOK_URL_RE = /^https?:\/\/[^\s]+$/;

/**
 * A closure date: a calendar date or year-month or year (a one-off closure, a decommissioning year), or MM-DD (a closure that
 * recurs every year, as in `hours.closures`). Both ends of one row use the same form; the validator checks the order.
 */
export const CLOSURE_DATE_RE = /^(\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?|(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))$/;

/**
 * One closure or restriction the land manager or operator publishes (capture contract 3.4 "Safety"; freshness class `closures`).
 * `to` absent: open-ended (closed until further notice, or decommissioned). `status: limited` is a restriction, not a closure
 * (group minimums in larch season, one side of a loop shut).
 */
export const closureRow = z.strictObject({
  from: z.string().regex(CLOSURE_DATE_RE),
  to: z.string().regex(CLOSURE_DATE_RE).optional(),
  status: z.enum(["closed", "limited"]),
  why: z.string().min(1).max(200),
});

/** Check-in and check-out of a lodging offer, local times (freshness class `hours`). */
export const checkInOut = z.strictObject({
  check_in: hhmm,
  check_out: hhmm,
  /** the latest check-in when the property names one (a front desk that closes) */
  check_in_until: hhmm.optional(),
  note: z.string().min(1).max(200).optional(),
});

/**
 * When a car park is usually full (freshness class `booking-windows`): a local time, or `sunrise` when the source says "before
 * sunrise". `days` and `months` narrow it when the source does.
 */
export const fillsBy = z.strictObject({
  by: z.union([hhmm, z.literal("sunrise")]),
  days: z.enum(["every_day", "weekends", "holidays"]).optional(),
  months: z.array(int.min(1).max(12)).min(1).optional(),
  note: z.string().min(1).max(200).optional(),
});

/** The nearest food shop of a base, in our own words (a name and its hours, or "none in town; Canmore 25 min"). */
export const GROCERIES_MAX = 200;

export const entityLink = z.strictObject({
  kind: z.enum(E.CAP_LINK_KIND),
  url: z.string().min(1).optional(),
  state: z.enum(["filled", "searched_none", "found_in_search"]),
  query: z.string().optional(),
  on: z.iso.date().optional(),
  src: z.array(z.string()).optional(),
});

export const photo = z.strictObject({
  file: z.string().min(1),
  licence: z.string().min(1),
  author: z.string().min(1),
  attribution: z.string().min(1),
  source_url: z.string().min(1),
  width: int.min(1),
  height: int.min(1),
});

export const passesRel = z.strictObject({ ref, at_km: z.number().min(0).optional() });
export const onRel = z.strictObject({ ref, from_km: z.number().min(0).optional(), to_km: z.number().min(0).optional() });

/** Where a record came from when the migration cut it out of another (SP1 to SP3). */
export const origin = z.strictObject({ from: ref, reason: z.string().min(1) });

export const capRecord = z.strictObject({
  ref,
  /** a type id of data/vocab/types.json */
  type: z.string().regex(TYPE_ID_RE),
  layer: z.enum(E.CAP_LAYER),
  name: z.string().min(1).optional(),
  names: z.record(z.string(), z.string()).optional(),
  /** refs that used to name this record; they keep resolving (SP3) */
  aliases: z.array(ref).optional(),
  /** the offer class when it differs from the type's */
  offer_class: z.enum(E.OFFER_CLASS).optional(),
  origin: origin.optional(),
  /**
   * A route may carry draw and class (relevance) only when the route is itself the experience: a circuit, a scenic drive, a ride.
   * Otherwise they belong to the place the visitor comes to see. E_CAP_DRAW_LAYER.
   */
  route_is_attraction: z.boolean().optional(),
  attraction_reason: z.string().min(1).optional(),
  area_id: z.string().min(1).optional(),
  osm_ref: z.string().regex(/^(node|way|relation)\/\d+$/).optional(),
  // placement (3.7, META-0): the nearest town is derived (META-2) and may be overridden by the town the operator names
  geonames_id: val(z.string().regex(GEONAMES_ID_RE)).optional(),
  near_town: val(nearTownValue).optional(),
  near_town_km: val(z.number().min(0)).optional(),
  // relations (2.5; the rules are RELATION_RULES in relations.ts, entity-graph 5.1). Every inverse is derived and rejected (E_CAP_REL_DERIVED)
  reaches: z.array(ref).optional(),
  passes: z.array(passesRel).optional(),
  part_of: z.array(ref).optional(),
  starts_at: z.array(ref).optional(),
  ends_at: z.array(ref).optional(),
  on: z.array(onRel).optional(),
  at: z.array(ref).optional(),
  run_by: ref.optional(),
  parks_for: z.array(ref).optional(),
  serves: z.array(ref).optional(),
  combo_with: z.array(ref).optional(),
  alternative_to: z.array(ref).optional(),
  /** a route or offer of the same layer and category; the target is the primary (one level, E_CAP_VARIANT) */
  variant_of: ref.optional(),
  /** a requirement (access.pass offer) names the passes or lodging offers that satisfy it (EG-C, from protected-area-entry C4) */
  covered_by: z.array(ref).optional(),
  /** a tour, ticket or lodging offer names the requirement offers it includes (EG-C) */
  includes: z.array(ref).optional(),
  /** a protected area names the locations-store areas that are the park: every record with that area_id is a member (EG-C, C4) */
  covers_areas: z.array(z.string().min(1)).optional(),
  // base-contract values, each with its provenance (Val)
  season: val(z.array(seasonRow)).optional(),
  best_window: val(z.array(bestWindowRow)).optional(),
  best_time: val(z.array(bestTimeRow)).optional(),
  hours: val(hours).optional(),
  /** door-to-door minutes of an offer, [low, high] (RIS-H); low <= high and activity_min within it (validator) */
  duration_min: val(z.tuple([int.min(1), int.min(1)])).optional(),
  /** minutes on the activity itself (on the water, on the glacier), [low, high] (RIS-H) */
  activity_min: val(z.tuple([int.min(1), int.min(1)])).optional(),
  check_in_out: val(checkInOut).optional(),
  price: val(z.array(priceRow)).optional(),
  window: val(windowSpec).optional(),
  book_url: val(z.string().regex(BOOK_URL_RE)).optional(),
  fills_by: val(fillsBy).optional(),
  /** a value lists at least one row; "no closures published" is state none_stated or searched_none, never an empty list (M1) */
  closures: val(z.array(closureRow).min(1)).optional(),
  groceries: val(z.string().min(1).max(GROCERIES_MAX)).optional(),
  links: z.array(entityLink).optional(),
  photos: z.array(photo).optional(),
  /** owner and researchers only (spec 3.1); the privacy detector fails any served body that holds it */
  notes_private: z.string().min(1).max(NOTES_PRIVATE_MAX).optional(),
  /** RowMeta v1 (core/src/schema/rowMeta.ts): about the row, internal, never a displayed value */
  meta: rowMetaSlot.optional(),
});

export const CAPTURE_SCHEMA_ID = "capture/1";

export const capture = table("capture", {
  schema: pattern(/^capture\/1$/),
  trip: text({ pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/ }),
  lane: text({ min: 1 }),
  researched: date(),
  agent: text({ min: 1 }),
  model: text({ min: 1 }),
  sources: json(z.array(sourceRow)),
  records: json(z.array(capRecord)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Capture" } });

/** An operator is a record, not a string (2.4 rule 4): one operator runs several offers and its terms are one source for all. */
export const operator = z.strictObject({
  ref: z.string().regex(/^operator\/[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  url: z.string().min(1),
  terms_url: z.string().min(1).optional(),
  waiver_url: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  licence: z.string().min(1).optional(),
  /** where the name and url were taken from: the publisher and page of a source row of a lane file */
  derived_from: z.array(z.strictObject({ file: z.string().min(1), src: z.string().min(1), publisher: z.string().min(1), url: z.string().min(1) })).optional(),
  meta: rowMetaSlot.optional(),
});

export const capture_operators = table("capture_operators", {
  schema: pattern(/^capture-operators\/1$/),
  updated: date(),
  operators: json(z.array(operator)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Capture operators" } });

/**
 * 9.7: an official re-read replaces a pre-migration value as the shown value. The lane file is never edited; this file holds the
 * replacement beside the original (`was`), with who, when and the source. `v` is checked against the Val it replaces by the validator.
 */
export const SUPERSEDE_BASES = ["official_rule", "official_grade", "official_info", "operator_rule", "operator_info"] as const;
export const supersedeEntry = z.strictObject({
  id: z.string().regex(/^sup-\d{4,}$/),
  layer: z.enum(["suitability", "relevance", "capture"]),
  ref,
  /** dot path into the record, as the migration ledger walks it */
  path: z.string().min(1),
  /** the stored `v`, exactly: the check that the override is not stale */
  was: z.unknown(),
  value: z.strictObject({
    v: z.unknown(),
    state: z.enum(E.SUIT_STATE),
    basis: z.string().min(1),
    src: z.array(z.string().min(1)),
    read: z.iso.date().optional(),
    quote: z.string().max(300).optional(),
    note: z.string().optional(),
    applies_to: z.string().regex(/^\d{4}$/).optional(),
  }),
  reason: z.string().min(1),
  by: z.string().min(1),
  on: z.iso.date(),
});

export const capture_supersedes = table("capture_supersedes", {
  schema: pattern(/^capture-supersedes\/1$/),
  sources: json(z.array(sourceRow)),
  entries: json(z.array(supersedeEntry)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Capture supersedes" } });

/** 9.6: the record every crawl or API run writes, so the next pass starts where this one stopped. */
export const captureRun = z.strictObject({
  schema: z.literal("capture-run/1"),
  run: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  started: z.iso.date(),
  agent: z.string().min(1),
  model: z.string().min(1),
  scope: z.strictObject({ types: z.array(z.string().regex(TYPE_ID_RE)).optional(), refs: z.array(ref).optional() }),
  hosts: z.array(z.strictObject({
    host: z.string().min(1),
    requests: int.min(0),
    robots: z.enum(["allowed", "forbidden", "unknown", "none"]),
    terms: z.enum(E.AUTOMATED),
    status: z.enum(["ok", "partial", "blocked"]),
  })),
  results: z.array(z.strictObject({
    ref,
    field: z.string().min(1),
    outcome: z.enum(E.RUN_OUTCOME),
    src: z.union([z.string(), z.array(z.string())]).optional(),
    tried: z.array(z.string()).optional(),
    host: z.string().optional(),
    reason: z.string().optional(),
    /** outcome `ask` (spec R-133): who the question goes to, where they take it, and the question; loaded as research_gap state ask */
    to: z.string().min(1).optional(),
    contact_url: z.string().min(1).optional(),
    question: z.string().min(1).max(500).optional(),
  })),
});

export const capture_run = table("capture_run", {
  schema: pattern(/^capture-run\/1$/),
  run: text({ pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/ }),
  started: date(),
  agent: text({ min: 1 }),
  model: text({ min: 1 }),
  scope: json(captureRun.shape.scope),
  hosts: json(captureRun.shape.hosts),
  results: json(captureRun.shape.results),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Capture run" } });

export type CaptureRecord = z.infer<typeof capRecord>;
export type CaptureOperator = z.infer<typeof operator>;
export type CaptureRun = z.infer<typeof captureRun>;
export type SupersedeEntry = z.infer<typeof supersedeEntry>;
export interface SupersedesFile { schema: "capture-supersedes/1"; sources: z.infer<typeof sourceRow>[]; entries: SupersedeEntry[] }
export interface CaptureDoc { schema: "capture/1"; trip: string; lane: string; researched: string; agent: string; model: string; sources: z.infer<typeof sourceRow>[]; records: CaptureRecord[] }
export interface OperatorsFile { schema: "capture-operators/1"; updated: string; operators: CaptureOperator[] }
