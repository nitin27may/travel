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
  /** the hidden-gems lane's access_legal === 'public' */
  accessLegalPublic?: boolean;
  /** computed family effort of the same ref, for the substitutes list */
  familyEffort?: number | null;
}
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
}

export interface Substitute { ref: string; km: number; draw: DrawTier; standing: string; access_cost: string[]; family_effort: number | null }
export interface FarPointer { ref: string; km: number; draw: DrawTier; same_class: boolean }
export interface FitOut { fit: Fit; reason: string }
export interface Derived {
  ref: string;
  draw_suggested: DrawTier;
  effective_draw: DrawTier;
  access_load: AccessLoad;
  detour_min: number | null;
  detour_basis: "trip" | "base" | "town" | "none";
  detour_town?: string;
  from_hubs: Record<string, { min: number; approx: boolean }>;
  substitutes: { near: Substitute[]; area: Substitute[] };
  far_pointer: FarPointer | null;
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

  const subOf = (r: RelevanceRecord, o: RelevanceRecord, km: number): Substitute => {
    const jo = J.get(o.ref)!;
    return {
      ref: o.ref,
      km: Math.round(km * 10) / 10,
      draw: jo.draw,
      standing: jo.standing,
      access_cost: jo.access.map((a) => a.type),
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
    const near = sameClass.filter((o) => o.km <= NEAR_KM).map((o) => subOf(r, o.rec, o.km)).sort(bySort);
    const area = sameClass.filter((o) => o.km <= AREA_KM).map((o) => subOf(r, o.rec, o.km)).sort(bySort);

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
    if (role === "anchor" && j.access.some((a) => FAILING_COSTS.includes(a.type))) {
      planB = area.find((s) => !s.access_cost.some((c) => FAILING_COSTS.includes(c as never))) ?? null;
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
  return results;
}

/** The badge for a lens, given the derived fits (3.6 "Lens" column). `hub` selects the day fit. */
export function badgeFor(d: Derived, rec: RelevanceRecord, lens: "vacation" | "day" | "place", hub?: string): Badge | null {
  const j = judged(rec);
  return badgeOf(d.role, j.standing, d.effective_draw, lens, hub ? d.fits.day[hub]?.fit : undefined);
}
