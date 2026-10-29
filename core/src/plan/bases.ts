// Several bases chosen by the visitor (trip-builder.md 4.4 "pinned bases are in B", 4.5 nights per base; task TB-E2). Pure and
// deterministic: the visitor's bases in their order (TB-E3 adds the p-median choice and the gateway order), each pick assigned to the
// base nearest to it in drive, the nights shared out by demand. Integer arithmetic only, every tie broken by the base's order, so the
// same input gives the same shares.
import { BUILDER_BASES } from "../config/builder.ts";
import { PLAN_LIMITS, type PlanBaseChoice } from "../schema/plan-draft.ts";
import { townNode, type DriveTable } from "./driveTable.ts";
import type { EngineTown } from "./engineTypes.ts";

/** A base the visitor chose, resolved to a candidate town. */
export interface ChosenBase {
  town: EngineTown;
  node: string;
  /** the visitor's nights, or null: shared out by demand */
  nights: number | null;
  pinned: boolean;
}

/**
 * The visitor's bases that are candidate towns, in the visitor's order, each town once, at most PLAN_LIMITS.bases. A base whose town
 * is not among the candidates cannot be routed and is left out (as K = 1 leaves out a pinned town it does not hold).
 */
export function resolveBases(choices: readonly PlanBaseChoice[], towns: readonly EngineTown[]): ChosenBase[] {
  const byId = new Map(towns.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const out: ChosenBase[] = [];
  for (const c of choices) {
    const t = byId.get(c.town);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push({ town: t, node: townNode(t.id), nights: c.nights, pinned: c.pinned });
    if (out.length === PLAN_LIMITS.bases) break;
  }
  return out;
}

/** The base nearest to `node` in one-way drive among `among` (indices into `bases`): ties by the base's order. Null: no road from any. */
export function nearestBase(
  node: string,
  bases: readonly ChosenBase[],
  among: readonly number[],
  table: DriveTable,
): { index: number; min: number; routed: boolean } | null {
  let best: { index: number; min: number; routed: boolean } | null = null;
  for (const i of among) {
    const c = table.get(bases[i]!.node, node);
    if (c.min === null) continue;
    if (best === null || c.min < best.min) best = { index: i, min: c.min, routed: c.routed };
  }
  return best;
}

/**
 * Nights per base (4.5), summing to `total`. The visitor's nights first, in order (clamped to what is left, so a body that asks for
 * more than the plan holds still sums right); the open bases then get the floor (BUILDER_BASES.nightsFloor, else 1, else 0, whichever
 * every open base can have) and the rest by the largest remainder of their demand. With no open base, the nights left over go to the
 * base with the highest demand (4.5 "spare days go to the base with the highest demand"). `demand` is in whole minutes.
 */
export function shareNights(total: number, nights: readonly (number | null)[], demand: readonly number[]): number[] {
  const out = nights.map(() => 0);
  let left = Math.max(0, total);
  nights.forEach((n, i) => {
    if (n === null) return;
    const g = Math.min(Math.max(0, n), left);
    out[i] = g;
    left -= g;
  });
  const open = nights.flatMap((n, i) => (n === null ? [i] : []));
  if (!open.length) {
    if (left > 0 && out.length) {
      let top = 0;
      for (let i = 1; i < out.length; i++) if ((demand[i] ?? 0) > (demand[top] ?? 0)) top = i;
      out[top]! += left;
    }
    return out;
  }
  const m = open.length;
  const floor = left >= BUILDER_BASES.nightsFloor * m ? BUILDER_BASES.nightsFloor : left >= m ? 1 : 0;
  for (const i of open) out[i] = floor;
  left -= floor * m;
  if (left === 0) return out;
  // largest remainder over the open bases' demand, exactly: quota_i = left * d_i / D, compared as integers
  const totalD = open.reduce((n, i) => n + Math.max(0, demand[i] ?? 0), 0);
  const num = (i: number): number => (totalD > 0 ? left * Math.max(0, demand[i] ?? 0) : left);
  const den = totalD > 0 ? totalD : m;
  let given = 0;
  for (const i of open) {
    const q = Math.floor(num(i) / den);
    out[i]! += q;
    given += q;
  }
  const order = [...open].sort((a, b) => (num(b) % den) - (num(a) % den) || (demand[b] ?? 0) - (demand[a] ?? 0) || a - b);
  for (let k = 0; k < left - given; k++) out[order[k % order.length]!]! += 1;
  return out;
}
