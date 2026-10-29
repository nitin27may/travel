// Stage 4 of the trip builder engine: packing and ordering the days of one base (trip-builder.md 4.6; task TB-E1). Pure, deterministic
// and abstract: stops and days are ids and minutes, the drive between two nodes is a callback, so the same code runs on the server build
// and on a client re-flow with the picks matrix (TB-E4).
//
//   1 fixed first   a kept stop (locked, placed by the person, from our trip) keeps its day and its order there, whatever the budget
//   2 seed          the free stops, swept by bearing from the base, are cut into the days in proportion to each day's budget
//   3 order         each day exactly (Held-Karp, start and end fixed) up to BUILDER_PACK.exactOrderMax stops, 2-opt beyond; a day
//                   with a kept stop keeps the kept order and takes free stops by cheapest insertion
//   4 repair        while a day is over its budget or its driving cap, its lowest free stop (not a must, lowest score, then ref)
//                   moves to the cheapest day that takes it, else it is left out
//   5 improve       first-improvement relocations between days that lower the total drive and keep every cap, at most
//                   BUILDER_PACK.localSearchMoves, scanned in ref order
//   6 retry         a left-out stop takes any room the moves freed, by cheapest insertion
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
}

export interface PackInput {
  stops: readonly PackStop[];
  days: readonly PackDay[];
  /** minutes from node a to node b; null when there is no road */
  cost: (a: string, b: string) => number | null;
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
  /** refs on no day, in the input's order */
  unplaced: string[];
}

const INF = Number.POSITIVE_INFINITY;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Pack the stops into the days (the header's steps 1 to 6). */
export function packDays(input: PackInput): PackResult {
  const stops = new Map(input.stops.map((s) => [s.ref, s]));
  const days = [...input.days].sort((a, b) => a.day - b.day);
  const dayOf = new Map(days.map((d) => [d.day, d]));
  const c = (a: string, b: string): number => (a === b ? 0 : input.cost(a, b) ?? INF);
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
  const fits = (d: PackDay, refs: readonly string[]): boolean => {
    const extra = routeDrive(d, refs) - direct(d);
    return extra !== INF && extra <= d.driveCapMin && visits(refs) + extra <= d.budgetMin;
  };
  const isFixed = (r: string): boolean => stops.get(r)!.fixed !== undefined;

  // ---- 1 fixed first ----
  const plan = new Map<number, string[]>(days.map((d) => [d.day, []]));
  const fixed = input.stops.filter((s) => s.fixed && dayOf.has(s.fixed.day)).sort((a, b) => a.fixed!.day - b.fixed!.day || a.fixed!.rank - b.fixed!.rank || cmp(a.ref, b.ref));
  for (const s of fixed) plan.get(s.fixed!.day)!.push(s.ref);
  const free = input.stops.filter((s) => !(s.fixed && dayOf.has(s.fixed.day)));

  // ---- 2 seed: sweep by bearing, cut in proportion to the budgets ----
  const sweep = [...free].sort((a, b) => (a.bearing ?? 999) - (b.bearing ?? 999) || cmp(a.ref, b.ref));
  const demand = (s: PackStop, d: PackDay): number => s.visitMin + Math.min(2 * c(d.from, s.ref), INF);
  const totalBudget = days.reduce((n, d) => n + Math.max(0, d.budgetMin), 0);
  const unplaced: string[] = [];
  if (days.length && totalBudget > 0) {
    const ref0 = days[0]!;
    const dem = sweep.map((s) => Math.min(demand(s, ref0), 10 * 24 * 60));
    const totalDemand = dem.reduce((n, x) => n + x, 0) || 1;
    // cumulative budget edges per day
    const edges: number[] = [];
    let acc = 0;
    for (const d of days) {
      acc += Math.max(0, d.budgetMin);
      edges.push(acc / totalBudget);
    }
    // the stops fill the days only as far as their demand reaches: a light plan leaves the last days free (spare days, 4.5)
    const scale = Math.min(1, totalDemand / totalBudget);
    let run = 0;
    sweep.forEach((s, i) => {
      const mid = ((run + dem[i]! / 2) / totalDemand) * scale;
      run += dem[i]!;
      let j = edges.findIndex((e) => mid < e);
      if (j < 0) j = days.length - 1;
      plan.get(days[j]!.day)!.push(s.ref);
    });
  } else {
    unplaced.push(...sweep.map((s) => s.ref));
  }

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
  for (const d of days) plan.set(d.day, order(d, plan.get(d.day)!));

  // ---- 4 repair ----
  const priority = (a: string, b: string): number => {
    const x = stops.get(a)!;
    const y = stops.get(b)!;
    // lowest first: not a must before a must, lower score first, then the later ref first
    return Number(x.must) - Number(y.must) || x.score - y.score || cmp(b, a);
  };
  /** The day (other than `except`) that takes `r` for the least added drive, with its new order; null when none fits. */
  const bestHome = (r: string, except: number | null): { day: number; refs: string[] } | null => {
    let best: { day: number; refs: string[]; added: number } | null = null;
    for (const d of days) {
      if (d.day === except) continue;
      const cur = plan.get(d.day)!;
      const ins = cheapestInsert(d, cur, r);
      const next = cur.some(isFixed) ? ins.refs : order(d, [...cur, r]);
      if (!fits(d, next)) continue;
      const added = routeDrive(d, next) - routeDrive(d, cur);
      if (best === null || added < best.added) best = { day: d.day, refs: next, added };
    }
    return best ? { day: best.day, refs: best.refs } : null;
  };
  const pending: string[] = [];
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
    const home = bestHome(r, null);
    if (home) plan.set(home.day, home.refs);
    else unplaced.push(r);
  }

  // ---- 5 improve: relocations that lower the total drive ----
  let moves = 0;
  let improved = true;
  while (improved && moves < BUILDER_PACK.localSearchMoves) {
    improved = false;
    const scan = [...plan.entries()].flatMap(([day, refs]) => refs.filter((r) => !isFixed(r)).map((r) => ({ r, day }))).sort((a, b) => cmp(a.r, b.r));
    for (const { r, day } of scan) {
      const from = dayOf.get(day)!;
      const cur = plan.get(day)!;
      const without = order(from, cur.filter((x) => x !== r));
      const saved = routeDrive(from, cur) - routeDrive(from, without);
      let best: { day: number; refs: string[]; gain: number } | null = null;
      for (const to of days) {
        if (to.day === day) continue;
        const there = plan.get(to.day)!;
        const next = there.some(isFixed) ? cheapestInsert(to, there, r).refs : order(to, [...there, r]);
        if (!fits(to, next)) continue;
        const gain = saved - (routeDrive(to, next) - routeDrive(to, there));
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
  }

  // ---- 6 retry the left-out stops ----
  const stillOut: string[] = [];
  for (const r of [...unplaced].sort((a, b) => -priority(a, b))) {
    const home = bestHome(r, null);
    if (home) plan.set(home.day, home.refs);
    else stillOut.push(r);
  }
  const outSet = new Set(stillOut);
  const inputOrder = input.stops.map((s) => s.ref).filter((r) => outSet.has(r));

  return {
    days: days.map((d) => {
      const refs = plan.get(d.day)!;
      const driveMin = refs.length ? routeDrive(d, refs) : direct(d);
      const extra = driveMin - direct(d);
      return { day: d.day, refs, loadMin: visits(refs) + extra, driveMin, extraDriveMin: extra };
    }),
    unplaced: inputOrder,
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
