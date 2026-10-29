// The bases the visitor chooses (FLOW stage 4 "Where the trip sleeps"; trip-builder 4.5; TB-E2): towns from the candidates, each with
// nights or left open for the plan to share, in the order the trip visits them. Pure, type-only imports from the core's schema, so the
// start chunk loads none of it. The document keeps `{ town, nights, pinned }` (plan-draft `planBaseChoice`); the names and points the
// screen shows live in the flow state's `baseInfo` and are public gazetteer rows, never a point of the visitor's.
import type { PlanBaseChoice } from '@travel/core/schema/plan-draft.ts';

/** At most this many bases in a plan (= PLAN_LIMITS.bases; web/tests/plan/bases.test.ts pins them equal). */
export const MAX_BASES = 4;

/** What the screen knows about a base town: public gazetteer fields only. */
export interface BaseInfo {
  name: string;
  lat: number;
  lon: number;
}

/** The nights the visitor has given to bases, whole. An open base (null) counts as none. */
export const placedNights = (bases: readonly PlanBaseChoice[]): number => bases.reduce((n, b) => n + (b.nights ?? 0), 0);

/** Adds a town as the last base. A town already there, or a fifth base, leaves the list as it is. */
export function addBase(bases: readonly PlanBaseChoice[], town: string): PlanBaseChoice[] {
  if (bases.some((b) => b.town === town) || bases.length >= MAX_BASES) return [...bases];
  return [...bases, { town, nights: null, pinned: true }];
}

export const removeBase = (bases: readonly PlanBaseChoice[], town: string): PlanBaseChoice[] => bases.filter((b) => b.town !== town);

/** Moves a base one place earlier (`-1`) or later (`1`) in the order of the trip; at an end it stays. */
export function moveBase(bases: readonly PlanBaseChoice[], town: string, by: -1 | 1): PlanBaseChoice[] {
  const i = bases.findIndex((b) => b.town === town);
  const j = i + by;
  if (i < 0 || j < 0 || j >= bases.length) return [...bases];
  const out = [...bases];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

/** Sets the nights of one base (null: the plan shares them). More than the trip has left is cut to what is left, so the sum never passes `total`. */
export function setBaseNights(bases: readonly PlanBaseChoice[], town: string, nights: number | null, total: number): PlanBaseChoice[] {
  const others = placedNights(bases.filter((b) => b.town !== town));
  const room = Math.max(0, total - others);
  return bases.map((b) => (b.town === town ? { ...b, nights: nights === null ? null : Math.min(Math.max(0, Math.round(nights)), room) } : b));
}

/** A shorter trip takes nights back from the last bases first; a trip of no nights has no base (a day trip, plan-draft rules). */
export function clampBases(bases: readonly PlanBaseChoice[], total: number): PlanBaseChoice[] {
  if (total <= 0) return [];
  let over = placedNights(bases) - total;
  if (over <= 0) return [...bases];
  const out = bases.map((b) => ({ ...b }));
  for (let i = out.length - 1; i >= 0 && over > 0; i--) {
    const have = out[i]!.nights ?? 0;
    const cut = Math.min(have, over);
    if (cut > 0) {
      out[i]!.nights = have - cut;
      over -= cut;
    }
  }
  return out;
}

export interface Split {
  /** nights by base, in the bases' order: the visitor's own, and for open bases a share of what is left */
  nights: number[];
  /** nights no base holds because every base has its own; the plan puts them where the days are busiest */
  spare: number;
}

/** The split the estimate card shows before the build: the visitor's nights first, the open bases sharing the rest evenly (the build shares by demand, so this is a guide). */
export function splitNights(bases: readonly PlanBaseChoice[], total: number): Split {
  const open = bases.map((b, i) => (b.nights === null ? i : -1)).filter((i) => i >= 0);
  const left = Math.max(0, total - placedNights(bases));
  const nights = bases.map((b) => b.nights ?? 0);
  if (!open.length) return { nights, spare: left };
  const each = Math.floor(left / open.length);
  let extra = left - each * open.length;
  for (const i of open) {
    nights[i] = each + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
  }
  return { nights, spare: 0 };
}

/** A town's name from its id when the screen holds no row for it (`ca-ab-banff` is "Banff"): a draft opened from another session. */
export function townName(id: string): string {
  const slug = id.split('-').slice(2).join('-') || id;
  return slug.replace(/(^|-)([a-z])/g, (_m, sep: string, c: string) => `${sep ? ' ' : ''}${c.toUpperCase()}`);
}

