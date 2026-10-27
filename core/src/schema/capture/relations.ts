// The entity graph's relation contract (docs/v2/features/entity-graph.md 5 and 6.2; task EG-C): the one table that says, for every
// link a capture record can store, which records may hold it, which records it may point at, how many, which side stores it, the name
// of its derived reverse, and whether requirements and inherited facts follow it. The validator (core/src/validate/capture.ts) and the
// derived inverses of loadWorld (core/src/capture/records.ts) read it; the graph index (EG-I, core/src/graph/**) reads it and
// CHAIN_RULES. Nothing else may hold a relation rule.
//
// Rules of the table:
// - A link is stored once, on the side with the smaller fan-out ("many side": a member names its park, a fee names the pass that
//   covers it, a tour names the fee it includes). The reverse is derived and refused if typed (E_CAP_REL_DERIVED).
// - The ref form carries no meaning (4.4 rule 2): `part/X#y` is not "y is part of X". Containment is only `part_of`.
// - Symmetric relations are stored on either side, once (E_CAP_REL_SYM when both sides hold the pair).
// - `covers_areas` is a field of a protected area that names locations-store areas, not records: it is a rule here (it makes members)
//   but not a relation kind (CAP_RELATION), so the database never holds it as a relation row (EG-M).
// - Not here, because they are not stored on a capture record: `pairs_with` (relevance), `aliases` (identity), `near` (computed by
//   the store from points), trip use (the trip's own data).
import type { CAP_LAYER, CAP_RELATION, OFFER_CLASS } from "../enums.ts";

export type Layer = (typeof CAP_LAYER)[number];
export type OfferClass = (typeof OFFER_CLASS)[number];
export type StoredRelation = (typeof CAP_RELATION)[number];
/** Every key of RELATION_RULES: the stored relations plus the `covers_areas` field. */
export type RuleKey = StoredRelation | "covers_areas";

/**
 * One end of a relation. Any-of semantics across a list of endpoints. `types` are type-id prefixes (a prefix matches itself and
 * every id below it); `classes` are offer classes (the record's `offer_class`, else its type's). `from` narrows a target endpoint to
 * sources of these layers (`part_of` may point at a route only from a route).
 */
export interface Endpoint {
  layer: Layer | "operator" | "area";
  types?: readonly string[];
  classes?: readonly OfferClass[];
  from?: readonly Layer[];
}

/** A cardinality limit per source record; `layer` narrows it to sources of one layer. */
export interface MaxRule {
  n: number;
  layer?: Layer;
  code: "W_CAP_REL_PARENTS" | "W_CAP_REL_CARD" | "E_CAP_REL_CARD";
}

export interface RelationRule {
  key: RuleKey;
  meaning: string;
  /** how the value is written on the record: a ref array, one ref, a `{ref, at_km}` or `{ref, from_km, to_km}` array, area ids */
  shape: "refs" | "ref" | "refs_km" | "areas";
  source: readonly Endpoint[];
  /** "same" means the target is checked by `same` (variant_of), not by endpoints */
  target: readonly Endpoint[] | "same";
  /** the target must share the source's layer (and category): alternative_to, variant_of */
  same?: { layer: true; category?: true };
  /** variant_of: the target is a primary (has no variant_of itself); E_CAP_VARIANT */
  oneLevel?: true;
  /** loops are refused (E_CAP_REL_CYCLE); `part_of` loops count `covers_areas` membership */
  acyclic?: true;
  /** smallest count a source of the layers in `source` should hold; informational (placement and gap reports check presence) */
  min: number;
  max: readonly MaxRule[];
  /** the side that stores it: the source record, or either side once (symmetric) */
  stored: "source" | "either";
  /** the derived reverse; null for a symmetric relation (its reverse has its own name) */
  inverse: string | null;
  symmetric: boolean;
  /** followed when the chain of a record is computed for requirements and inherited facts (section 7) */
  chain: boolean;
  status: "exists" | "new" | "widened";
}

const PLACE: Endpoint = { layer: "place" };
const ROUTE: Endpoint = { layer: "route" };
const OFFER: Endpoint = { layer: "offer" };
const EVENT: Endpoint = { layer: "event" };
const ANY: readonly Endpoint[] = [PLACE, ROUTE, OFFER, EVENT];

/** Section 5.1 of the entity-graph spec, as code. Order is the spec's order. */
export const RELATION_RULES: readonly RelationRule[] = [
  {
    key: "part_of", meaning: "located inside a container (target a place), or a stage of a route (target a route)", shape: "refs",
    source: [PLACE, ROUTE, EVENT], target: [PLACE, { layer: "route", from: ["route"] }], acyclic: true,
    min: 0, max: [{ n: 2, code: "W_CAP_REL_PARENTS" }], stored: "source", inverse: "members", symmetric: false, chain: true, status: "widened",
  },
  {
    key: "covers_areas", meaning: "the locations-store areas that are this protected area: every record with that area_id is a member", shape: "areas",
    source: [{ layer: "place", types: ["nature.protected"] }], target: [{ layer: "area" }],
    min: 0, max: [], stored: "source", inverse: "members", symmetric: false, chain: true, status: "new",
  },
  {
    key: "reaches", meaning: "the payoff of a route; the first is the primary", shape: "refs",
    source: [ROUTE], target: [PLACE], min: 1, max: [], stored: "source", inverse: "reached_by", symmetric: false, chain: true, status: "exists",
  },
  {
    key: "passes", meaning: "on the way (with at_km)", shape: "refs_km",
    source: [ROUTE], target: [PLACE], min: 0, max: [], stored: "source", inverse: "passed_by", symmetric: false, chain: false, status: "exists",
  },
  {
    key: "starts_at", meaning: "where a route starts or an offer meets", shape: "refs",
    source: [ROUTE, OFFER], target: [PLACE], min: 0, max: [{ n: 1, layer: "route", code: "W_CAP_REL_CARD" }],
    stored: "source", inverse: "starts_here", symmetric: false, chain: true, status: "widened",
  },
  {
    key: "ends_at", meaning: "where a one-way route or a stage ends", shape: "refs",
    source: [ROUTE], target: [PLACE], min: 0, max: [{ n: 1, code: "E_CAP_REL_CARD" }], stored: "source", inverse: "ends_here", symmetric: false, chain: true, status: "exists",
  },
  {
    key: "at", meaning: "where an offer is sold or happens; the first is the primary", shape: "refs",
    source: [OFFER], target: [PLACE], min: 1, max: [], stored: "source", inverse: "offers_at", symmetric: false, chain: true, status: "exists",
  },
  {
    key: "on", meaning: "the route an offer runs on (with from_km, to_km)", shape: "refs_km",
    source: [OFFER], target: [ROUTE], min: 0, max: [], stored: "source", inverse: "offers_on", symmetric: false, chain: true, status: "widened",
  },
  {
    key: "parks_for", meaning: "an access point (parking) for a place or route", shape: "refs",
    source: [{ layer: "place", types: ["access"] }], target: [PLACE, ROUTE], min: 1, max: [], stored: "source", inverse: "access_points", symmetric: false, chain: true, status: "widened",
  },
  {
    key: "serves", meaning: "an access point (a stop, a dock) for a place or route", shape: "refs",
    source: [{ layer: "place", types: ["access"] }], target: [PLACE, ROUTE], min: 1, max: [], stored: "source", inverse: "access_points", symmetric: false, chain: true, status: "widened",
  },
  {
    key: "run_by", meaning: "who runs or manages it (display only)", shape: "ref",
    source: [OFFER, { layer: "place", types: ["nature.protected", "stay", "access"] }], target: [{ layer: "operator" }],
    min: 0, max: [], stored: "source", inverse: "operator_of", symmetric: false, chain: false, status: "widened",
  },
  {
    key: "covered_by", meaning: "a pass or booking that satisfies this requirement", shape: "refs",
    source: [{ layer: "offer", types: ["access.pass"] }],
    target: [{ layer: "offer", types: ["access.pass.park_pass", "access.pass.vehicle_permit"] }, { layer: "offer", classes: ["lodging"] }],
    min: 0, max: [], stored: "source", inverse: "covers", symmetric: false, chain: false, status: "new",
  },
  {
    key: "includes", meaning: "a product that includes a requirement (a tour with park admission)", shape: "refs",
    source: [{ layer: "offer", classes: ["experience", "ticket", "lodging"] }], target: [{ layer: "offer", types: ["access.pass"] }],
    min: 0, max: [], stored: "source", inverse: "included_in", symmetric: false, chain: false, status: "new",
  },
  {
    key: "variant_of", meaning: "another version of the same route or product; one level, the target is the primary", shape: "ref",
    source: [ROUTE, OFFER], target: "same", same: { layer: true, category: true }, oneLevel: true, acyclic: true,
    min: 0, max: [], stored: "source", inverse: "variants", symmetric: false, chain: true, status: "widened",
  },
  {
    key: "alternative_to", meaning: "one or the other: a requirement that can replace another, a Plan B route", shape: "refs",
    source: [OFFER, ROUTE, PLACE], target: [OFFER, ROUTE, PLACE], same: { layer: true },
    min: 0, max: [], stored: "either", inverse: null, symmetric: true, chain: false, status: "exists",
  },
  {
    key: "combo_with", meaning: "goes well done together", shape: "refs",
    source: ANY, target: ANY, min: 0, max: [], stored: "either", inverse: null, symmetric: true, chain: false, status: "exists",
  },
];

export const RULE_BY_KEY: ReadonlyMap<RuleKey, RelationRule> = new Map(RELATION_RULES.map((r) => [r.key, r]));
export const RULE_KEYS: readonly RuleKey[] = RELATION_RULES.map((r) => r.key);

/**
 * Every derived name a record may never store (E_CAP_REL_DERIVED): the inverses of the table, plus `members_all` (the closure) and
 * `requirements` (what `requirementsOf` computes, section 7.2). CAP_RELATION_DERIVED in enums.ts equals this list (a test pins it).
 */
export const DERIVED_NAMES: readonly string[] = [
  ...new Set([...RELATION_RULES.flatMap((r) => (r.inverse ? [r.inverse] : [])), "members_all", "requirements"]),
];

/** The inverse names of loadWorld's `Incoming` before EG-C, kept as aliases until their readers move (spec 15). */
export const LEGACY_INCOMING_ALIASES: Readonly<Record<string, string>> = {
  at: "offers_at",
  on: "offers_on",
  children: "members",
};

/** One step of a chain: follow `rel` from x and take the chain of each target (`recurse`), or only the target itself. */
export interface ChainStep { rel: RuleKey; recurse: boolean }
/** Which links the chain of a record follows, by the record's layer (and type for access places), nearest first (6.2). */
export interface ChainRule { layer: Layer; types?: readonly string[]; follow: readonly ChainStep[]; note: string }

/**
 * Section 6.2. chain(x) is x, then the steps in order, each target's own chain when `recurse`; duplicates are dropped keeping the
 * first. Containment (`part_of`) falls back to `covers_areas` membership when the record has no explicit `part_of` (6.1). The first
 * rule that matches a record wins, so the access-place row sits before the place row. Computed by EG-I (core/src/graph/**).
 */
export const CHAIN_RULES: readonly ChainRule[] = [
  { layer: "place", types: ["access"], follow: [{ rel: "part_of", recurse: true }, { rel: "serves", recurse: true }, { rel: "parks_for", recurse: true }], note: "an access place: its containers, then the chain of every place or route it serves or parks for" },
  { layer: "place", follow: [{ rel: "part_of", recurse: true }], note: "a place: its containers up part_of (or area membership), transitively" },
  { layer: "route", follow: [{ rel: "part_of", recurse: true }, { rel: "starts_at", recurse: true }, { rel: "reaches", recurse: true }, { rel: "ends_at", recurse: true }, { rel: "variant_of", recurse: true }], note: "a route: its containers (a stage: the whole route), its start, its payoff, its end, and for a variant the primary's chain" },
  { layer: "offer", follow: [{ rel: "at", recurse: true }, { rel: "on", recurse: true }, { rel: "starts_at", recurse: true }], note: "an offer: the chain of each place it is at, each route it is on, and its meeting place" },
  { layer: "event", follow: [{ rel: "part_of", recurse: true }], note: "an event: the chain of what it is part of" },
];

// ---- helpers the validator and loadWorld share ---------------------------------------------------------------------------------------

/** Whether type id `type` is `prefix` or below it. */
export const typeUnder = (type: string, prefix: string): boolean => type === prefix || type.startsWith(prefix + ".");

/** The refs (or area ids) a record holds under a rule key, whatever the shape. */
export function targetsOf(rec: Record<string, unknown>, key: string): string[] {
  const v = rec[key];
  if (v === undefined || v === null) return [];
  if (typeof v === "string") return [v];
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : typeof x === "object" && x !== null && typeof (x as { ref?: unknown }).ref === "string" ? (x as { ref: string }).ref : ""))
    .filter((x) => x !== "");
}

export interface NodeFacts { layer: Layer; type: string; offerClass: OfferClass | null }

/** Whether a record matches one endpoint (the `from` narrowing is checked by the caller, which knows the source). */
export function matchesEndpoint(e: Endpoint, n: NodeFacts): boolean {
  if (e.layer !== n.layer) return false;
  if (e.types && !e.types.some((p) => typeUnder(n.type, p))) return false;
  if (e.classes && !(n.offerClass && e.classes.includes(n.offerClass))) return false;
  return true;
}

/** Whether a source record may hold the relation. */
export const sourceAllowed = (rule: RelationRule, n: NodeFacts): boolean => rule.source.some((e) => matchesEndpoint(e, n));

/** Whether a target record is allowed for a source of layer `from`. Always true for `target: "same"` (checked by `same`). */
export function targetAllowed(rule: RelationRule, target: NodeFacts, from: Layer): boolean {
  if (rule.target === "same") return true;
  return rule.target.some((e) => (!e.from || e.from.includes(from)) && matchesEndpoint(e, target));
}

/** Plain words for an endpoint list, for messages: "a place, or a route (from a route)". */
export function describeEndpoints(list: readonly Endpoint[] | "same"): string {
  if (list === "same") return "a record of the same layer and category";
  return list
    .map((e) => {
      const what = e.layer === "area" ? "a locations-store area" : e.layer === "operator" ? "an operator" : `${e.layer === "offer" || e.layer === "event" ? "an" : "a"} ${e.layer}`;
      const t = e.types ? ` of type ${e.types.join(" or ")}` : "";
      const c = e.classes ? ` of class ${e.classes.join(", ")}` : "";
      const f = e.from ? ` (from a ${e.from.join(" or ")})` : "";
      return `${what}${t}${c}${f}`;
    })
    .join(", or ");
}

/**
 * The ref grammar's one-wrapper rule (4.4 rule 3): `part/<root>#<slug>` and `offer/<root>#<product>`, where the root is a place/,
 * legacy/, trip/ or (offers) operator/ ref. null when the ref is fine, else the reason.
 */
export function nestedWrapper(ref: string): string | null {
  const m = /^(part|offer)\/(part|offer)\//.exec(ref);
  if (!m) return null;
  return `it wraps a ${m[2]}/ ref inside a ${m[1]}/ ref. One wrapper only: anchor a child of a child at the same root (part/<root>#<slug>, offer/<root>#<product>, where the root is a place/, legacy/ or trip/ ref)`;
}

/**
 * The top-level rule for protected areas (4.4 rule 4, QG1): a protected area is born in the locations store, so its ref (or one of its
 * aliases) is place/<slug>; a zone sits inside one, so it is part/<root>#<slug>. null when the record follows it, else the reason.
 */
export function protectedRefRule(type: string, refs: readonly string[]): string | null {
  if (!typeUnder(type, "nature.protected")) return null;
  if (type === "nature.protected.zone") {
    return refs.some((r) => /^part\/(place|legacy|trip)\/.+#.+/.test(r)) ? null : "a zone sits inside a protected area, so its ref is part/<park ref>#<slug> (entity-graph 4.4)";
  }
  return refs.some((r) => /^place\/[a-z0-9]+(-[a-z0-9]+)*$/.test(r)) ? null : "a protected area is a top-level record: capture it as a locations-store place first (the location skill), pin its page slug (slugs.ts build), and give it the ref place/<slug>, or that ref as an alias (entity-graph 4.4 rule 4)";
}
