// The trip builder engine (trip-builder.md 4.2 to 4.11; FLOW TF7, TF8, TF11; tasks TB-E1, TB-E2): one base or none (K = 1, the first
// slice FS-1), or the bases the visitor chose (TB-E2, below). Pure, synchronous and deterministic: the same EngineInput gives the same PlanBuild, byte for byte (no clock, no random
// number, integer minutes, every sort ends on a ref). The build time (`builtAt`) is the caller's to add.
//
//   1 classify  each pick: not listed (TB_UNKNOWN), an area (a park, zone or range: the trip's area, never a stop, TB-PIN), no point
//               (TB_UNKNOWN), closed in the month (TB_CLOSED), not for the party (TB_FIT), or a stop
//   2 base      nights >= 1: the pinned or accepted base when it is a candidate town, else the town that minimises the round trips to
//               the picks (plus the drive from the start, near mode, or the gateway), a pick out of reach costing a few radii (more
//               for a must), less the lodging signal; an area with no pick inside it costs a round trip into it each day, so
//               the base is drawn towards it; ties by population, then id. Nights 0: no base (near mode starts and ends at
//               the start; trip mode goes out from the best town)
//   3 radius    a pick beyond the day-trip radius of the base (half the day's driving, capped) is TB_TOO_FAR with "Add a base near it"
//   4 pack      pack.ts: kept stops first (locked, placed by the person, from our trip: TF11), then the musts, then by score
//   5 time      a stop no day can take is TB_TIME, with the smallest "Add N days" that fits it (the engine reruns with 1 to 3 more)
//   6 schedule  each day through `scheduleDay` (times, meals, sun, the day checks), with the engine's drive figures as its legs
//   7 explain   reasons from the numbers used (reasons.ts); the areas with their members or "Pick places inside X" (TB_AREA_EMPTY);
//               the stops' matrix for the client re-flow (an area is never in it)
//
// Several bases (TB-E2, `buildMulti`): when the visitor chose two or more bases that are candidate towns, those are the plan's bases in
// the visitor's order (bases.ts). Each free stop goes to the base nearest to it in drive; one beyond the radius of every base is
// TB_TOO_FAR naming the nearest; the nights are the visitor's, the open ones shared out by demand (4.5); the days run base by base
// with a move day (`move: true`, the scheduler's `transfer`) between two consecutive bases, a move over `driveDayMin` or over the
// whole day flagged (moves.ts); each base's days are packed with its own stops. None or one base chosen: K = 1 exactly as before.
//
// Never reads the home point or the environment: the near-mode start arrives as a public point the service resolved from a hub, an
// airport or a towns-layer town, and it is only ever passed to the model, never to a cache key, and never returned.
import { BUILDER_AREA, BUILDER_BASES, BUILDER_ENGINE, BUILDER_PACK } from "../config/builder.ts";
import { PACE_RULES, dayCapMin, resolveDuration } from "../schedule/rules.ts";
import { scheduleDay } from "../schedule/schedule.ts";
import type { BaseRef, DayKind, DayTimeline, PlaceRef, Profile, ScheduleDayInput, ScheduleItem, StoredLeg } from "../schedule/types.ts";
import type { PlanBuild, PlanBuildInput, PlanMatrix } from "../schema/api/plan.ts";
import { PLAN_LIMITS, PLAN_WARNING_RE, type PlanAreaOut, type PlanBaseOut, type PlanDayOut, type PlanItemOut, type PlanMiss, type PlanReason } from "../schema/plan-draft.ts";
import { GATEWAY, START, driveTable, placeNode, townNode, type DriveTable } from "./driveTable.ts";
import type { EngineInput, EnginePlace, EnginePoint, EngineTown } from "./engineTypes.ts";
import { inArea, isAreaPlace } from "./area.ts";
import { nearestBase, resolveBases, shareNights, type ChosenBase } from "./bases.ts";
import { edgeShareOf, moveCheck, routeFrame, type MultiDay } from "./moves.ts";
import { packDays, type PackDay, type PackStop } from "./pack.ts";
import * as R from "./reasons.ts";
import { fitOf, profileOf, scorePlace, seasonOf } from "./score.ts";

/** The day-trip radius, one way (TF7, 4.4): half the day's driving, capped. */
export function dayTripRadiusMin(b: Pick<PlanBuildInput, "pace" | "driveDayMin">): number {
  return Math.min(BUILDER_PACK.dayTripRadiusCapMin, Math.floor(dayDriveMin(b) / 2));
}
/** The longest drive in one day: the draft's `driveDayMin`, else the pace's limit. */
export const dayDriveMin = (b: Pick<PlanBuildInput, "pace" | "driveDayMin">): number => b.driveDayMin ?? PACE_RULES[b.pace].driveLimitMin;

/** The ScheduleItem a place becomes on a day (its id is the pick's ref, so the timeline names it). */
export function itemOf(p: EnginePlace): ScheduleItem {
  const trail = p.kind === "trail";
  const blind = trail && p.visitMin === null && p.visitRange === null && p.distanceKm === null;
  const s = p.suitability;
  return {
    id: p.ref,
    kind: trail ? "trail" : "visit",
    sub: p.kind,
    title: p.name,
    placeSlug: p.slug,
    point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null,
    rule: null,
    durationMin: blind ? BUILDER_PACK.trailFallbackMin : p.visitMin,
    durationRange: p.visitRange,
    durationSource: blind || p.visitMin !== null || p.visitRange !== null ? "data" : null,
    stats: trail ? { distanceKm: p.distanceKm, gainM: p.gainM } : null,
    start: null,
    needs: null,
    window: null,
    checkinMin: null,
    optional: false,
    note: null,
    minAge: s?.minAge ?? null,
    minAgeRule: s?.rule === "hard" ? "hard" : s?.rule === "advice" ? "advice" : null,
    needsDaylight: p.needsDaylight,
    honesty: blind ? ["estimate"] : [],
  };
}

/** Minutes on site for the profile: the scheduler's own rule (`resolveDuration`), so the packer and the timeline agree. */
export const visitMinOf = (p: EnginePlace, profile: Profile): number => resolveDuration(itemOf(p), profile).minutes;

const bearingOf = (from: EnginePoint, to: EnginePoint): number => {
  const rad = Math.PI / 180;
  const y = Math.sin((to.lon - from.lon) * rad) * Math.cos(to.lat * rad);
  const x = Math.cos(from.lat * rad) * Math.sin(to.lat * rad) - Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos((to.lon - from.lon) * rad);
  return Math.round(((Math.atan2(y, x) / rad + 360) % 360) * 10) / 10;
};
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

interface Stop {
  place: EnginePlace;
  must: boolean;
  score: number;
  node: string;
}

/** A base choice with its numbers, for the reasons. */
interface BaseEval {
  town: EngineTown;
  uncoveredMusts: number;
  cost: number;
  covered: number;
  avg: number;
  max: number;
  estimated: boolean;
}

/** Build a plan (4.2). See the header for the stages. */
export function buildPlan(input: EngineInput): PlanBuild {
  const b = input.build;
  const profile = profileOf(b.party, b.pace);
  const nights = b.nights;
  const nDays = nights + 1;
  const near = b.where.mode === "near";
  // a day trip from the start reaches as far as the one-way limit; a day out from a base, the day-trip radius
  const radius = b.where.mode === "near" && nights === 0 ? b.where.driveLimitMin : dayTripRadiusMin(b);

  // ---- points and the drive table ----
  const points = new Map<string, EnginePoint>();
  for (const p of input.places.values()) if (p.point) points.set(placeNode(p.ref), p.point);
  for (const t of input.towns) points.set(townNode(t.id), t.point);
  if (near && input.start) points.set(START, input.start);
  if (!near && input.gateway) points.set(GATEWAY, input.gateway);
  const table = driveTable(points, input.drive, b.month, input.routed);

  // ---- 1 classify ----
  const misses = new Map<string, PlanMiss>();
  const miss = (ref: string, code: PlanMiss["code"], fix: PlanMiss["fix"], reasons: PlanReason[]): void => {
    misses.set(ref, { ref, code, fix, reasons: R.capReasons(reasons) });
  };
  const stops: Stop[] = [];
  /** area picks (TB-PIN): never a stop, never Did not fit, whatever their season or fit; their members are the stops */
  const areaPicks: EnginePlace[] = [];
  for (const pick of b.picks) {
    const place = input.places.get(pick.ref);
    if (!place) {
      miss(pick.ref, "TB_UNKNOWN", { kind: "drop" }, [R.missUnknown(false)]);
      continue;
    }
    if (isAreaPlace(place)) {
      areaPicks.push(place);
      continue;
    }
    if (!place.point) {
      miss(pick.ref, "TB_UNKNOWN", { kind: "ask_us" }, [R.missUnknown(true)]);
      continue;
    }
    const season = seasonOf(place, b.month);
    if (season.state === "closed" && b.month) {
      miss(pick.ref, "TB_CLOSED", { kind: "change_month" }, [R.missClosed(season.why!, b.month)]);
      continue;
    }
    const fit = fitOf(place, profile);
    if (fit.state === "fail" && fit.basis === "rule") {
      miss(pick.ref, "TB_FIT", { kind: "drop" }, [R.missFit(fit.why ?? "Not for your party", profile.youngest ?? 0)]);
      continue;
    }
    const s = scorePlace(place, { profile, month: b.month, interests: [], driveMin: null });
    stops.push({ place, must: pick.must, score: s.score.total, node: placeNode(place.ref) });
  }

  // the picks inside each area (any pick we list that is not an area itself); an area with none pulls the base towards its point
  const picked = b.picks.flatMap((p) => {
    const pl = input.places.get(p.ref);
    return pl && !isAreaPlace(pl) ? [pl] : [];
  });
  const areas = areaPicks.map((a) => ({ place: a, members: picked.filter((p) => inArea(p, a)).length }));
  const areaAnchors = areas.filter((a) => a.members === 0 && a.place.point).map((a) => ({ name: a.place.name, node: placeNode(a.place.ref) }));

  const shared: Shared = { b, input, table, nights, areas, picked, misses };

  // ---- kept stops (TF11): locked, placed by the person, from our trip ----
  const kept = new Map<string, { day: number; rank: number; locked: boolean }>();
  for (const e of b.edits) {
    if (e.day > nDays) continue;
    const keep = new Set([...e.locked, ...(e.placed ?? []), ...(e.fromTrip ?? [])]);
    e.refs.forEach((r, i) => {
      if (keep.has(r)) kept.set(r, { day: e.day, rank: i, locked: e.locked.includes(r) });
    });
  }

  // ---- 2 base ----
  const towns = [...input.towns].sort((x, y) => cmp(x.id, y.id));
  // TB-E2: two or more bases the visitor chose are the plan's bases, in their order; none or one stays K = 1 (below, as v1)
  const chosen = nights >= 1 ? resolveBases(b.bases, towns) : [];
  if (chosen.length >= 2) {
    return buildMulti({ ...shared, profile, near, radius, points, stops, kept, towns, chosen, miss });
  }
  const evalTown = (t: EngineTown): BaseEval => {
    const tn = townNode(t.id);
    let cost = 0;
    let covered = 0;
    let sum = 0;
    let max = 0;
    let uncoveredMusts = 0;
    let estimated = false;
    for (const s of stops) {
      const cell = table.get(tn, s.node);
      const back = table.get(s.node, tn);
      const d = cell.min;
      if (!cell.routed || !back.routed) estimated = true;
      if (d !== null && d <= radius && back.min !== null) {
        covered++;
        sum += d;
        max = Math.max(max, d);
        cost += d + back.min;
      } else {
        cost += BUILDER_PACK.uncoveredRadii[s.must ? "must" : "other"] * radius;
        if (s.must) uncoveredMusts++;
      }
    }
    // an area with no pick inside it stands for the stops not picked yet: a round trip into it on each day of the plan
    for (const a of areaAnchors) {
      const there = table.minutes(tn, a.node);
      const back = table.minutes(a.node, tn);
      const trip = there !== null && back !== null && there <= radius ? there + back : BUILDER_PACK.uncoveredRadii.must * radius;
      cost += trip * BUILDER_AREA.emptyAreaTripsPerDay * nDays;
    }
    const anchor = near ? START : input.gateway ? GATEWAY : null;
    if (anchor) {
      const there = table.minutes(anchor, tn);
      const home = table.minutes(tn, anchor);
      cost += (there ?? 4 * radius) + (home ?? 4 * radius);
    }
    cost -= BUILDER_PACK.lodgingStepMin * (t.lodging ?? 0);
    return { town: t, uncoveredMusts, cost, covered, avg: covered ? Math.round(sum / covered) : 0, max, estimated };
  };
  const better = (x: BaseEval, y: BaseEval): number => x.cost - y.cost || (y.town.population ?? 0) - (x.town.population ?? 0) || cmp(x.town.id, y.town.id);
  // prefilter: the towns that cover the most picks, ties by population then id (4.4)
  const shortlist = towns
    .map((t) => ({
      t,
      n: [...stops.map((s) => s.node), ...areaAnchors.map((a) => a.node)].filter((n) => (table.minutes(townNode(t.id), n) ?? Number.POSITIVE_INFINITY) <= radius).length,
    }))
    .sort((x, y) => y.n - x.n || (y.t.population ?? 0) - (x.t.population ?? 0) || cmp(x.t.id, y.t.id))
    .slice(0, BUILDER_PACK.baseTowns)
    .map((x) => x.t);
  const ranked = shortlist.map(evalTown).sort(better);
  const chosenInput = b.bases.find((x) => x.pinned) ?? b.bases[0] ?? null;
  const pinnedTown = chosenInput ? towns.find((t) => t.id === chosenInput.town) ?? null : null;
  const wantsBase = nights >= 1 || !near;
  let base: BaseEval | null = null;
  if (wantsBase) base = pinnedTown ? evalTown(pinnedTown) : ranked[0] ?? null;
  const baseNode = base ? townNode(base.town.id) : null;
  /** where the days go out from: the base, else the start (near), else the gateway */
  const hub = baseNode ?? (near && input.start ? START : !near && input.gateway ? GATEWAY : null);

  // ---- 3 the radius ----
  const placeable: Stop[] = [];
  for (const s of stops) {
    if (kept.has(s.place.ref)) {
      placeable.push(s); // what the person placed stays placed, however far (the day checks say so)
      continue;
    }
    if (hub === null) {
      placeable.push(s);
      continue;
    }
    const d = table.minutes(hub, s.node);
    if (d === null || d > radius) {
      const est = !table.get(hub, s.node).routed;
      const alt = towns
        .filter((t) => t.id !== base?.town.id)
        .map((t) => ({ t, d: table.minutes(townNode(t.id), s.node) }))
        .filter((x): x is { t: EngineTown; d: number } => x.d !== null && x.d <= radius)
        .sort((x, y) => x.d - y.d || cmp(x.t.id, y.t.id))[0];
      const fix: PlanMiss["fix"] = alt ? { kind: "add_base", town: alt.t.id } : { kind: "add_base" };
      miss(s.place.ref, "TB_TOO_FAR", fix, [R.missTooFar(d, hub === START ? null : base?.town.name ?? null, radius, est)]);
      continue;
    }
    placeable.push(s);
  }

  // ---- 4 pack ----
  const visitOf = new Map(placeable.map((s) => [s.place.ref, visitMinOf(s.place, profile)]));
  const hubPoint = hub ? points.get(hub) ?? null : null;
  const packStops: PackStop[] = placeable.map((s) => {
    const k = kept.get(s.place.ref);
    return {
      ref: s.node,
      visitMin: visitOf.get(s.place.ref)!,
      must: s.must,
      score: s.score,
      bearing: hubPoint && s.place.point ? bearingOf(hubPoint, s.place.point) : null,
      ...(k ? { fixed: { day: k.day, rank: k.rank } } : {}),
    };
  });
  const frame = dayFrame(b, nights, near, baseNode, hub, !!input.start, !!input.gateway, profile, table);
  const cost = (a: string, c: string): number | null => (a === "v" || c === "v" ? 0 : table.minutes(a, c));
  const packed = packDays({ stops: packStops, days: frame, cost });

  // ---- 5 time: the smallest "Add N days" that fits each left-out stop ----
  const outNodes = new Set(packed.unplaced);
  if (outNodes.size) {
    const fitsWith = new Map<string, number>();
    // a day trip that grows a night grows a base: the best town, as a plan of that length would choose it
    const extraBase = baseNode ?? (ranked[0] ? townNode(ranked[0].town.id) : null);
    for (let k = 1; k <= BUILDER_PACK.addDaysMax && fitsWith.size < outNodes.size; k++) {
      if (nights + k > PLAN_LIMITS.nights || (near && nights + k > PLAN_LIMITS.nearNights)) break;
      const more = packDays({ stops: packStops, days: dayFrame(b, nights + k, near, extraBase, hub, !!input.start, !!input.gateway, profile, table), cost });
      const still = new Set(more.unplaced);
      for (const n of outNodes) if (!fitsWith.has(n) && !still.has(n)) fitsWith.set(n, k);
    }
    for (const s of placeable) {
      if (!outNodes.has(s.node)) continue;
      const k = fitsWith.get(s.node) ?? null;
      miss(s.place.ref, "TB_TIME", k === null ? { kind: "drop" } : { kind: "add_days", days: k }, [R.missTime(nDays, k, BUILDER_PACK.addDaysMax)]);
    }
  }

  // ---- 6 schedule ----
  const byNode = new Map(placeable.map((s) => [s.node, s.place]));
  const legsUsed: boolean[] = [];
  const days: PlanDayOut[] = [];
  for (const d of packed.days) {
    const f = frame.find((x) => x.day === d.day)!;
    const places = d.refs.map((n) => byNode.get(n)!);
    const town = base?.town ?? null;
    const tl = scheduleDay(dayInput(f, places, input, () => town, nights, table), profile);
    const out = dayOut(f, tl, places, kept, table, legsUsed, nights >= 1 && f.day <= nights ? base?.town.id ?? null : null);
    days.push(out);
  }

  // ---- 7 explain ----
  const placedRefs = new Set(days.flatMap((d) => d.items.map((i) => i.ref)));
  const bases: PlanBaseOut[] = [];
  if (base && nights >= 1) {
    const rs: (PlanReason | null)[] = [];
    if (pinnedTown && chosenInput?.pinned) rs.push(R.basePinned(nights));
    const toArea = stops.length === 0 && areaAnchors[0] ? table.get(townNode(base.town.id), areaAnchors[0].node) : null;
    if (toArea && toArea.min !== null) rs.push(R.baseNearArea(areaAnchors[0]!.name, toArea.min, !toArea.routed));
    else rs.push(R.baseCovers(base.covered, stops.length, base.avg, base.max, base.estimated));
    if (near && input.start) {
      const c = table.get(START, townNode(base.town.id));
      if (c.min !== null) rs.push(R.baseFromStart(base.town.name, c.min, !c.routed));
    }
    const next = ranked.find((x) => x.town.id !== base!.town.id);
    if (next && next.uncoveredMusts <= base.uncoveredMusts && next.cost > base.cost) rs.push(R.baseAlternative(next.town.name, next.cost - base.cost, next.estimated || base.estimated));
    rs.push(R.baseLodging(base.town.lodging ?? 0));
    bases.push({
      town: base.town.id,
      name: base.town.name,
      nights,
      pinned: !!(pinnedTown && chosenInput?.pinned),
      picks: [...placedRefs].length,
      reasons: R.capReasons(rs),
    });
  }

  return finishBuild(shared, days, bases, legsUsed, (d) => d.items.length === 0 && d.day !== 1 && d.day !== nDays);
}

/** What both paths (one base, several) share once the picks are classified. */
interface Shared {
  b: PlanBuildInput;
  input: EngineInput;
  table: DriveTable;
  nights: number;
  areas: readonly { place: EnginePlace; members: number }[];
  picked: readonly EnginePlace[];
  misses: ReadonlyMap<string, PlanMiss>;
}

/** Areas, Did not fit, spare days, the basis and the matrix: the same for one base or several. */
function finishBuild(s: Shared, days: PlanDayOut[], bases: PlanBaseOut[], legsUsed: readonly boolean[], isSpare: (d: PlanDayOut) => boolean): PlanBuild {
  const { b, input, table, nights, areas, picked, misses } = s;
  const placedRefs = new Set(days.flatMap((d) => d.items.map((i) => i.ref)));
  const areasOut: PlanAreaOut[] = areas.map(({ place: a, members }) => {
    const inside = picked.filter((p) => inArea(p, a));
    return {
      ref: a.ref,
      slug: a.slug,
      name: a.name,
      members,
      code: members === 0 ? "TB_AREA_EMPTY" : null,
      reasons: [members === 0 ? R.areaEmpty(a.name) : R.areaPinned(a.name, members, inside.every((p) => p.kind === "trail"))],
    };
  });

  const didNotFit = b.picks.flatMap((p) => (misses.has(p.ref) && !placedRefs.has(p.ref) ? [misses.get(p.ref)!] : []));
  const timeMisses = didNotFit.some((m) => m.code === "TB_TIME");
  // a day trip has no spare day; a longer plan's empty full days are offered as suggestions near the base, never filled (4.5)
  const spareDays = timeMisses || nights === 0 ? 0 : days.filter(isSpare).length;
  const basis = legsUsed.length === 0 ? "estimate" : legsUsed.every(Boolean) ? "routed" : legsUsed.some(Boolean) ? "mixed" : "estimate";

  return {
    engine: BUILDER_ENGINE,
    basis,
    bases,
    ...(areasOut.length ? { areas: areasOut } : {}),
    days,
    didNotFit,
    spareDays,
    matrix: matrixOf(b, input, table),
  };
}

/** The multi-base path's inputs: the shared ones plus what classification produced. */
interface MultiCtx extends Shared {
  profile: Profile;
  near: boolean;
  radius: number;
  points: ReadonlyMap<string, EnginePoint>;
  stops: readonly Stop[];
  kept: ReadonlyMap<string, { day: number; rank: number; locked: boolean }>;
  towns: readonly EngineTown[];
  chosen: readonly ChosenBase[];
  miss: (ref: string, code: PlanMiss["code"], fix: PlanMiss["fix"], reasons: PlanReason[]) => void;
}

/** One layout of the stops over the bases for a number of nights: the shares, the route, the days and what each day takes. */
interface Layout {
  /** nights per chosen base, in the visitor's order */
  nightsBy: number[];
  /** indices into `chosen` of the bases with nights, in order */
  route: number[];
  frame: MultiDay[];
  /** stop node to its route index (kept stops: the base of their day) */
  owner: Map<string, number>;
  /** stops beyond the reach of every base with nights, with the nearest base (an index into `chosen`) */
  far: { stop: Stop; nearest: { index: number; min: number; routed: boolean } | null }[];
  refsByDay: Map<number, string[]>;
  unplaced: Set<string>;
}

/**
 * Several bases chosen by the visitor (TB-E2; trip-builder 4.5, 4.6): each stop goes to the base nearest to it in drive, the nights
 * are shared out by demand (bases.ts), the days run base by base with a move day between two consecutive bases (moves.ts), and each
 * base's days are packed with its own stops (pack.ts). A stop beyond the day-trip radius of every base is TB_TOO_FAR, naming the
 * nearest; "Add N days" reruns the same layout with 1 to 3 more nights.
 */
function buildMulti(c: MultiCtx): PlanBuild {
  const { b, input, table, nights, profile, near, radius, stops, kept, towns, chosen, miss } = c;
  const nDays = nights + 1;
  const dayMin = Math.max(0, dayCapMin(profile) - BUILDER_PACK.mealAllowanceMin);
  const drive = dayDriveMin(b);
  const edgeShare = edgeShareOf(near);
  const all = chosen.map((_, i) => i);
  const visitOf = new Map(stops.map((s) => [s.place.ref, visitMinOf(s.place, profile)]));
  const free = stops.filter((s) => !kept.has(s.place.ref));
  const cost = (a: string, z: string): number | null => table.minutes(a, z);

  // demand per chosen base (4.5), in minutes: its stops' visits and round trips, and half a day per move day that touches it
  const demand = all.map(() => 0);
  for (const s of free) {
    const hit = nearestBase(s.node, chosen, all, table);
    if (!hit || hit.min > radius) continue;
    const back = table.minutes(s.node, chosen[hit.index]!.node) ?? hit.min;
    demand[hit.index]! += visitOf.get(s.place.ref)! + hit.min + back;
  }
  const moveDemand = Math.round(BUILDER_BASES.moveDayDemandShare * dayMin);
  all.forEach((i) => {
    demand[i]! += moveDemand * (chosen.length === 1 ? 0 : i === 0 || i === chosen.length - 1 ? 1 : 2);
  });

  const outer = (first: boolean, route: readonly number[]): string =>
    near && input.start ? START : !near && input.gateway ? GATEWAY : chosen[route[first ? 0 : route.length - 1]!]!.node;

  const layout = (n: number): Layout => {
    const nightsBy = shareNights(n, chosen.map((x) => x.nights), demand);
    const route = all.filter((i) => nightsBy[i]! >= 1);
    const frame = routeFrame({
      route: route.map((i) => ({ node: chosen[i]!.node, nights: nightsBy[i]! })),
      nights: n,
      inNode: outer(true, route),
      outNode: outer(false, route),
      dayMin,
      driveMin: drive,
      edgeShare,
      table,
    });
    const owner = new Map<string, number>();
    const far: Layout["far"] = [];
    for (const s of stops) {
      const k = kept.get(s.place.ref);
      if (k) {
        owner.set(s.node, frame[k.day - 1]!.owner); // what the person placed stays on its day, however far (the day checks say so)
        continue;
      }
      const hit = nearestBase(s.node, chosen, route, table);
      if (!hit || hit.min > radius) {
        far.push({ stop: s, nearest: hit ?? nearestBase(s.node, chosen, all, table) });
        continue;
      }
      owner.set(s.node, route.indexOf(hit.index));
    }
    const refsByDay = new Map<number, string[]>();
    const unplaced = new Set<string>();
    route.forEach((ci, ri) => {
      const days = frame.filter((d) => d.owner === ri);
      const at = chosen[ci]!.town.point;
      const mine = stops.filter((s) => owner.get(s.node) === ri);
      const packStops: PackStop[] = mine.map((s) => {
        const k = kept.get(s.place.ref);
        return {
          ref: s.node,
          visitMin: visitOf.get(s.place.ref)!,
          must: s.must,
          score: s.score,
          bearing: s.place.point ? bearingOf(at, s.place.point) : null,
          ...(k ? { fixed: { day: k.day, rank: k.rank } } : {}),
        };
      });
      const packed = packDays({ stops: packStops, days, cost });
      for (const d of packed.days) refsByDay.set(d.day, d.refs);
      for (const r of packed.unplaced) unplaced.add(r);
    });
    return { nightsBy, route, frame, owner, far, refsByDay, unplaced };
  };

  const L = layout(nights);
  const inRoute = new Set(L.route.map((i) => chosen[i]!.town.id));

  // ---- too far from every base: the nearest named, a town near it offered ----
  const farOf = all.map(() => 0);
  for (const { stop: s, nearest } of L.far) {
    if (nearest) farOf[nearest.index]! += 1;
    const alt = towns
      .filter((t) => !inRoute.has(t.id))
      .map((t) => ({ t, d: table.minutes(townNode(t.id), s.node) }))
      .filter((x): x is { t: EngineTown; d: number } => x.d !== null && x.d <= radius)
      .sort((x, y) => x.d - y.d || cmp(x.t.id, y.t.id))[0];
    const fix: PlanMiss["fix"] = alt ? { kind: "add_base", town: alt.t.id } : { kind: "add_base" };
    miss(s.place.ref, "TB_TOO_FAR", fix, [R.missTooFarBases(nearest?.min ?? null, nearest ? chosen[nearest.index]!.town.name : null, radius, nearest ? !nearest.routed : false)]);
  }

  // ---- time: the smallest "Add N days" that fits each left-out stop, by the same layout with more nights ----
  if (L.unplaced.size) {
    const fitsWith = new Map<string, number>();
    for (let k = 1; k <= BUILDER_PACK.addDaysMax && fitsWith.size < L.unplaced.size; k++) {
      if (nights + k > PLAN_LIMITS.nights || (near && nights + k > PLAN_LIMITS.nearNights)) break;
      const more = layout(nights + k);
      for (const n of L.unplaced) if (!fitsWith.has(n) && more.owner.has(n) && !more.unplaced.has(n)) fitsWith.set(n, k);
    }
    for (const s of stops) {
      if (!L.unplaced.has(s.node)) continue;
      const k = fitsWith.get(s.node) ?? null;
      miss(s.place.ref, "TB_TIME", k === null ? { kind: "drop" } : { kind: "add_days", days: k }, [R.missTime(nDays, k, BUILDER_PACK.addDaysMax)]);
    }
  }

  // ---- schedule ----
  const byNode = new Map(stops.map((s) => [s.node, s.place]));
  const townByNode = new Map(chosen.map((x) => [x.node, x.town]));
  const townOf = (node: string): EngineTown | null => townByNode.get(node) ?? null;
  const legsUsed: boolean[] = [];
  const days: PlanDayOut[] = [];
  for (const f of L.frame) {
    const places = (L.refsByDay.get(f.day) ?? []).map((n) => byNode.get(n)!);
    const tl = scheduleDay(dayInput(f, places, input, townOf, nights, table), profile);
    const move = f.move
      ? moveCheck({ fromName: townOf(f.from)!.name, toName: townOf(f.to)!.name, min: f.moveMin, routed: f.moveRouted, driveMin: drive, dayMin })
      : null;
    const sleeps = f.sleeps === null ? null : chosen[L.route[f.sleeps]!]!.town.id;
    days.push(dayOut(f, tl, places, kept, table, legsUsed, sleeps, move));
  }

  // ---- explain: every chosen base, in the visitor's order ----
  const ofPicks = stops.length;
  const bases: PlanBaseOut[] = chosen.map((x, i) => {
    const n = L.nightsBy[i]!;
    if (n === 0) return { town: x.town.id, name: x.town.name, nights: 0, pinned: x.pinned, picks: 0, reasons: [R.baseNoNights(x.town.name, nights)] };
    const ri = L.route.indexOf(i);
    const mine = free.filter((s) => L.owner.get(s.node) === ri);
    let maxMin = 0;
    let est = false;
    for (const s of mine) {
      const cell = table.get(x.node, s.node);
      maxMin = Math.max(maxMin, cell.min ?? 0);
      if (!cell.routed) est = true;
    }
    const ownDays = new Set(L.frame.filter((d) => d.owner === ri).map((d) => d.day));
    const placedHere = days.filter((d) => ownDays.has(d.day)).reduce((k, d) => k + d.items.length, 0);
    const rs: (PlanReason | null)[] = [R.baseShare(ri + 1, x.town.name, n, mine.length, ofPicks, maxMin, est)];
    if (x.pinned) rs.push(R.basePinned(n));
    if (farOf[i]) rs.push(R.baseOutOfReach(farOf[i]!, radius));
    if (ri === 0 && near && input.start) {
      const s0 = table.get(START, x.node);
      if (s0.min !== null) rs.push(R.baseFromStart(x.town.name, s0.min, !s0.routed));
    }
    rs.push(R.baseLodging(x.town.lodging ?? 0));
    return { town: x.town.id, name: x.town.name, nights: n, pinned: x.pinned, picks: placedHere, reasons: R.capReasons(rs) };
  });

  return finishBuild(c, days, bases, legsUsed, (d) => d.items.length === 0 && !d.move && d.day !== 1 && d.day !== nDays);
}

/** The days of one base: their start and end nodes and budgets (4.5, 4.6). `hub` stands in for a missing base. */
function dayFrame(
  b: PlanBuildInput,
  nights: number,
  near: boolean,
  baseNode: string | null,
  hub: string | null,
  hasStart: boolean,
  hasGateway: boolean,
  profile: Profile,
  table: DriveTable,
): (PackDay & { kind: DayKind })[] {
  const cap = dayCapMin(profile);
  const drive = dayDriveMin(b);
  const at = baseNode ?? hub ?? "v";
  if (nights === 0) {
    const home = near && hasStart ? START : at;
    // a day trip from the start: there and back within the one-way limit each way
    const driveCap = near && b.where.mode === "near" ? Math.max(drive, 2 * b.where.driveLimitMin) : drive;
    return [{ day: 1, from: home, to: home, budgetMin: Math.max(0, cap - BUILDER_PACK.mealAllowanceMin), driveCapMin: driveCap, kind: "normal" }];
  }
  const inNode = near && hasStart ? START : !near && hasGateway ? GATEWAY : at;
  const share = BUILDER_PACK.edgeDayShare[near ? "near" : "trip"];
  const edgeBudget = (from: string, to: string): number =>
    Math.max(0, Math.round((cap - BUILDER_PACK.mealAllowanceMin) * share) - (from === to ? 0 : table.minutes(from, to) ?? 0));
  const out: (PackDay & { kind: DayKind })[] = [];
  for (let day = 1; day <= nights + 1; day++) {
    if (day === 1) out.push({ day, from: inNode, to: at, budgetMin: edgeBudget(inNode, at), driveCapMin: drive, kind: "arrival" });
    else if (day === nights + 1) out.push({ day, from: at, to: inNode, budgetMin: edgeBudget(at, inNode), driveCapMin: drive, kind: "departure" });
    else out.push({ day, from: at, to: at, budgetMin: Math.max(0, cap - BUILDER_PACK.mealAllowanceMin), driveCapMin: drive, kind: "normal" });
  }
  return out;
}

const nameOfNode = (node: string, town: EngineTown | null): string => (node === START ? "your start" : node === GATEWAY ? "the airport" : town?.name ?? "your base");
/** The town a node names, for the scheduler's base names and points (K = 1: the one base for every town node). */
type TownOf = (node: string) => EngineTown | null;

/** One day as the scheduler takes it, with the engine's drive figures as its stored legs. */
function dayInput(
  f: PackDay & { kind: DayKind },
  places: readonly EnginePlace[],
  input: EngineInput,
  townOf: TownOf,
  nights: number,
  table: DriveTable,
): ScheduleDayInput {
  const b = input.build;
  const pointOf = (node: string): { lat: number; lon: number } | null => {
    const p = node === START ? input.start : node === GATEWAY ? input.gateway : node.startsWith("t:") ? townOf(node)?.point ?? null : null;
    return p ? { lat: p.lat, lon: p.lon } : null;
  };
  const ref = (node: string): BaseRef => ({ name: nameOfNode(node, townOf(node)), placeSlug: null, point: pointOf(node) });
  const stay = nights === 0 ? f.from : f.kind === "arrival" ? f.to : f.from;
  const base: BaseRef | null = stay === "v" ? null : ref(stay);
  const origin: PlaceRef | null = f.kind === "arrival" && f.from !== f.to && f.from !== "v" ? ref(f.from) : null;
  // the departure's way out, or a move day's next base (TB-E2: the scheduler's `transfer` day ends with the check-in there)
  const nextBase: BaseRef | null = (f.kind === "departure" || f.kind === "transfer") && f.to !== f.from && f.to !== "v" ? ref(f.to) : null;
  const items = places.map(itemOf);
  // stored legs between every pair the scheduler may drive on this day, from the drive table (routed or the model, ≈)
  const ends: { id: string; node: string }[] = [
    ...(base && stay !== "v" ? [{ id: "base", node: stay }] : []),
    ...(origin ? [{ id: "origin", node: f.from }] : []),
    ...(nextBase ? [{ id: "next-base", node: f.to }] : []),
    ...places.map((p) => ({ id: p.ref, node: placeNode(p.ref) })),
  ];
  const legs: StoredLeg[] = [];
  for (const x of ends) {
    for (const y of ends) {
      if (x.id === y.id) continue;
      const c = table.get(x.node, y.node);
      if (c.min === null) continue;
      legs.push({ from: x.id, to: y.id, mode: "drive", minutes: c.min, km: null, basis: c.routed ? "routed" : "estimate", estimate: !c.routed, symmetric: false });
    }
  }
  const sunAt = base?.point ?? items.find((i) => i.point)?.point ?? null;
  return {
    day: f.day,
    kind: f.kind,
    tz: input.tz,
    base,
    nextBase,
    sunPoint: sunAt,
    sunWindow: b.month ? { from: [b.month, 1], to: [b.month, 28] } : null,
    variants: [{ key: "main", label: "Plan", audience: "any", relation: "alternative", items, rank: 0 }],
    legs,
    start: null,
    origin,
    homeBy: null,
    splitNote: null,
  };
}

const minOfClock = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** A scheduled day as the build answer carries it: the stops with their times and drives, the drive home, the day checks. */
function dayOut(
  f: PackDay & { kind: DayKind },
  tl: DayTimeline,
  places: readonly EnginePlace[],
  kept: ReadonlyMap<string, { day: number; rank: number; locked: boolean }>,
  table: DriveTable,
  legsUsed: boolean[],
  /** the base slept at after this day (null on a day trip and the last day) */
  sleeps: string | null,
  /** a move day (TB-E2): its reasons and checks go first; with no stop on it, `returnMin` is the move itself */
  move: { reasons: readonly PlanReason[]; warnings: readonly string[] } | null = null,
): PlanDayOut {
  const own = new Map(places.map((p) => [p.ref, p]));
  const entries = tl.entries.filter((e) => e.lane === "all" || e.lane === tl.lanes[0]);
  const items: PlanItemOut[] = [];
  let pending: { min: number; routed: boolean }[] = [];
  let afterLast: { min: number; routed: boolean }[] = [];
  for (const e of entries) {
    if (e.kind === "leg") {
      const leg = { min: e.durationMin, routed: e.leg?.basis === "routed" };
      pending.push(leg);
      afterLast.push(leg);
      continue;
    }
    if ((e.kind === "visit" || e.kind === "trail") && e.sourceItemId && own.has(e.sourceItemId) && !items.some((i) => i.ref === e.sourceItemId)) {
      const p = own.get(e.sourceItemId)!;
      const drive = pending.length ? pending.reduce((n, l) => n + l.min, 0) : null;
      const routed = pending.length > 0 && pending.every((l) => l.routed);
      pending.forEach((l) => legsUsed.push(l.routed));
      items.push({
        ref: p.ref,
        slug: p.slug,
        name: p.name,
        startMin: Math.min(2879, minOfClock(e.start)),
        visitMin: Math.min(1440, e.durationMin),
        driveMin: drive === null ? null : Math.min(1440, drive),
        basis: drive === null ? null : routed ? "routed" : "estimate",
        locked: kept.get(p.ref)?.locked ?? false,
      });
      pending = [];
      afterLast = [];
    }
  }
  // stops the scheduler did not time (a day with no room, a variant that does not fit) are still on the day, untimed
  for (const p of places) {
    if (items.some((i) => i.ref === p.ref)) continue;
    items.push({ ref: p.ref, slug: p.slug, name: p.name, startMin: null, visitMin: 0, driveMin: null, basis: null, locked: kept.get(p.ref)?.locked ?? false });
  }
  afterLast.forEach((l) => legsUsed.push(l.routed));
  const drivesOn = items.length > 0 || (move !== null && move.warnings.every((w) => w !== "W_NO_ROUTE"));
  const returnMin = drivesOn && afterLast.length ? Math.min(1440, afterLast.reduce((n, l) => n + l.min, 0)) : null;
  const warnings = [...new Set([...tl.warnings.map((w) => w.code as string), ...(move?.warnings ?? [])].filter((c) => PLAN_WARNING_RE.test(c)))].slice(0, PLAN_LIMITS.warnings);

  const rs: (PlanReason | null)[] = [...(move?.reasons ?? [])];
  const keptHere = places.filter((p) => kept.get(p.ref)?.day === f.day).length;
  if (keptHere) rs.push(R.dayKept(keptHere));
  if (places.length >= 2) {
    let best: { a: EnginePlace; b: EnginePlace; c: { min: number | null; routed: boolean } } | null = null;
    for (let i = 0; i + 1 < places.length; i++) {
      const c = table.get(placeNode(places[i]!.ref), placeNode(places[i + 1]!.ref));
      if (c.min !== null && (best === null || c.min < best.c.min!)) best = { a: places[i]!, b: places[i + 1]!, c };
    }
    if (best) rs.push(R.dayPair(best.a.name, best.b.name, best.c.min!, !best.c.routed));
  }
  const driven = items.reduce((n, i) => n + (i.driveMin ?? 0), 0) + (returnMin ?? 0);
  if (items.length) rs.push(R.dayDriving(driven, items.some((i) => i.basis === "estimate")));

  return { day: f.day, base: sleeps, move: move !== null, items, returnMin, warnings, reasons: R.capReasons(rs) };
}

/** The picks' drive matrix (4.10): every pick with a point that is not an area (TB-PIN), in the build's order; estimate cells listed. */
function matrixOf(b: PlanBuildInput, input: EngineInput, table: DriveTable): PlanMatrix {
  const refs = b.picks
    .map((p) => p.ref)
    .filter((r) => {
      const p = input.places.get(r);
      return !!p?.point && !isAreaPlace(p);
    })
    .slice(0, PLAN_LIMITS.picks);
  const n = refs.length;
  const minutes: number[][] = [];
  const estimated: number[] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      const c = table.get(placeNode(refs[i]!), placeNode(refs[j]!));
      row.push(Math.min(1440, c.min ?? 1440));
      if (i !== j && !c.routed) estimated.push(i * n + j);
    }
    minutes.push(row);
  }
  return { refs, minutes, estimated };
}
