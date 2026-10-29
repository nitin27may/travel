// The device re-flow of a built trip (STEP2-B2; edit-mode-spec 5 "Re-flow: both days, on the device"; trip-builder 4.6). After the person
// moves, adds or removes stops, the days the last build no longer describes are packed and timed again here, with core's packer (pack.ts):
// kept stops (locked, placed by the person, from our trip) keep their day and their order; the other stops of the day are ordered around
// them by the pack cost, and a day over its budget hands its lowest free stop to the nearest day that takes it. Nothing is dropped: a stop
// no day takes stays where it was and the day says it is long. Days the person did not touch keep the build's own figures.
//
// The full repack (TB-E4 `repack.ts`: every free stop of the trip against the server's routed matrix) is a later engine package. This one
// reads what the device already holds: the picks matrix of the last Rebuild in this tab when there is one, else the drives the build
// itself measured (each stop from the day's base, and between neighbours), with every other pair estimated from those and marked ≈.
// Pure: no clock, no storage, no fetch. Loaded lazily, on the first Re-flow press.
import { builtDays, type BuiltDay } from '@travel/core/plan/ops.ts';
import { packDays, type PackDay, type PackStop } from '@travel/core/plan/pack.ts';
import { PACE_RULES, dayCapMin } from '@travel/core/schedule/rules.ts';
import type { Profile } from '@travel/core/schedule/types.ts';
import type { PlanMatrix } from '@travel/core/schema/api/plan.ts';
import type { PlanDayOut, PlanDraft, PlanItemOut, PlanOutputs, PlanReason } from '@travel/core/schema/plan-draft.ts';
import { BUILDER_PACK } from '@travel/core/config/builder.ts';
import { PLAN_UNKNOWN_VISIT_MIN } from '@/lib/config/product';
import { staleDays } from './built';

/** The minutes the device assumes between two points it has no figure for (a stop it has never seen driven to, or two bases). */
export const REFLOW_FALLBACK_MIN = 30;
const BASE_TO_BASE_MIN = 120;
const LUNCH_AT_MIN = 12 * 60;

// ---- the picks matrix of the last Rebuild in this tab (never stored: a reload falls back to the build's own figures) -----------------------
const matrices = new Map<string, PlanMatrix>();
export const rememberMatrix = (id: string, m: PlanMatrix | null | undefined): void => {
  if (m) matrices.set(id, m);
  else matrices.delete(id);
};
export const matrixOf = (id: string): PlanMatrix | null => matrices.get(id) ?? null;

export interface ReflowParty {
  adults: number;
  children: readonly number[];
}

export interface ReflowResult {
  lastBuild: PlanOutputs;
  /** the days packed and timed again, in day order */
  days: number[];
  /** free stops a full day handed to another day */
  moved: { ref: string; from: number; to: number }[];
}

interface Cost {
  (a: string, b: string): number | null;
  estimated: (a: string, b: string) => boolean;
}

/** The drive figures the device holds: the matrix (routed or ≈ cell by cell), the build's measured legs, and estimates from those. */
export function costModel(d: PlanDraft, matrix: PlanMatrix | null, hubOf: (day: number) => string): Cost {
  const b = d.lastBuild;
  const known = new Map<string, { min: number; est: boolean }>();
  const put = (x: string, y: string, min: number, est: boolean) => {
    if (!known.has(`${x}|${y}`)) known.set(`${x}|${y}`, { min, est });
    if (!known.has(`${y}|${x}`)) known.set(`${y}|${x}`, { min, est });
  };
  // each stop's distance from its base: measured when it was the first or last of a day, else the shorter way along its day
  const radius = new Map<string, number>();
  for (const day of b?.days ?? []) {
    const hub = hubOf(day.day);
    let prev = hub;
    for (const it of day.items) {
      if (it.driveMin !== null) put(prev, it.ref, it.driveMin, it.basis !== 'routed');
      prev = it.ref;
    }
    if (day.returnMin !== null && day.items.length) put(prev, hub, day.returnMin, true);
    // out: the drives from the base up to the stop; back: the drives after it, home included; the shorter way is an upper bound
    const legs = day.items.map((it) => it.driveMin);
    day.items.forEach((it, j) => {
      const outLegs = legs.slice(0, j + 1);
      const backLegs = legs.slice(j + 1);
      const out = outLegs.every((x) => x !== null) ? outLegs.reduce<number>((s2, x) => s2 + x!, 0) : Number.POSITIVE_INFINITY;
      const back = day.returnMin !== null && backLegs.every((x) => x !== null) ? backLegs.reduce<number>((s2, x) => s2 + x!, day.returnMin) : Number.POSITIVE_INFINITY;
      const r = Math.min(out, back);
      if (Number.isFinite(r)) radius.set(it.ref, Math.min(radius.get(it.ref) ?? r, r));
    });
  }
  const rs = [...radius.values()].sort((x, y) => x - y);
  const typical = rs.length ? rs[Math.floor(rs.length / 2)]! : REFLOW_FALLBACK_MIN;
  const at = new Map((matrix?.refs ?? []).map((r, i) => [r, i]));
  const estCell = new Set(matrix?.estimated ?? []);
  const n = matrix?.refs.length ?? 0;
  const isHub = (x: string) => x.startsWith('t:') || x === 'hub';
  const rOf = (x: string) => radius.get(x) ?? typical;

  const look = (a: string, c: string): { min: number; est: boolean } => {
    if (a === c) return { min: 0, est: false };
    const i = at.get(a);
    const j = at.get(c);
    if (matrix && i !== undefined && j !== undefined) return { min: matrix.minutes[i]![j]!, est: estCell.has(i * n + j) };
    const k = known.get(`${a}|${c}`);
    if (k) return k;
    if (isHub(a) && isHub(c)) return { min: BASE_TO_BASE_MIN, est: true };
    if (isHub(a)) return { min: rOf(c), est: true };
    if (isHub(c)) return { min: rOf(a), est: true };
    // two stops: at least the difference of their distances from the base, at most their sum; the midpoint of the two bounds
    const ra = rOf(a);
    const rc = rOf(c);
    return { min: Math.round(Math.max(Math.abs(ra - rc), (Math.abs(ra - rc) + ra + rc) / 2)), est: true };
  };
  const cost = ((a: string, c: string) => look(a, c).min) as Cost;
  cost.estimated = (a, c) => look(a, c).est;
  return cost;
}

const profileOf = (d: PlanDraft, party: ReflowParty): Profile => {
  const youngest = party.children.length ? Math.min(...party.children) : null;
  return { party: youngest === null ? 'adults' : 'family', youngest, adults: party.adults, pace: d.pace, walkKm: null, split: false };
};

/** The re-flow of every day the last build no longer describes. Null when there is no build or nothing to re-flow. */
export function reflow(d: PlanDraft, party: ReflowParty, matrix: PlanMatrix | null = null): ReflowResult | null {
  const b = d.lastBuild;
  if (!b) return null;
  const stale = staleDays(d);
  if (!stale.length) return null;
  const last = d.nights === null ? 1 : d.nights + 1;
  const byDay = new Map(b.days.map((x) => [x.day, x]));
  const days = builtDays(d).filter((x) => x.day <= last);
  const dayOf = new Map(days.map((x) => [x.day, x]));
  // the node a day starts and ends at: its base, else the base of the night before (the last day), else one stand-in hub
  const hubOf = (n: number): string => {
    for (let k = n; k >= 1; k--) {
      const base = byDay.get(k)?.base;
      if (base) return `t:${base}`;
    }
    return 'hub';
  };
  const cost = costModel(d, matrix, hubOf);
  const profile = profileOf(d, party);
  const cap = dayCapMin(profile) - BUILDER_PACK.mealAllowanceMin;
  const driveCap = d.driveDayMin ?? PACE_RULES[d.pace].driveLimitMin;
  const share = BUILDER_PACK.edgeDayShare[d.where.mode === 'near' ? 'near' : 'trip'];
  const budgetOf = (n: number) => Math.max(0, Math.round(n === 1 || n === last ? cap * share : cap));

  const items = new Map<string, PlanItemOut>();
  for (const day of b.days) for (const it of day.items) items.set(it.ref, it);
  const pick = new Map(d.picks.map((p) => [p.ref, p]));
  const visitOf = (ref: string): number => {
    const v = items.get(ref)?.visitMin;
    return v && v > 0 ? v : PLAN_UNKNOWN_VISIT_MIN;
  };
  const keptOf = (x: BuiltDay) => new Set([...x.locked, ...x.placed, ...x.fromTrip]);
  const plan = new Map<number, string[]>(days.map((x) => [x.day, [...x.refs]]));
  const kept = new Map<string, number>();
  for (const x of days) for (const r of keptOf(x)) kept.set(r, x.day);

  const packDay = (n: number, refs: readonly string[], fixedAll: boolean, extra?: string) => {
    const pd: PackDay = { day: n, from: hubOf(n), to: hubOf(n), budgetMin: budgetOf(n), driveCapMin: driveCap };
    const all = extra ? [...refs, extra] : [...refs];
    const stops: PackStop[] = all.map((ref, rank) => ({
      ref,
      visitMin: visitOf(ref),
      must: !!pick.get(ref)?.must,
      score: 0,
      bearing: null,
      ...(kept.get(ref) === n || (fixedAll && ref !== extra) ? { fixed: { day: n, rank } } : {}),
    }));
    return packDays({ stops, days: [pd], cost });
  };

  const changed = new Set<number>();
  const moved: ReflowResult['moved'] = [];
  for (const n of stale) {
    const r = packDay(n, plan.get(n) ?? [], false);
    const out = r.unplaced;
    plan.set(n, [...(r.days[0]?.refs ?? []), ...out]);
    changed.add(n);
    for (const ref of out) {
      // the nearest other day that takes it whole, earlier first on a tie; none: it stays, and the day says it is long
      const order = days.map((x) => x.day).filter((m) => m !== n).sort((x, y) => Math.abs(x - n) - Math.abs(y - n) || x - y);
      for (const m of order) {
        const there = plan.get(m) ?? [];
        const t = packDay(m, there, true, ref);
        if (t.unplaced.length) continue;
        plan.set(n, (plan.get(n) ?? []).filter((x) => x !== ref));
        plan.set(m, t.days[0]!.refs);
        changed.add(m);
        moved.push({ ref, from: n, to: m });
        break;
      }
    }
  }

  const timed = (n: number): PlanDayOut => {
    const was = byDay.get(n);
    const refs = plan.get(n) ?? [];
    const hub = hubOf(n);
    const first = was?.items[0];
    // the day starts when the build had it leave; a day the build left empty starts at the pace's hour (the arrival day of a trip by air, at noon)
    const leave = first && first.startMin !== null ? Math.max(0, first.startMin - (first.driveMin ?? 0)) : n === 1 && d.where.mode === 'trip' ? LUNCH_AT_MIN : PACE_RULES[d.pace].startMin;
    let cursor = leave;
    let prev = hub;
    let lunched = cursor >= LUNCH_AT_MIN + BUILDER_PACK.mealAllowanceMin;
    let drive = 0;
    let visits = 0;
    let est = false;
    const lockedHere = new Set(dayOf.get(n)?.locked ?? []);
    const out: PlanItemOut[] = refs.flatMap((ref) => {
      const p = pick.get(ref);
      if (!p) return [];
      const leg = cost(prev, ref) ?? REFLOW_FALLBACK_MIN;
      const legEst = cost.estimated(prev, ref);
      est ||= legEst;
      let at = cursor + leg;
      if (!lunched && at >= LUNCH_AT_MIN) {
        at += BUILDER_PACK.mealAllowanceMin;
        lunched = true;
      }
      const v = visitOf(ref);
      cursor = at + v;
      drive += leg;
      visits += v;
      prev = ref;
      return [{ ref, slug: p.slug, name: p.name, startMin: Math.min(2879, at), visitMin: Math.min(1440, v), driveMin: Math.min(1440, leg), basis: legEst ? 'estimate' : 'routed', locked: lockedHere.has(ref) }];
    });
    const home = out.length ? (cost(prev, hub) ?? REFLOW_FALLBACK_MIN) : null;
    if (home !== null) {
      drive += home;
      est ||= cost.estimated(prev, hub);
    }
    const warnings: string[] = [];
    if (visits + drive > cap + BUILDER_PACK.mealAllowanceMin) warnings.push('W_PACE');
    if (drive > driveCap) warnings.push('W_DRIVE_LIMIT');
    const reasons: PlanReason[] = out.length
      ? [
          { code: 'day_drive', values: { driveMin: drive }, text: `${hm(drive)}${est ? ' ≈' : ''} of driving` },
          { code: 'reflowed', values: { n: out.length }, text: 'Times worked out again on this device, so they are estimates.' },
        ]
      : [];
    return { day: n, base: was?.base ?? null, move: was?.move ?? false, items: out, returnMin: home === null ? null : Math.min(1440, home), warnings, reasons };
  };

  const nextDays = [...b.days.filter((x) => !changed.has(x.day))];
  for (const n of changed) nextDays.push(timed(n));
  nextDays.sort((x, y) => x.day - y.day);
  const placed = new Set(nextDays.flatMap((x) => x.items.map((i) => i.ref)));
  const lastBuild: PlanOutputs = {
    ...b,
    basis: b.basis === 'routed' ? 'mixed' : b.basis,
    days: nextDays,
    didNotFit: b.didNotFit.filter((m) => !placed.has(m.ref)),
  };
  return { lastBuild, days: [...changed].sort((x, y) => x - y), moved };
}

const hm = (min: number): string => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}` : `${min} min`);
