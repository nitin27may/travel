// relevance/1 (docs/v2/research/relevance.md section 2.1): is a place worth the journey, and for which kind of trip.
//
// A separate sidecar from suitability/1 (decision R1). It imports the source-row shape and shares the value wrapper's
// shape; the only difference is one extra basis, `editorial`. Subset rule (meta.ts): no refine, transform or lazy
// schemas, so the whole file exports to JSON Schema. Cross-field rules live in core/src/validate/relevance.ts.
//
// Derived fields (draw_suggested, role, fits, badge, substitutes, detour, far_pointer) are never part of this record:
// the validator reports them as E_REL_TYPED_DERIVED and core/src/relevance/derive.ts computes them.
import { z } from "zod";
import * as E from "./enums.ts";
import { sourceRow } from "./suitability.ts";
import { date, json, pattern, table, text } from "./meta.ts";

const isoDate = z.iso.date();
const srcIds = z.array(z.string());
const mmdd = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const qid = z.string().regex(/^Q[1-9]\d*$/);

export const REL_BASIS = [...E.SUIT_BASIS, "editorial"] as const;
export const DRAW_TIER = ["local", "regional", "national", "world"] as const;
export const STANDING = ["top", "good", "ordinary"] as const;
export const DISTINCTION = ["unique", "rare", "common"] as const;
export const WEATHER = ["indoor", "any_weather", "better_clear", "clear_only"] as const;
export const EASY_PAYOFF = ["full", "most", "part", "none"] as const;
export const ACCESS_COST = [
  "permit_lottery", "timed_entry", "day_permit", "daily_cap", "shuttle_only",
  "toll_reservation", "lift_only", "boat_or_ferry", "high_clearance_4wd",
  "long_walk_in", "seasonal_road",
] as const;
export const DESIGNATION_TYPE = [
  "unesco_whs", "national_park", "provincial_or_state_park", "conservation_area",
  "natural_monument", "heritage_listed", "dark_sky", "ramsar", "official_highlight", "signature_experience",
] as const;

/** The value wrapper of suitability 1.1 with the relevance basis set. */
export function rval<T extends z.ZodType>(inner: T) {
  const basis = z.enum(REL_BASIS);
  return z.strictObject({
    v: inner.nullable(),
    state: z.enum(E.SUIT_STATE),
    basis: basis.nullable(),
    src: srcIds,
    read: isoDate.optional(),
    quote: z.string().max(300).optional(),
    note: z.string().optional(),
    tried: z.array(z.string()).optional(),
    on: isoDate.optional(),
    applies_to: z.string().regex(/^\d{4}$/).optional(),
    conflicts: z.array(z.strictObject({ v: inner, basis, src: srcIds, note: z.string().optional() })).optional(),
  });
}

const designation = z.strictObject({
  type: z.enum(DESIGNATION_TYPE),
  name: z.string().min(1),
  id: z.string().optional(),
  scope: z.enum(["own", "parent"]),
  /** confirmed QID of a parent area, so the tool can read its fame (the Narrows inside Zion) */
  wikidata: qid.optional(),
});

const mention = z.strictObject({
  publisher: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  list: z.enum(["top_list", "listed"]),
  /** how far the publisher reaches; only a national or global top list raises the draw floor (3.1 rule 4) */
  reach: z.enum(["regional", "national", "global"]).optional(),
});

const accessItem = z.strictObject({
  type: z.enum(ACCESS_COST),
  note: z.string().optional(),
  book_ahead_days: z.number().int().min(0).optional(),
  /** boat_or_ferry with limited sailings, or a lift with a capacity cap: counts as hard */
  capped: z.boolean().optional(),
});

export const relRecord = z.strictObject({
  ref: z.string().min(1),
  kind: z.string().min(1),
  subkind: z.string().min(1).optional(),
  wikidata: rval(qid),
  /** CF: the ref of the record that is the same physical place (a cruise and its lake); the place keeps the anchor (3.5) */
  same_place_as: z.string().min(1).optional(),
  class_key: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  // judged
  draw: rval(z.enum(DRAW_TIER)),
  draw_peak: rval(z.strictObject({ tier: z.enum(DRAW_TIER), from: mmdd, to: mmdd, why: z.string().min(1) })).optional(),
  standing: rval(z.enum(STANDING)),
  standing_scope: z.string().min(1),
  distinction: rval(z.enum(DISTINCTION)),
  unique_because: z.string().max(120).optional(),
  easy_payoff: rval(z.enum(EASY_PAYOFF)),
  easy_way: z.string().min(1).optional(),
  weather: rval(z.enum(WEATHER)),
  why: z.string().min(1).max(120),
  access_cost: rval(z.array(accessItem)),
  // evidence
  signals: z.strictObject({
    designations: rval(z.array(designation)),
    editorial: rval(z.array(mention).max(3)),
    volume: rval(z.strictObject({
      count: z.number().min(0),
      unit: z.enum(["visits_per_year", "cap_per_day"]),
      scope: z.enum(["place", "park"]),
      year: z.number().int().min(1900).max(2100),
    })).optional(),
  }),
  /** hand-picked "Nearby, worth adding": always qualifies and ranks first in derive's pair_with (3.2) */
  pairs_with: z.array(z.strictObject({ ref: z.string().min(1), reason: z.string().min(1).max(160), src: z.string().min(1).optional() })).max(3).optional(),
  /** a hand-picked Plan B: wins over the derived substitute, with the reason it is better (3.45) */
  plan_b_pick: z.strictObject({ ref: z.string().min(1), reason: z.string().min(1).max(160), src: z.string().min(1).optional() }).optional(),
  override: z.strictObject({
    field: z.enum(["role", "fit"]),
    value: z.string().min(1),
    reason: z.string().min(1),
    by: z.string().min(1),
    on: isoDate,
  }).optional(),
});

export const RELEVANCE_SCHEMA_ID = "relevance/1";

export const relevance = table("relevance", {
  schema: pattern(/^relevance\/1$/),
  trip: text({ pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/ }),
  lane: text({ min: 1 }),
  researched: date(),
  sources: json(z.array(sourceRow)),
  records: json(z.array(relRecord)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Relevance" } });

export type DrawTier = (typeof DRAW_TIER)[number];
export type Standing = (typeof STANDING)[number];
export type Distinction = (typeof DISTINCTION)[number];
export type Weather = (typeof WEATHER)[number];
export type EasyPayoff = (typeof EASY_PAYOFF)[number];
export type AccessCostType = (typeof ACCESS_COST)[number];
export type RelevanceRecord = z.infer<typeof relRecord>;
export type RelDesignation = z.infer<typeof designation>;
export type RelMention = z.infer<typeof mention>;
export type RelAccessItem = z.infer<typeof accessItem>;
export interface RelevanceDoc {
  schema: "relevance/1";
  trip: string;
  lane: string;
  researched: string;
  sources: z.infer<typeof sourceRow>[];
  records: RelevanceRecord[];
}
