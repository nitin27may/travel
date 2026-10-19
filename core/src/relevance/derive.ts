// Derive step of relevance.md section 3: everything that is computed from the judged fields, the cached signals and the
// catalogue. Pure and offline: it takes its inputs as arguments, so a test passes fixtures and the CLI loads files.
import type { DrawTier, RelevanceRecord } from "../schema/relevance.ts";
import {
  FAILING_COSTS, THRESHOLDS, accessLoad, approxMinutes, atLeast, badgeOf, dayTripFit, drawSuggested, effectiveDraw, flagsOf,
  haversineKm, passingFit, roleOf, tierIdx, vacationFit, weekendFit,
} from "./fit.ts";
import type { AccessLoad, Badge, Fit, Flags, Role, Thresholds } from "./fit.ts";
import { isAllowedHub } from "./hubs.ts";
import { staleFields } from "./stale.ts";
import { suggestFor } from "./suggest.ts";

export interface Point { lat: number; lon: number }
export interface Town extends Point { id: string; name: string; has_stay: boolean }
export interface Hub extends Point { id: string; name: string; /** must be true: a public city, never a household */ public: boolean }

/** Hub drive matrix input (backlog 3.12): one-way minutes from each public hub to each place. Fixtures stand in until it exists. */
export interface HubMatrix {
  schema: "hub-matrix/1";
  hubs: Hub[];
  minutes: Record<string, Record<string, number>>; // ref -> hub id -> one-way minutes
}

export interface PlaceFacts {
  point?: Point;
  /** minutes on site; from the suitability on_site_min or the plan */
  onSiteMin?: number | null;
  /** straight-line or routed minutes the trip's day adds, from L3c legs; wins over the catalogue estimate */
  tripDetourMin?: number | null;
  /** a trip's own base, when the place is on a trip */
  base?: Point;
  /** worst access load already held as a booking or a suitability access_season.via */
  externalAccess?: AccessLoad;
  /** the suitability access_season `via` values (shuttle, lift, boat, ...). A shuttle-only season is the same failing cost as an access_cost of shuttle_only for Plan B (3.17) */
  accessSeasonVia?: string[];
  /** the hidden-gems lane's access_legal === 'public' */
  accessLegalPublic?: boolean;
  /** computed family effort of the same ref, for the substitutes list */
  familyEffort?: number | null;
  /** this ref's point was copied from another ref (a legacy trail at the trailhead named after a sight) */
  aliasOf?: string;
  /** feature tags (locations tags); when both places have some, a substitute must share one */
  tags?: string[];
}
/** The party, when a profile is set. Nothing here is household data: only the ceiling the party can do. */
export interface PartyFit { maxFamilyEffort?: number }
export interface Signals { languages: number | null; views: number | null }

export interface DeriveInput {
  records: RelevanceRecord[];
  facts: Record<string, PlaceFacts>;
  signals: Record<string, Signals>; // by QID
  towns: Town[];
  matrix?: HubMatrix | null;
  /** trip season window, MM-DD; picks effective_draw */
  window?: { from: string; to: string } | null;
  thresholds?: Thresholds;
  /** per ref: the file's researched date and its sources' read dates; with `today` it lets derive spot stale values */
  meta?: Record<string, { researched: string; reads: Record<string, string> }>;
  today?: string;
  /** radius of the far pointer; the spec says 50 km (3.2) */
  farPointerKm?: number;
  profile?: PartyFit | null;
  /** real drive minutes between two refs (the ORS leg matrix, once it exists): driveMin[a][b]. Absent: no drive pairs */
  driveMin?: Record<string, Record<string, number>>;
}

export interface Substitute { ref: string; km: number; draw: DrawTier; standing: string; access_cost: string[]; family_effort: number | null }
export interface Pair {
  ref: string;
  /** straight-line km; null for a hand-picked pair when either record has no point (2.33): shown without a distance */
  km: number | null;
  how: "walk" | "drive" | null;
  /** minutes the pair adds: travel there and back plus time on site; null when the distance is unknown */
  extra_min: number | null;
  on_site_min: number;
  /** true when on_site_min comes from the class table, not a suitability time */
  on_site_estimated: boolean;
  draw: DrawTier;
  standing: string;
  hand_picked: boolean;
  reason?: string;
  src?: string;
}
export interface FarPointer { ref: string; km: number; draw: DrawTier; same_class: boolean }
export interface FitOut { fit: Fit; reason: string }
export interface Derived {
  ref: string;
  /** capture layer of the record, when it has a capture record (relevance 3.7) */
  layer?: "place" | "route" | "offer" | "event";
  /** a route that carries its own draw because the route is itself the experience */
  route_is_attraction?: boolean;
  /** a route with no judgement of its own reads draw, role and badge from the place it reaches */
  draw_from?: string;
  draw_suggested: DrawTier;
  effective_draw: DrawTier;
  access_load: AccessLoad;
  detour_min: number | null;
  detour_basis: "trip" | "base" | "town" | "none";
  detour_town?: string;
  from_hubs: Record<string, { min: number; approx: boolean }>;
  substitutes: { near: Substitute[]; area: Substitute[] };
  far_pointer: FarPointer | null;
  /** "Nearby, worth adding": at most 3, hand-picked first (3.2) */
  pair_with: Pair[];
  /** would qualify on a straight-line guess but has no real drive time yet; never shown (3.2) */
  pair_pending: { ref: string; km: number }[];
  /** same coordinate (about 100 m) or a trailhead alias of this place: part of it, not a pairing */
  part_of: string[];
  plan_b: Substitute | null;
  fits: { vacation: FitOut; weekend: FitOut; day: Record<string, FitOut>; passing: FitOut };
  role: Role;
  flags: Flags;
  badge: Badge | null;
  /** the same derivation at the peak tier, when the record has a draw_peak */
  peak?: { tier: DrawTier; role: Role; badge: Badge | null; vacation: FitOut };
  /** judged or evidence fields past their freshness limit; derive treated each as a gap */
  stale: string[];
  warnings: { code: string; message: string }[];
}

const NEAR_KM = 25;
const AREA_KM = 100;

const WALK_KM = 1.5;
const PAIR_DRIVE_MIN = 15;
const SAME_POINT_KM = 0.1;
const PAIR_LIGHT_MAX = 90;
const PAIR_MAX = 3;
/** On-site minutes by class head when no suitability time exists; marked as an estimate. Trails are deliberately long. */
const ON_SITE_ESTIMATE: Record<string, number> = { viewpoint: 20, waterfall: 30, lake: 60, sight: 45, town: 90, trail: 150, lift: 90, drive: 60, canyon: 45, gorge: 45, beach: 60, peak: 180, cave: 45, glacier: 120, water: 60, wildlife: 60, activity: 90, park: 90 };
const classHead = (k: string): string => k.split("/")[0] ?? k;

const rank = (s: string): number => (s === "top" ? 2 : s === "good" ? 1 : 0);

function valueOf<T>(x: { v: T | null; state: string }): T | null {
  return x.state === "value" ? x.v : null;
}

/** The three judged tiers a derive run reads from a record; a `gap` field reads as the lower option. */
function judged(r: RelevanceRecord, stale: ReadonlySet<string> = new Set()) {
  const live = <T,>(field: string, x: { v: T | null; state: string }): T | null => (stale.has(field) ? null : valueOf(x));
  return {
    draw: live("draw", r.draw) ?? "local",
    standing: live("standing", r.standing) ?? "ordinary",
    distinction: live("distinction", r.distinction) ?? "common",
    weather: valueOf(r.weather) ?? "any_weather",
    access: live("access_cost", r.access_cost) ?? [],
    designations: live("designations", r.signals.designations) ?? [],
    editorial: live("editorial", r.signals.editorial) ?? [],
    peak: valueOf(r.draw_peak ?? { v: null, state: "gap" }),
  } as const;
}

export function deriveAll(input: DeriveInput): Derived[] {
  const th = input.thresholds ?? THRESHOLDS;
  const staleOf = (r: RelevanceRecord): string[] => {
    const m = input.meta?.[r.ref];
    return m && input.today ? staleFields(r, m.researched, m.reads, input.today).map((x) => x.field) : [];
  };
  const J = new Map(input.records.map((r) => [r.ref, judged(r, new Set(staleOf(r)))]));
  const farKm = input.farPointerKm ?? 50;
  const matrix = input.matrix ?? null;

  /** access_cost types plus the shuttle-only cost a suitability access season by shuttle stands for (3.17) */
  const accessTypes = (ref: string, types: string[]): string[] =>
    (input.facts[ref]?.accessSeasonVia ?? []).includes("shuttle") && !types.includes("shuttle_only") ? [...types, "shuttle_only"] : types;

  const subOf = (r: RelevanceRecord, o: RelevanceRecord, km: number): Substitute => {
    const jo = J.get(o.ref)!;
    return {
      ref: o.ref,
      km: Math.round(km * 10) / 10,
      draw: jo.draw,
      standing: jo.standing,
      access_cost: accessTypes(o.ref, jo.access.map((a) => a.type)),
      family_effort: input.facts[o.ref]?.familyEffort ?? null,
    };
  };
  const bySort = (a: Substitute, b: Substitute): number =>
    tierIdx(b.draw) - tierIdx(a.draw) || rank(b.standing) - rank(a.standing) || a.km - b.km;

  const nearbyOthers = (ref: string): { rec: RelevanceRecord; km: number }[] => {
    const p = input.facts[ref]?.point;
    if (!p) return [];
    const out: { rec: RelevanceRecord; km: number }[] = [];
    for (const o of input.records) {
      if (o.ref === ref) continue;
      const q = input.facts[o.ref]?.point;
      if (q) out.push({ rec: o, km: haversineKm(p, q) });
    }
    return out;
  };

  const results: Derived[] = [];
  for (const r of input.records) {
    const j = J.get(r.ref)!;
    const facts = input.facts[r.ref] ?? {};
    const suggested = suggestFor({ ...r, signals: { ...r.signals, designations: { ...r.signals.designations, v: j.designations, state: "value" }, editorial: { ...r.signals.editorial, v: j.editorial, state: "value" } } } as RelevanceRecord, input.signals, th);
    const ed = effectiveDraw(j.draw, j.peak, input.window);
    const warnings: Derived["warnings"] = [];

    // access
    const load = accessLoad(j.access, facts.externalAccess ?? "easy");

    // detour (3.3)
    let detour: number | null = null;
    let basis: Derived["detour_basis"] = "none";
    let townName: string | undefined;
    if (facts.tripDetourMin !== undefined && facts.tripDetourMin !== null) {
      detour = facts.tripDetourMin;
      basis = "trip";
    } else if (facts.point && facts.base) {
      detour = 2 * approxMinutes(haversineKm(facts.point, facts.base));
      basis = "base";
    } else if (facts.point) {
      const towns = input.towns.filter((t) => t.has_stay);
      let best: { t: Town; km: number } | null = null;
      for (const t of towns) {
        const km = haversineKm(facts.point, t);
        if (!best || km < best.km) best = { t, km };
      }
      if (best) {
        detour = 2 * approxMinutes(best.km);
        basis = "town";
        townName = best.t.name;
      }
    }
    if (detour === null) warnings.push({ code: "W_REL_NO_DETOUR", message: "no trip leg, base or catalogue town with a stay gives a detour; fits that need one are conservative" });

    // hubs (3.3 from_hubs): the matrix wins, a straight-line estimate fills a missing cell and is marked approximate
    const fromHubs: Derived["from_hubs"] = {};
    for (const hub of matrix?.hubs ?? []) {
      if (!hub.public || !isAllowedHub(hub.id)) continue; // never a household origin: public and on the allowlist
      const m = matrix!.minutes[r.ref]?.[hub.id];
      if (typeof m === "number") fromHubs[hub.id] = { min: m, approx: false };
      else if (facts.point) fromHubs[hub.id] = { min: approxMinutes(haversineKm(facts.point, hub)), approx: true };
    }
    const hubMins = Object.values(fromHubs).map((h) => h.min);
    const nearestHub = hubMins.length ? Math.min(...hubMins) : null;

    // substitutes (3.2)
    const others = nearbyOthers(r.ref);
    const sameClass = others.filter((o) => o.rec.class_key === r.class_key);
    // attribute-aware (3.2): family effort within one level, on-site time within 0.5x to 2x, a shared feature tag
    const alike = (o: { rec: RelevanceRecord }): boolean => {
      const a = input.facts[r.ref] ?? {};
      const b = input.facts[o.rec.ref] ?? {};
      if (a.familyEffort != null && b.familyEffort != null && Math.abs(a.familyEffort - b.familyEffort) > 1) return false;
      if (a.onSiteMin && b.onSiteMin && (b.onSiteMin < a.onSiteMin * 0.5 || b.onSiteMin > a.onSiteMin * 2)) return false;
      if (a.tags?.length && b.tags?.length && !a.tags.some((t) => b.tags!.includes(t))) return false;
      return true;
    };
    const maxEffort = input.profile?.maxFamilyEffort;
    const fitsParty = (s: Substitute): number => (maxEffort === undefined || s.family_effort === null || s.family_effort <= maxEffort ? 0 : 1);
    const subSort = (a: Substitute, b: Substitute): number => fitsParty(a) - fitsParty(b) || bySort(a, b);
    const gated = sameClass.filter(alike);
    const near = gated.filter((o) => o.km <= NEAR_KM).map((o) => subOf(r, o.rec, o.km)).sort(subSort);
    // plan b reads the ungated list: a roadside stop beats a 3 h lake on time by design (Peyto for Moraine)
    const areaAll = sameClass.filter((o) => o.km <= AREA_KM).map((o) => subOf(r, o.rec, o.km)).sort(bySort);
    const area = gated.filter((o) => o.km <= AREA_KM).map((o) => subOf(r, o.rec, o.km)).sort(subSort);


    // far pointer: nearest within farKm with a draw at least two tiers higher; same class preferred
    let far: FarPointer | null = null;
    if (ed === "local" || ed === "regional") {
      const pick = (pool: typeof others, same: boolean): FarPointer | null => {
        const c = pool
          .filter((o) => o.km <= farKm && tierIdx(J.get(o.rec.ref)!.draw) - tierIdx(ed) >= 2)
          .sort((a, b) => a.km - b.km)[0];
        return c ? { ref: c.rec.ref, km: Math.round(c.km * 10) / 10, draw: J.get(c.rec.ref)!.draw, same_class: same } : null;
      };
      far = pick(sameClass, true) ?? pick(others, false);
    }

    // fits
    const base = { ed, standing: j.standing, distinction: j.distinction, weather: j.weather, load, detourMin: detour, onSiteMin: facts.onSiteMin ?? null };
    const vac = vacationFit(base);
    const passing = passingFit(base);
    // area cluster for the weekend plan_around rule
    const strong = (ref: string): boolean => {
      const jj = J.get(ref)!;
      return atLeast(effectiveDraw(jj.draw, jj.peak, input.window), "regional") && jj.standing === "top";
    };
    const areaCluster = strong(r.ref) && others.some((o) => strong(o.rec.ref) && approxMinutes(o.km) <= 30);
    const weekend = weekendFit({ ...base, nearestHubMin: nearestHub, areaCluster });
    const day: Record<string, FitOut> = {};
    for (const [hubId, h] of Object.entries(fromHubs)) day[hubId] = dayTripFit({ ...base, hubMin: h.min });

    let role = roleOf(vac.fit);
    const ov = r.override;
    if (ov && ov.field === "role" && ["anchor", "highlight", "filler", "local_only"].includes(ov.value)) role = ov.value as Role;
    const flags = flagsOf({ role, weather: j.weather, passing: passing.fit, standing: j.standing, ed, accessLegalPublic: facts.accessLegalPublic === true });

    // plan b: an anchor whose access can fail gets the best same-class substitute without such a cost
    let planB: Substitute | null = null;
    const shuttleSeason = (facts.accessSeasonVia ?? []).includes("shuttle");
    if (role === "anchor" && (shuttleSeason || j.access.some((a) => FAILING_COSTS.includes(a.type)))) {
      planB = areaAll.find((s) => !s.access_cost.some((c) => FAILING_COSTS.includes(c as never))) ?? null;
    }

    // distinction check
    if (j.distinction === "unique" && area.length > 0) {
      warnings.push({ code: "W_REL_DISTINCTION", message: `distinction is unique but ${area[0]!.ref} has the same class within ${AREA_KM} km` });
    }

    const out: Derived = {
      ref: r.ref,
      draw_suggested: suggested,
      effective_draw: ed,
      access_load: load,
      detour_min: detour,
      detour_basis: basis,
      ...(townName ? { detour_town: townName } : {}),
      from_hubs: fromHubs,
      substitutes: { near, area },
      far_pointer: far,
      pair_with: [],
      pair_pending: [],
      part_of: [],
      plan_b: planB,
      fits: { vacation: vac, weekend, day, passing },
      role,
      flags,
      badge: badgeOf(role, j.standing, ed, "place"),
      stale: staleOf(r),
      warnings,
    };
    if (j.peak) {
      const pEd: DrawTier = tierIdx(j.peak.tier) > tierIdx(j.draw) ? j.peak.tier : j.draw;
      const pvac = vacationFit({ ...base, ed: pEd });
      const prole = roleOf(pvac.fit);
      out.peak = { tier: pEd, role: prole, badge: badgeOf(prole, j.standing, pEd, "place"), vacation: pvac };
    }
    results.push(out);
  }
  demoteDoubleAnchors(input.records, results);
  assignPairs(input, results, J, haversineKm);
  return results;
}

/** Record kinds that are a product at a place rather than the place itself (an activity, or a lift serving a summit). It shares its place with a place record. */
export const ACTIVITY_KINDS: readonly string[] = ["activity", "lift"];

/**
 * CF 4(b): a place and an activity at that place cannot both be anchors (the cruise and its lake). Records share a place
 * when one names the other in `same_place_as`, or when they carry the same confirmed QID. In such a group, each activity
 * record that is an anchor steps down to a highlight while a place record holds the anchor. The place keeps it.
 */
function demoteDoubleAnchors(records: RelevanceRecord[], results: Derived[]): void {
  const parent = new Map<string, string>(records.map((r) => [r.ref, r.ref]));
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  const union = (a: string, b: string): void => {
    if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b));
  };
  const byQid = new Map<string, string>();
  for (const r of records) {
    if (r.same_place_as) union(r.ref, r.same_place_as);
    const q = r.wikidata.state === "value" ? r.wikidata.v : null;
    if (q) {
      const first = byQid.get(q);
      if (first) union(r.ref, first);
      else byQid.set(q, r.ref);
    }
  }
  const kindOf = new Map(records.map((r) => [r.ref, r.kind]));
  const overridden = new Set(records.filter((r) => r.override?.field === "role").map((r) => r.ref));
  const groups = new Map<string, Derived[]>();
  for (const d of results) {
    const g = groups.get(find(d.ref)) ?? [];
    g.push(d);
    groups.set(find(d.ref), g);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const places = g.filter((d) => !ACTIVITY_KINDS.includes(kindOf.get(d.ref)!));
    const holder = places.find((d) => d.role === "anchor");
    const holderPeak = places.find((d) => (d.peak?.role ?? d.role) === "anchor");
    for (const d of g) {
      if (!ACTIVITY_KINDS.includes(kindOf.get(d.ref)!) || overridden.has(d.ref)) continue;
      if (holder && d.role === "anchor") {
        d.role = "highlight";
        d.fits.vacation = { fit: "worth_it", reason: `${d.fits.vacation.reason}; same place as ${holder.ref}, which keeps the anchor` };
        d.badge = badgeOf("highlight", records.find((r) => r.ref === d.ref)!.standing.v ?? "ordinary", d.effective_draw, "place");
        d.plan_b = null;
        d.flags = { ...d.flags, go_clear_day: false };
      }
      if (holderPeak && d.peak && d.peak.role === "anchor") {
        d.peak = { ...d.peak, role: "highlight", badge: badgeOf("highlight", records.find((r) => r.ref === d.ref)!.standing.v ?? "ordinary", d.peak.tier, "place"), vacation: { fit: "worth_it", reason: `${d.peak.vacation.reason}; same place as ${holderPeak.ref}, which keeps the anchor` } };
      }
    }
  }
}

const ANCHORISH = new Set(["anchor"]);

/**
 * pair_with (3.2, tightened): a different-class place you can add to the visit.
 *  - walk only: within 1.5 km straight line of the place's own point; a drive pair needs a real drive time
 *    (input.driveMin) of 15 min or less, and without one a straight-line candidate is listed in pair_pending, not shown;
 *  - never two records at one point (within 100 m) or one a trailhead alias of the other: that is part_of;
 *  - lighter than the place: on-site time no more than the place's own, or at most 90 min;
 *  - two anchors pair only on foot; standing top or good; fits the party when a profile is set.
 * Hand-picked pairs always qualify and rank first.
 */
function assignPairs(input: DeriveInput, results: Derived[], J: Map<string, ReturnType<typeof judged>>, dist: typeof haversineKm): void {
  const byRef = new Map(results.map((d) => [d.ref, d]));
  const recBy = new Map(input.records.map((r) => [r.ref, r]));
  const onSite = (ref: string): { min: number; est: boolean } => {
    const m = input.facts[ref]?.onSiteMin;
    return m != null ? { min: m, est: false } : { min: ON_SITE_ESTIMATE[classHead(recBy.get(ref)!.class_key)] ?? 60, est: true };
  };
  const maxEffort = input.profile?.maxFamilyEffort;
  for (const r of input.records) {
    const d = byRef.get(r.ref)!;
    const me = input.facts[r.ref] ?? {};
    const mine = onSite(r.ref);
    const cands: { rec: RelevanceRecord; km: number }[] = [];
    if (me.point) {
      for (const o of input.records) {
        const q = input.facts[o.ref]?.point;
        if (o.ref !== r.ref && q) cands.push({ rec: o, km: dist(me.point, q) });
      }
    }
    const partOf = (o: { rec: RelevanceRecord; km: number }): boolean =>
      o.km <= SAME_POINT_KM || me.aliasOf === o.rec.ref || input.facts[o.rec.ref]?.aliasOf === r.ref || (me.aliasOf !== undefined && me.aliasOf === input.facts[o.rec.ref]?.aliasOf);
    d.part_of = cands.filter((o) => o.rec.class_key !== r.class_key && partOf(o)).map((o) => o.rec.ref).sort();
    const pairOf = (o: { rec: RelevanceRecord; km: number }, how: "walk" | "drive", hand: { reason: string; src?: string } | null): Pair => {
      const os = onSite(o.rec.ref);
      const jo = J.get(o.rec.ref)!;
      const travel = how === "walk" ? Math.round(o.km * 15 * 2) : 2 * (input.driveMin?.[r.ref]?.[o.rec.ref] ?? input.driveMin?.[o.rec.ref]?.[r.ref] ?? 0);
      return { ref: o.rec.ref, km: Math.round(o.km * 10) / 10, how, extra_min: travel + os.min, on_site_min: os.min, on_site_estimated: os.est, draw: jo.draw, standing: jo.standing, hand_picked: hand !== null, ...(hand ? { reason: hand.reason, ...(hand.src ? { src: hand.src } : {}) } : {}) };
    };
    const pairs: Pair[] = [];
    const picked = new Set<string>();
    for (const pw of r.pairs_with ?? []) {
      if (picked.has(pw.ref)) continue;
      const hand = { reason: pw.reason, ...(pw.src ? { src: pw.src } : {}) };
      const o = cands.find((x) => x.rec.ref === pw.ref);
      if (o) {
        picked.add(pw.ref);
        pairs.push(pairOf(o, o.km <= WALK_KM ? "walk" : "drive", hand));
        continue;
      }
      // 2.33: a hand-picked pair whose record (or this one) has no point is kept and shown with no distance
      const rec = recBy.get(pw.ref);
      if (!rec || rec.ref === r.ref) continue;
      picked.add(pw.ref);
      const os = onSite(rec.ref);
      const jo = J.get(rec.ref)!;
      pairs.push({ ref: rec.ref, km: null, how: null, extra_min: null, on_site_min: os.min, on_site_estimated: os.est, draw: jo.draw, standing: jo.standing, hand_picked: true, ...hand });
    }
    const pending: Derived["pair_pending"] = [];
    const auto: Pair[] = [];
    for (const o of cands) {
      if (picked.has(o.rec.ref) || o.rec.class_key === r.class_key || partOf(o) || classHead(o.rec.class_key) === "town") continue;
      const jo = J.get(o.rec.ref)!;
      if (rank(jo.standing) < 1) continue;
      const os = onSite(o.rec.ref);
      if (os.min > mine.min && os.min > PAIR_LIGHT_MAX) continue; // lighter than the place, or at most 90 min
      const fo = input.facts[o.rec.ref] ?? {};
      if (maxEffort !== undefined && fo.familyEffort != null && fo.familyEffort > maxEffort) continue;
      const walk = o.km <= WALK_KM;
      if (!walk && ANCHORISH.has(byRef.get(o.rec.ref)!.role) && ANCHORISH.has(d.role)) continue; // two anchors pair on foot only
      if (walk) {
        auto.push(pairOf(o, "walk", null));
        continue;
      }
      const dm = input.driveMin?.[r.ref]?.[o.rec.ref] ?? input.driveMin?.[o.rec.ref]?.[r.ref];
      if (dm !== undefined) {
        if (dm <= PAIR_DRIVE_MIN) auto.push(pairOf(o, "drive", null));
      } else if (approxMinutes(o.km) <= PAIR_DRIVE_MIN) {
        pending.push({ ref: o.rec.ref, km: Math.round(o.km * 10) / 10 });
      }
    }
    auto.sort((a, b) => (a.extra_min ?? 0) - (b.extra_min ?? 0) || rank(b.standing) - rank(a.standing) || (a.km ?? 0) - (b.km ?? 0));
    d.pair_with = [...pairs, ...auto].slice(0, PAIR_MAX);
    d.pair_pending = pending.sort((a, b) => a.km - b.km);
  }
}

/** The badge for a lens, given the derived fits (3.6 "Lens" column). `hub` selects the day fit. */
export function badgeFor(d: Derived, rec: RelevanceRecord, lens: "vacation" | "day" | "place", hub?: string): Badge | null {
  const j = judged(rec);
  return badgeOf(d.role, j.standing, d.effective_draw, lens, hub ? d.fits.day[hub]?.fit : undefined);
}
