// The trip builder engine, v1 (trip-builder.md 4.2 to 4.11; FLOW TF7, TF8, TF11; task TB-E1): one base or none (K = 1), the first
// slice FS-1. Pure, synchronous and deterministic: the same EngineInput gives the same PlanBuild, byte for byte (no clock, no random
// number, integer minutes, every sort ends on a ref). The build time (`builtAt`) is the caller's to add.
//
//   1 classify  each pick: not listed or no point (TB_UNKNOWN), closed in the month (TB_CLOSED), not for the party (TB_FIT), or a stop
//   2 base      nights >= 1: the pinned or accepted base when it is a candidate town, else the town that minimises the round trips to
//               the picks (plus the drive from the start, near mode, or the gateway), a pick out of reach costing a few radii (more
//               for a must), less the lodging signal; ties by population, then id. Nights 0: no base (near mode starts and ends at
//               the start; trip mode goes out from the best town)
//   3 radius    a pick beyond the day-trip radius of the base (half the day's driving, capped) is TB_TOO_FAR with "Add a base near it"
//   4 pack      pack.ts: kept stops first (locked, placed by the person, from our trip: TF11), then the musts, then by score
//   5 time      a stop no day can take is TB_TIME, with the smallest "Add N days" that fits it (the engine reruns with 1 to 3 more)
//   6 schedule  each day through `scheduleDay` (times, meals, sun, the day checks), with the engine's drive figures as its legs
//   7 explain   reasons from the numbers used (reasons.ts); the picks matrix for the client re-flow
//
// Never reads the home point or the environment: the near-mode start arrives as a public point the service resolved from a hub, an
// airport or a towns-layer town, and it is only ever passed to the model, never to a cache key, and never returned.
import { BUILDER_ENGINE, BUILDER_PACK } from "../config/builder.ts";
import { PACE_RULES, dayCapMin, resolveDuration } from "../schedule/rules.ts";
import { scheduleDay } from "../schedule/schedule.ts";
import type { BaseRef, DayKind, DayTimeline, PlaceRef, Profile, ScheduleDayInput, ScheduleItem, StoredLeg } from "../schedule/types.ts";
import type { PlanBuild, PlanBuildInput, PlanMatrix } from "../schema/api/plan.ts";
import { PLAN_LIMITS, PLAN_WARNING_RE, type PlanBaseOut, type PlanDayOut, type PlanItemOut, type PlanMiss, type PlanReason } from "../schema/plan-draft.ts";
import { GATEWAY, START, driveTable, placeNode, townNode, type DriveTable } from "./driveTable.ts";
import type { EngineInput, EnginePlace, EnginePoint, EngineTown } from "./engineTypes.ts";
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
  for (const pick of b.picks) {
    const place = input.places.get(pick.ref);
    if (!place) {
      miss(pick.ref, "TB_UNKNOWN", { kind: "drop" }, [R.missUnknown(false)]);
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
    .map((t) => ({ t, n: stops.filter((s) => (table.minutes(townNode(t.id), s.node) ?? Number.POSITIVE_INFINITY) <= radius).length }))
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
    const tl = scheduleDay(dayInput(f, places, input, base?.town ?? null, nights, table), profile);
    const out = dayOut(f, tl, places, kept, table, legsUsed, base?.town.id ?? null, nights);
    days.push(out);
  }

  // ---- 7 explain ----
  const placedRefs = new Set(days.flatMap((d) => d.items.map((i) => i.ref)));
  const bases: PlanBaseOut[] = [];
  if (base && nights >= 1) {
    const rs: (PlanReason | null)[] = [];
    if (pinnedTown && chosenInput?.pinned) rs.push(R.basePinned(nights));
    rs.push(R.baseCovers(base.covered, stops.length, base.avg, base.max, base.estimated));
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

  const didNotFit = b.picks.flatMap((p) => (misses.has(p.ref) && !placedRefs.has(p.ref) ? [misses.get(p.ref)!] : []));
  const timeMisses = didNotFit.some((m) => m.code === "TB_TIME");
  // a day trip has no spare day; a longer plan's empty full days are offered as suggestions near the base, never filled (4.5)
  const spareDays = timeMisses || nights === 0 ? 0 : days.filter((d) => d.items.length === 0 && d.day !== 1 && d.day !== nDays).length;
  const basis = legsUsed.length === 0 ? "estimate" : legsUsed.every(Boolean) ? "routed" : legsUsed.some(Boolean) ? "mixed" : "estimate";

  return { engine: BUILDER_ENGINE, basis, bases, days, didNotFit, spareDays, matrix: matrixOf(b, input, table) };
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

/** One day as the scheduler takes it, with the engine's drive figures as its stored legs. */
function dayInput(
  f: PackDay & { kind: DayKind },
  places: readonly EnginePlace[],
  input: EngineInput,
  town: EngineTown | null,
  nights: number,
  table: DriveTable,
): ScheduleDayInput {
  const b = input.build;
  const pointOf = (node: string): { lat: number; lon: number } | null => {
    const p = node === START ? input.start : node === GATEWAY ? input.gateway : node.startsWith("t:") ? town?.point ?? null : null;
    return p ? { lat: p.lat, lon: p.lon } : null;
  };
  const ref = (node: string): BaseRef => ({ name: nameOfNode(node, town), placeSlug: null, point: pointOf(node) });
  const stay = nights === 0 ? f.from : f.kind === "arrival" ? f.to : f.from;
  const base: BaseRef | null = stay === "v" ? null : ref(stay);
  const origin: PlaceRef | null = f.kind === "arrival" && f.from !== f.to && f.from !== "v" ? ref(f.from) : null;
  const nextBase: BaseRef | null = f.kind === "departure" && f.to !== f.from && f.to !== "v" ? ref(f.to) : null;
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
  baseId: string | null,
  nights: number,
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
  const returnMin = items.length && afterLast.length ? Math.min(1440, afterLast.reduce((n, l) => n + l.min, 0)) : null;
  const warnings = [...new Set(tl.warnings.map((w) => w.code as string).filter((c) => PLAN_WARNING_RE.test(c)))].slice(0, PLAN_LIMITS.warnings);

  const rs: (PlanReason | null)[] = [];
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

  const sleeps = nights >= 1 && f.day <= nights ? baseId : null;
  return { day: f.day, base: sleeps, move: false, items, returnMin, warnings, reasons: R.capReasons(rs) };
}

/** The picks' drive matrix (4.10): every pick with a point, in the build's order; estimate cells listed. */
function matrixOf(b: PlanBuildInput, input: EngineInput, table: DriveTable): PlanMatrix {
  const refs = b.picks.map((p) => p.ref).filter((r) => input.places.get(r)?.point).slice(0, PLAN_LIMITS.picks);
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
