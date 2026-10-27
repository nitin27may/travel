// The one completeness engine (capture contract 5.3). It reads the resolved contract of a record's type and answers, per property,
// whether the record has it. The suitability slice is the SAME function the suitability validator uses (suitability/level.ts
// checkRecord), given the marks of the contract; the kind-profile checks (draft, usable, complete) are the lists the generator
// writes from these marks. So a property is counted once: the suitability paths in the suitability slice, everything else here.
import type { Mark } from "../schema/capture/properties.ts";
import { homeOf, PROPERTY_BY_KEY } from "../schema/capture/properties.ts";
import { isSystemPass, typeUnder } from "../schema/capture/relations.ts";
import type { CaptureRecord } from "../schema/capture/records.ts";
import type { TypesFile } from "../schema/capture/typesFile.ts";
import type { RelevanceRecord } from "../schema/relevance.ts";
import type { SuitabilityRecord } from "../schema/suitability.ts";
import { answerOf, isOperated, loadApplicability } from "../suitability/applicability.ts";
import type { Located, Profile } from "../suitability/applicability.ts";
import { checkRecord } from "../suitability/level.ts";
import type { RecordCheck, SuitLevel } from "../suitability/level.ts";
import { canDeriveNearTown } from "./placementBlock.ts";
import { incomingOf } from "./records.ts";
import { GEOMETRY_GAP_REASON, tracksByRef, UNCONFIRMED_TRACK_COUNTS } from "./tracks.ts";
import type { World } from "./records.ts";
import { resolveNode } from "./resolve.ts";
import type { Layer, ResolvedNode } from "./resolve.ts";
import type { Trigger } from "./triggers.ts";

export type CapLevel = "stub" | "draft" | "usable_partial" | "usable" | "complete";
export type PState = "firm" | "soft" | "gap";

export interface Completeness {
  ref: string;
  type: string;
  layer: Layer;
  level: CapLevel;
  /** the suitability slice, null when the layer carries no suitability block */
  suitability: RecordCheck | null;
  /** base-group R properties no value answers */
  missingBase: string[];
  /** suitability R paths no value answers (all of them when the record has no suitability block yet) */
  missingSuitability: string[];
  missingApplicable: string[];
  soft: string[];
  /** R? properties whose condition holds and which are not answered */
  conditionalMissing: string[];
  /** R? properties whose condition the data cannot decide */
  conditionUnknown: string[];
  /** properties the contract marks N that hold a value (W_CAP_NA_FIELD) */
  naPresent: string[];
  /** why a base property is a gap when "not recorded" would mislead (geometry: a track exists but is held back) */
  gapReasons: Record<string, string>;
}

/** A synthetic suitability profile from the resolved marks of a node, so checkRecord reads the contract. */
export function locatedFromNode(node: ResolvedNode): Located | null {
  if (!node.profile) return null;
  const profile: Profile = { match: [], operated: node.operated, ext: node.ext, fields: node.suitability };
  return { name: node.profile, profile };
}

const firm = (x: unknown): PState => {
  const a = answerOf(x);
  if (a === "open" || a === "bad_exempt") return "gap";
  if (x && typeof x === "object" && "state" in (x as object)) {
    const st = (x as { state: string }).state;
    if (st === "searched_none" || st === "none_stated") return "soft";
  }
  return "firm";
};

/** The state of one base-group property on a record. */
export function readProperty(world: World, key: string, ref: string, cap: CaptureRecord, rel: RelevanceRecord | undefined): PState {
  const def = PROPERTY_BY_KEY.get(key);
  if (!def) return "gap";
  const inc = incomingOf(world, ref);
  switch (key) {
    case "name": return cap.name ? "firm" : "gap";
    case "type": return "firm";
    case "point": return world.points[ref] ? "firm" : "gap";
    case "at":
      // a system pass names no place (QP1): its fees reach it through covered_by, so the offer layer's `at` is answered
      if (isSystemPass(cap, inc.covers.length)) return "firm";
      break;
    case "summary":
      // an offer's summary is on its capture record (C1, C7); an offer that draws on its own and so has a relevance record
      // (relevance 3.7: a lift ticket, a coaster) is answered by that record's why, which is the same sentence
      if (cap.layer === "offer" && !cap.summary && rel?.why) return "firm";
      break;
    case "access_cost":
      // C11: a protected area with requirement offers (fees, permits, seats at it) has a firm answer; the offers are the answer (4.6)
      if (cap.layer === "place" && typeUnder(cap.type, "nature.protected") && inc.offers_at.some((o) => typeUnder(world.cap.get(o)?.rec.type ?? "", "access.pass"))) return "firm";
      break;
    case "access_points": return (cap.starts_at?.length ?? 0) + inc.parks_for.length + inc.serves.length + inc.starts_here.length > 0 ? "firm" : "gap";
    case "links": {
      const l = (cap.links ?? []).filter((x) => x.kind === "official");
      return l.some((x) => x.state === "filled") ? "firm" : l.length > 0 ? "soft" : "gap";
    }
    case "photos": return (cap.photos?.length ?? 0) > 0 ? "firm" : "gap";
    case "transit": return inc.serves.length > 0 ? "firm" : "gap";
    case "geometry": {
      // the line lives in data/tracks; a route with no stored line, or whose line is held back, has no confirmed geometry
      const t = tracksByRef(world).get(ref);
      if (!t || !t.stitched) return "gap";
      return t.confirmed || UNCONFIRMED_TRACK_COUNTS ? "firm" : "gap";
    }
    default: break;
  }
  // the home on this record's layer: an offer's summary is on the capture record, everyone else's is the relevance `why` (C7)
  const home = homeOf(def, cap.layer);
  if (home.in === "capture") {
    const v = (cap as unknown as Record<string, unknown>)[home.path ?? key];
    if (v === undefined || v === null) return "gap";
    if (Array.isArray(v)) return v.length > 0 ? "firm" : "gap";
    if (typeof v === "object") return firm(v);
    return "firm";
  }
  if (home.in === "relevance") {
    if (!rel) return "gap";
    const v = (rel as unknown as Record<string, unknown>)[home.path ?? key];
    if (v === undefined || v === null) return "gap";
    if (key === "signals") {
      const s = v as Record<string, unknown>;
      return Object.values(s).some((x) => firm(x) === "firm") ? "firm" : Object.values(s).some((x) => firm(x) === "soft") ? "soft" : "gap";
    }
    if (Array.isArray(v)) return v.length > 0 ? "firm" : "gap";
    if (typeof v === "object") return firm(v);
    return String(v).length > 0 ? "firm" : "gap";
  }
  return "gap";
}

const SELLING = new Set(["experience", "rental", "ticket", "access"]);

/** Evaluates a named condition. null: the data cannot decide it. */
export function evalTrigger(world: World, name: Trigger | string, ref: string, node: ResolvedNode, layer: Layer, cap: CaptureRecord, suit: SuitabilityRecord | undefined, rel: RelevanceRecord | undefined): boolean | null {
  const inc = incomingOf(world, ref);
  switch (name) {
    case "operates": {
      if (layer === "offer") return true;
      if (suit?.operated === true || cap.hours || cap.season) return true;
      return node.operated === "always" ? true : node.operated === "never" ? false : null;
    }
    case "sells": {
      if (layer === "offer") return SELLING.has(node.layers.offer?.offer_class ?? "experience");
      if (cap.price) return true;
      const offers = [...inc.at, ...inc.on].map((r) => world.cap.get(r)?.rec).filter((x): x is CaptureRecord => !!x);
      if (offers.length === 0) return null;
      return offers.some((o) => SELLING.has(resolveNode(o.type)?.layers.offer?.offer_class ?? "experience"));
    }
    case "bookable": {
      if (cap.window) return true;
      const items = rel?.access_cost.state === "value" ? rel.access_cost.v ?? [] : [];
      if (items.some((i) => ["permit_lottery", "timed_entry", "day_permit", "daily_cap", "shuttle_only", "toll_reservation"].includes(i.type))) return true;
      if (layer === "offer") return node.layers.offer?.offer_class === "access" || node.layers.offer?.offer_class === "experience" ? true : null;
      return rel ? false : null;
    }
    case "status_page": return (cap.links ?? []).some((l) => (l.kind === "conditions" || l.kind === "status") && l.state === "filled") ? true : null;
    case "part_of_something": return (cap.part_of?.length ?? 0) > 0;
    case "no_door_access": {
      const w = suit?.suitability.walk_m;
      if (w && w.state === "value" && typeof w.v === "number" && w.v > 0) return true;
      const via = suit?.suitability.access_season;
      if (via && via.state === "value" && (via.v ?? []).some((a) => a.via !== "road")) return true;
      const items = rel?.access_cost.state === "value" ? rel.access_cost.v ?? [] : [];
      if (items.some((i) => ["shuttle_only", "lift_only", "boat_or_ferry", "long_walk_in"].includes(i.type))) return true;
      return suit || rel ? false : null;
    }
    case "wildlife_area": return suit?.ext?.kind === "wildlife" ? true : null;
    case "derived": return canDeriveNearTown(world, cap);
    case "weather_dependent": return suit?.suitability.participation?.weather_cancel ? true : null;
    default: return null;
  }
}

export function completeness(world: World, ref: string, file?: TypesFile): Completeness | null {
  const capL = world.cap.get(ref);
  if (!capL) return null;
  const cap = capL.rec;
  const node = resolveNode(cap.type, file);
  if (!node || !node.layers[cap.layer]) return null;
  const rl = node.layers[cap.layer]!;
  const suit = world.suit.get(ref)?.rec;
  const rel = world.rel.get(ref)?.rec;

  const missingBase: string[] = [];
  const missingApplicable: string[] = [];
  const soft: string[] = [];
  const conditionalMissing: string[] = [];
  const conditionUnknown: string[] = [];
  const naPresent: string[] = [];
  const gapReasons: Record<string, string> = {};
  for (const [key, mark] of Object.entries(rl.base) as [string, Mark][]) {
    const st = readProperty(world, key, ref, cap, rel);
    if (key === "geometry" && st === "gap" && tracksByRef(world).has(ref)) gapReasons[key] = GEOMETRY_GAP_REASON;
    if (mark === "R") {
      if (st === "gap") missingBase.push(key);
      else if (st === "soft") soft.push(key);
    } else if (mark === "R?") {
      const trig = PROPERTY_BY_KEY.get(key)?.trigger ?? "conditional";
      const on = evalTrigger(world, trig, ref, node, cap.layer, cap, suit, rel);
      if (on === null) conditionUnknown.push(key);
      else if (on && st === "gap") conditionalMissing.push(key);
    } else if (mark === "A") {
      if (st === "gap") missingApplicable.push(key);
    }
  }
  // present but not asked
  for (const [key, def] of [...(function* () { for (const k of ["season", "hours", "price", "window", "best_window", "best_time"]) yield [k, PROPERTY_BY_KEY.get(k)!] as const; })()]) {
    if (def && !(key in rl.base) && (cap as unknown as Record<string, unknown>)[key] !== undefined) naPresent.push(key);
  }

  // the suitability slice: the same function the suitability validator calls, given this node's marks
  let suitCheck: RecordCheck | null = null;
  let missingSuitability: string[] = [];
  if (rl.carries_suitability && node.profile) {
    const located = locatedFromNode(node);
    const operatedFlag = suit?.operated ?? (node.operated_default !== null && node.operated === "flag" ? node.operated_default : undefined);
    if (suit) {
      suitCheck = checkRecord({ kind: suit.kind, subkind: suit.subkind, suitability: suit.suitability, ext: suit.ext, offers: suit.offers, operated: operatedFlag }, loadApplicability(world.root), located);
      missingSuitability = suitCheck.missingRequired;
      for (const p of suitCheck.missingApplicable) missingApplicable.push(p);
      for (const p of suitCheck.softRequired) soft.push(p);
    } else if (located) {
      const operated = isOperated(located.profile, operatedFlag);
      missingSuitability = Object.entries(node.suitability).filter(([p, m]) => m === "R" || (m === "op" && operated)).map(([p]) => p);
      for (const [p, m] of Object.entries(node.suitability)) if (m === "A") missingApplicable.push(p);
    }
  }

  const hasIdentity = !!cap.name && !!cap.type;
  const required = missingBase.length + missingSuitability.length + conditionalMissing.length;
  const partial = (suitCheck?.level === "usable_partial") || soft.length > 0 && soft.length / Math.max(1, Object.values(rl.base).filter((m) => m === "R").length) > 0.4;
  const level: CapLevel = !hasIdentity ? "stub" : required > 0 ? "draft" : partial ? "usable_partial" : missingApplicable.length > 0 ? "usable" : "complete";
  return { ref, type: cap.type, layer: cap.layer, level, suitability: suitCheck, missingBase, missingSuitability, missingApplicable, soft, conditionalMissing, conditionUnknown, naPresent, gapReasons };
}

export type { SuitLevel };
