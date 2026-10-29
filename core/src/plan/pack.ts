// Stage 4 of the trip builder engine: packing and ordering the days of one base (trip-builder.md 4.6; tasks TB-E1, RB-001, RB-005).
// Pure, deterministic and abstract: stops and days are ids and minutes, the drive between two nodes is a callback, so the same code runs
// on the server build and on a client re-flow with the picks matrix (TB-E4).
//
//   1 fixed first   a kept stop (locked, placed by the person, from our trip) keeps its day and its order there, whatever the budget
//   2 seed          the free stops, swept by bearing from the base, fill the days IN ORDER from the first day: each day takes stops up
//                   to its quota (the pace's stops a day, `perDay`, or more when there are more stops than days) while they fit its
//                   budget and driving cap, and a stop within `clusterMin` of one already on the day may join it as one more beyond
//                   the quota (Lake Louise and Moraine Lake). Every rotation of the sweep is tried; the one that leaves out fewest musts, then
//                   fewest stops, then drives least, wins.
//                   So the stops are spread over the days, never piled on one, and the days left over are at the end (spare days)
//   3 order         each day exactly (Held-Karp, start and end fixed) up to BUILDER_PACK.exactOrderMax stops, 2-opt beyond; a day
//                   with a kept stop keeps the kept order and takes free stops by cheapest insertion
//   4 repair        while a day is over its budget or its driving cap, its lowest free stop (not a must, lowest score, then ref)
//                   moves to the day that takes it for the least added drive (a day under its quota first, then a day out from the
//                   base before a day with a way in, out or a move), else it is left out
//   5 improve       first-improvement relocations (never past a day's quota) and swaps between the days out from the base that lower
//                   the total drive and keep every cap, at most BUILDER_PACK.localSearchMoves, scanned in ref order (a day with a
//                   way in, out or a move keeps what the seed gave it: a stop on its line, never one pulled off a spare day)
//   5b level        while a day is empty and another holds more than the quota (and at least two), the stop that costs least to
//                   move goes to the empty day: a day with nothing to do only when there is nothing left to give it
//   6 retry         a left-out stop takes any room the moves freed; then a day with a way in or out takes one no day could, up to
//                   its soft driving cap (`softDriveCapMin`: the day's checks then say it drives long, which beats leaving it out)
//   7 musts         a must-see is never left out (FLOW TF11, factor 4c; review RB-005): one no day can take goes on the day it
//                   overloads least, and is reported in `over` so the engine says the day is over the pace and how many days fit it
//   8 spare last    among days that are the same (same ends, budget and cap, nothing kept), the empty ones move to the end
//
// Every sort ends on the ref, every comparison is strict, and nothing reads a clock or a random number: the same input gives the same
// days.
import { BUILDER_PACK } from "../config/builder.ts";

export interface PackStop {
  ref: string;
  /** minutes on site */
  visitMin: number;
  must: boolean;
  score: number;
  /** bearing from the base in degrees (0 to 360), for the sweep; null: after every bearing */
  bearing: number | null;
  /** a kept stop: its day and its rank among the kept stops of that day */
  fixed?: { day: number; rank: number };
}

export interface PackDay {
  day: number;
  /** the node the day starts and ends at (a base, the start, a gateway); equal for a day out from a base */
  from: string;
  to: string;
  /** minutes the day offers to visits and the driving beyond the direct way from `from` to `to` */
  budgetMin: number;
  /** minutes of driving beyond the direct way the day allows (`driveDayMin`) */
  driveCapMin: number;
  /**
   * a day with a way in or out may take a stop no other day can, up to this much driving beyond the way (its scheduler checks then say
   * the day drives long); absent: `driveCapMin`
   */
  softDriveCapMin?: number;
}

export interface PackInput {
  stops: readonly PackStop[];
  days: readonly PackDay[];
  /** minutes from node a to node b; null when there is no road */
  cost: (a: string, b: string) => number | null;
  /** stops a day takes before the next day gets one (the pace's, BUILDER_PACK.stopsPerDay); absent: the standard pace's */
  perDay?: number;
  /** a stop this close (minutes, either way) to one already on a day joins it beyond the quota; absent: BUILDER_PACK.clusterMin */
  clusterMin?: number;
}

export interface PackedDay {
  day: number;
  refs: string[];
  /** visits plus driving beyond the direct way */
  loadMin: number;
  /** the whole day's driving, from `from` through every stop to `to` */
  driveMin: number;
  /** driving beyond the direct way */
  extraDriveMin: number;
}

export interface PackResult {
  days: PackedDay[];
  /** refs on no day, in the input's order (never a must with a road to it) */
  unplaced: string[];
  /** musts placed on a day that could not take them within its budget or cap (step 7), in the input's order */
  over: string[];
}

const INF = Number.POSITIVE_INFINITY;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Pack the stops into the days (the header's steps 1 to 8). */
export function packDays(input: PackInput): PackResult {
  const stops = new Map(input.stops.map((s) => [s.ref, s]));
  const days = [...input.days].sort((a, b) => a.day - b.day);
  const dayOf = new Map(days.map((d) => [d.day, d]));
  const c = (a: string, b: string): number => (a === b ? 0 : input.cost(a, b) ?? INF);
  const clusterMin = input.clusterMin ?? BUILDER_PACK.clusterMin;
  const routeDrive = (d: PackDay, refs: readonly string[]): number => {
    let t = 0;
    let at = d.from;
    for (const r of refs) {
      t += c(at, r);
      at = r;
    }
    return t + c(at, d.to);
  };
  const direct = (d: PackDay): number => c(d.from, d.to);
  const visits = (refs: readonly string[]): number => refs.reduce((n, r) => n + stops.get(r)!.visitMin, 0);
  const extraOf = (d: PackDay, refs: readonly string[]): number => routeDrive(d, refs) - direct(d);
  let soft = false;
  const capOf = (d: PackDay): number => (soft ? Math.max(d.driveCapMin, d.softDriveCapMin ?? d.driveCapMin) : d.driveCapMin);
  const fits = (d: PackDay, refs: readonly string[]): boolean => {
    const extra = extraOf(d, refs);
    return extra !== INF && extra <= capOf(d) && visits(refs) + extra <= d.budgetMin;
  };
  const isFixed = (r: string): boolean => stops.get(r)!.fixed !== undefined;

  // ---- 1 fixed first ----
  const fixedPlan = new Map<number, string[]>(days.map((d) => [d.day, []]));
  const fixed = input.stops.filter((s) => s.fixed && dayOf.has(s.fixed.day)).sort((a, b) => a.fixed!.day - b.fixed!.day || a.fixed!.rank - b.fixed!.rank || cmp(a.ref, b.ref));
  for (const s of fixed) fixedPlan.get(s.fixed!.day)!.push(s.ref);
  const free = input.stops.filter((s) => !(s.fixed && dayOf.has(s.fixed.day)));

  // the quota: the pace's stops a day, or more when the stops outnumber the days that have room at all
  const roomy = days.filter((d) => d.budgetMin > 0).length;
  const quota = Math.max(1, input.perDay ?? BUILDER_PACK.stopsPerDay.standard, Math.ceil(free.length / Math.max(1, roomy)));
  const close = (r: string, refs: readonly string[]): boolean => refs.some((x) => x !== r && (c(x, r) <= clusterMin || c(r, x) <= clusterMin));
  /** may a day holding `refs` take `r`: under the quota, or close to a stop it already holds */
  const canTake = (refs: readonly string[], r: string): boolean => refs.length < quota || (refs.length < quota + BUILDER_PACK.clusterExtra && close(r, refs));

  const cheapestInsert = (d: PackDay, refs: readonly string[], r: string): { refs: string[]; added: number } => {
    let best: string[] = [...refs, r];
    let bestCost = INF;
    const base = routeDrive(d, refs);
    for (let i = 0; i <= refs.length; i++) {
      const prev = i === 0 ? d.from : refs[i - 1]!;
      const next = i === refs.length ? d.to : refs[i]!;
      const add = c(prev, r) + c(r, next) - c(prev, next);
      if (add < bestCost) {
        bestCost = add;
        best = [...refs.slice(0, i), r, ...refs.slice(i)];
      }
    }
    return { refs: best, added: base === INF ? INF : bestCost };
  };

  // ---- 2 seed: fill the days in order from a rotation of the sweep; the rotation that places most, then drives least ----
  const sweep = [...free].sort((a, b) => (a.bearing ?? 999) - (b.bearing ?? 999) || cmp(a.ref, b.ref)).map((s) => s.ref);
  const mustsIn = (refs: readonly string[]): number => refs.filter((r) => stops.get(r)!.must).length;
  const seedFrom = (rot: number): { plan: Map<number, string[]>; left: string[]; drive: number } => {
    const queue = [...sweep.slice(rot), ...sweep.slice(0, rot)];
    const plan = new Map<number, string[]>([...fixedPlan].map(([k, v]) => [k, [...v]]));
    let drive = 0;
    for (const d of days) {
      let refs = plan.get(d.day)!;
      for (let i = 0; i < queue.length; ) {
        const r = queue[i]!;
        if (!canTake(refs, r)) {
          i++;
          continue;
        }
        const next = cheapestInsert(d, refs, r).refs;
        if (fits(d, next)) {
          refs = next;
          queue.splice(i, 1);
          i = 0; // the next stop may now be close to this one
        } else i++;
      }
      plan.set(d.day, refs);
      const e = extraOf(d, refs);
      drive += e === INF ? 0 : e;
    }
    return { plan, left: queue, drive };
  };
  let seed = seedFrom(0);
  // a large quota (more stops than days) makes each rotation dear; a few rotations then suffice
  const rotations = quota <= 4 ? sweep.length : Math.min(sweep.length, BUILDER_PACK.seedRotationsMax);
  for (let rot = 1; rot < rotations; rot++) {
    const s = seedFrom(rot);
    const a = mustsIn(s.left) - mustsIn(seed.left);
    if (a < 0 || (a === 0 && (s.left.length < seed.left.length || (s.left.length === seed.left.length && s.drive < seed.drive)))) seed = s;
  }
  const plan = seed.plan;
  const unplaced: string[] = [];

  // ---- 3 order ----
  const order = (d: PackDay, refs: string[]): string[] => {
    const kept = refs.filter(isFixed);
    const loose = refs.filter((r) => !isFixed(r)).sort(cmp);
    if (kept.length) {
      let out = kept.sort((a, b) => stops.get(a)!.fixed!.rank - stops.get(b)!.fixed!.rank || cmp(a, b));
      for (const r of loose) out = cheapestInsert(d, out, r).refs;
      return out;
    }
    return loose.length <= BUILDER_PACK.exactOrderMax ? heldKarp(d.from, d.to, loose, c) : twoOpt(d.from, d.to, loose, c);
  };
  for (const d of days) plan.set(d.day, order(d, plan.get(d.day)!));

  // ---- 4 repair ----
  const priority = (a: string, b: string): number => {
    const x = stops.get(a)!;
    const y = stops.get(b)!;
    // lowest first: not a must before a must, lower score first, then the later ref first
    return Number(x.must) - Number(y.must) || x.score - y.score || cmp(b, a);
  };
  /**
   * The day that takes `r`, with its new order; null: none fits. A day under its quota before one past it, then a day out from the base
   * before a day with a way in, out or a move, then the least added drive.
   */
  const bestHome = (r: string): { day: number; refs: string[] } | null => {
    let best: { day: number; refs: string[]; added: number; rank: number } | null = null;
    for (const d of days) {
      const cur = plan.get(d.day)!;
      const next = cur.some(isFixed) ? cheapestInsert(d, cur, r).refs : order(d, [...cur, r]);
      if (!fits(d, next)) continue;
      const added = routeDrive(d, next) - routeDrive(d, cur);
      const rank = (canTake(cur, r) ? 0 : 2) + (d.from === d.to ? 0 : 1);
      if (best === null || rank < best.rank || (rank === best.rank && added < best.added)) best = { day: d.day, refs: next, added, rank };
    }
    return best ? { day: best.day, refs: best.refs } : null;
  };
  const pending: string[] = [...seed.left];
  for (const d of days) {
    let refs = plan.get(d.day)!;
    while (!fits(d, refs)) {
      const loose = refs.filter((r) => !isFixed(r)).sort(priority);
      if (!loose.length) break; // only kept stops: they stay, and the scheduler's warnings say the day is long
      const out = loose[0]!;
      refs = order(d, refs.filter((r) => r !== out));
      plan.set(d.day, refs);
      pending.push(out);
    }
  }
  // the musts first, then by score, so a must takes the room before a nice-to-have
  pending.sort((a, b) => -priority(a, b));
  for (const r of pending) {
    const home = bestHome(r);
    if (home) plan.set(home.day, home.refs);
    else unplaced.push(r);
  }

  // ---- 5 improve: relocations and swaps that lower the total drive ----
  let moves = 0;
  let improved = true;
  const total = (d: PackDay, refs: readonly string[]): number => routeDrive(d, refs);
  while (improved && moves < BUILDER_PACK.localSearchMoves) {
    improved = false;
    const scan = [...plan.entries()].flatMap(([day, refs]) => refs.filter((r) => !isFixed(r)).map((r) => ({ r, day }))).sort((a, b) => cmp(a.r, b.r));
    for (const { r, day } of scan) {
      const from = dayOf.get(day)!;
      const cur = plan.get(day)!;
      const without = order(from, cur.filter((x) => x !== r));
      const saved = total(from, cur) - total(from, without);
      let best: { day: number; refs: string[]; gain: number } | null = null;
      for (const to of days) {
        if (to.day === day || to.from !== to.to) continue; // a way in, out or a move takes stops in the seed only (on its line)
        const there = plan.get(to.day)!;
        if (!canTake(there, r)) continue;
        const next = there.some(isFixed) ? cheapestInsert(to, there, r).refs : order(to, [...there, r]);
        if (!fits(to, next)) continue;
        const gain = saved - (total(to, next) - total(to, there));
        if (gain > 0 && (best === null || gain > best.gain)) best = { day: to.day, refs: next, gain };
      }
      if (best) {
        plan.set(day, without);
        plan.set(best.day, best.refs);
        moves++;
        improved = true;
        break;
      }
    }
    if (improved || quota > BUILDER_PACK.swapQuotaMax) continue;
    // swaps keep every day's count, so they never pile the stops up
    swaps: for (let i = 0; i < scan.length; i++) {
      for (let j = i + 1; j < scan.length; j++) {
        const x = scan[i]!;
        const y = scan[j]!;
        if (x.day === y.day) continue;
        const dx = dayOf.get(x.day)!;
        const dy = dayOf.get(y.day)!;
        if (dx.from !== dx.to || dy.from !== dy.to) continue;
        const cx = plan.get(x.day)!;
        const cy = plan.get(y.day)!;
        const nx = order(dx, [...cx.filter((r) => r !== x.r), y.r]);
        const ny = order(dy, [...cy.filter((r) => r !== y.r), x.r]);
        if (!fits(dx, nx) || !fits(dy, ny)) continue;
        if (total(dx, nx) + total(dy, ny) < total(dx, cx) + total(dy, cy)) {
          plan.set(x.day, nx);
          plan.set(y.day, ny);
          moves++;
          improved = true;
          break swaps;
        }
      }
    }
  }

  // ---- 5b level: never an empty day while another holds more than the quota (and at least two) ----
  const levelAbove = Math.max(2, quota);
  for (let guard = 0; guard < BUILDER_PACK.localSearchMoves; guard++) {
    const empty = days.filter((d) => plan.get(d.day)!.length === 0);
    if (!empty.length) break;
    const heavy = days.filter((d) => plan.get(d.day)!.length > levelAbove);
    let best: { from: PackDay; to: PackDay; r: string; without: string[]; cost: number } | null = null;
    for (const h of heavy) {
      const cur = plan.get(h.day)!;
      for (const r of cur.filter((x) => !isFixed(x)).sort(cmp)) {
        const without = order(h, cur.filter((x) => x !== r));
        const saved = total(h, cur) - total(h, without);
        for (const e of empty) {
          if (!fits(e, [r])) continue;
          const cost = total(e, [r]) - total(e, []) - saved;
          if (best === null || cost < best.cost || (cost === best.cost && e.day < best.to.day)) best = { from: h, to: e, r, without, cost };
        }
      }
    }
    if (!best) break;
    plan.set(best.from.day, best.without);
    plan.set(best.to.day, [best.r]);
  }

  // ---- 6 retry the left-out stops ----
  const stillOut: string[] = [];
  for (const r of [...unplaced].sort((a, b) => -priority(a, b))) {
    const home = bestHome(r);
    if (home) plan.set(home.day, home.refs);
    else stillOut.push(r);
  }
  // ---- 6b last resort: a day with a way in or out takes a stop no day could, up to its soft driving cap (a Check, never a drop) ----
  soft = true;
  for (const r of [...stillOut]) {
    const home = bestHome(r);
    if (!home) continue;
    plan.set(home.day, home.refs);
    stillOut.splice(stillOut.indexOf(r), 1);
  }
  soft = false;

  // ---- 7 a must is never left out: the day it overloads least takes it ----
  const over = new Set<string>();
  const left: string[] = [];
  for (const r of stillOut) {
    if (!stops.get(r)!.must) {
      left.push(r);
      continue;
    }
    let best: { day: number; refs: string[]; overBy: number; added: number } | null = null;
    for (const d of days) {
      const cur = plan.get(d.day)!;
      const ins = cheapestInsert(d, cur, r);
      if (ins.added === INF) continue;
      const extra = extraOf(d, ins.refs);
      const overBy = Math.max(0, visits(ins.refs) + extra - d.budgetMin) + Math.max(0, extra - d.driveCapMin);
      if (best === null || overBy < best.overBy || (overBy === best.overBy && ins.added < best.added)) best = { day: d.day, refs: ins.refs, overBy, added: ins.added };
    }
    if (best) {
      const d = dayOf.get(best.day)!;
      plan.set(best.day, best.refs.some(isFixed) ? best.refs : order(d, best.refs));
      over.add(r);
    } else left.push(r); // no road from any day: the engine says so
  }

  // ---- 8 spare days last: among days that are the same, the empty ones move to the end ----
  const keyOf = (d: PackDay): string => `${d.from}|${d.to}|${d.budgetMin}|${d.driveCapMin}`;
  const groups = new Map<string, PackDay[]>();
  for (const d of days) if (!plan.get(d.day)!.some(isFixed)) groups.set(keyOf(d), [...(groups.get(keyOf(d)) ?? []), d]);
  for (const same of groups.values()) {
    const lists = same.map((d) => plan.get(d.day)!);
    const sorted = [...lists.filter((l) => l.length > 0), ...lists.filter((l) => l.length === 0)];
    same.forEach((d, i) => plan.set(d.day, sorted[i]!));
  }

  const outSet = new Set(left);
  return {
    days: days.map((d) => {
      const refs = plan.get(d.day)!;
      const driveMin = refs.length ? routeDrive(d, refs) : direct(d);
      const extra = driveMin - direct(d);
      return { day: d.day, refs, loadMin: visits(refs) + extra, driveMin, extraDriveMin: extra };
    }),
    unplaced: input.stops.map((s) => s.ref).filter((r) => outSet.has(r)),
    over: input.stops.map((s) => s.ref).filter((r) => over.has(r)),
  };
}

/** The shortest order of `refs` from `from` to `to` (Held-Karp dynamic programming; ties keep the lower ref order). */
export function heldKarp(from: string, to: string, refs: readonly string[], c: (a: string, b: string) => number): string[] {
  const n = refs.length;
  if (n <= 1) return [...refs];
  const full = (1 << n) - 1;
  const dp = new Float64Array((1 << n) * n).fill(INF);
  const parent = new Int32Array((1 << n) * n).fill(-1);
  for (let i = 0; i < n; i++) dp[(1 << i) * n + i] = c(from, refs[i]!);
  for (let mask = 1; mask <= full; mask++) {
    for (let last = 0; last < n; last++) {
      if (!(mask & (1 << last))) continue;
      const cur = dp[mask * n + last]!;
      if (cur === INF) continue;
      for (let nx = 0; nx < n; nx++) {
        if (mask & (1 << nx)) continue;
        const m2 = mask | (1 << nx);
        const v = cur + c(refs[last]!, refs[nx]!);
        if (v < dp[m2 * n + nx]!) {
          dp[m2 * n + nx] = v;
          parent[m2 * n + nx] = last;
        }
      }
    }
  }
  let bestLast = -1;
  let best = INF;
  for (let last = 0; last < n; last++) {
    const v = dp[full * n + last]! + c(refs[last]!, to);
    if (v < best) {
      best = v;
      bestLast = last;
    }
  }
  if (bestLast < 0) return [...refs];
  const out: string[] = [];
  let mask = full;
  let last = bestLast;
  while (last >= 0) {
    out.push(refs[last]!);
    const p = parent[mask * n + last]!;
    mask &= ~(1 << last);
    last = p;
  }
  return out.reverse();
}

/** Nearest neighbour then 2-opt, for a day longer than the exact limit. */
export function twoOpt(from: string, to: string, refs: readonly string[], c: (a: string, b: string) => number): string[] {
  const left = [...refs];
  const route: string[] = [];
  let at = from;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (c(at, left[i]!) < c(at, left[bi]!)) bi = i;
    at = left.splice(bi, 1)[0]!;
    route.push(at);
  }
  // the whole route's cost, so an asymmetric matrix can never make a "better" swap that is worse (and the loop always ends)
  const total = (r: readonly string[]): number => {
    let t = 0;
    let p = from;
    for (const x of r) {
      t += c(p, x);
      p = x;
    }
    return t + c(p, to);
  };
  let cur = total(route);
  let better = true;
  while (better) {
    better = false;
    for (let i = 0; i < route.length - 1 && !better; i++) {
      for (let k = i + 1; k < route.length; k++) {
        const next = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
        const v = total(next);
        if (v < cur) {
          route.splice(0, route.length, ...next);
          cur = v;
          better = true;
          break;
        }
      }
    }
  }
  return route;
}
