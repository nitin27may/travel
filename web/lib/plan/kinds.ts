// The six kind tiles of FLOW stage 0 (TF2). The kind is never stored: a draft holds the nights, and the kind is derived from them
// (trip-kinds TK1). "By car" is the near mode, "by air" the trip mode; the tile only sets the defaults and says which.
import { PLAN_BUILDER_UI } from '@/lib/config/product';

export const KIND_IDS = ['day', 'weekend', 'long_weekend', 'week_car', 'week_air', 'holiday'] as const;
export type KindId = (typeof KIND_IDS)[number];
export type PlanMode = 'near' | 'trip';

export interface KindDef {
  id: KindId;
  label: string;
  /** the mono meta line of the tile (TB-N2 S8: "by car" or "fly somewhere") */
  meta: string;
  mode: PlanMode;
  /** nights the tile sets */
  nights: number;
  /** the longest one-way drive from home, minutes (near kinds only) */
  reachMin: number | null;
}

const N = PLAN_BUILDER_UI.nightsByKind;
const R = PLAN_BUILDER_UI.reachByKindMin;

export const KINDS: readonly KindDef[] = [
  { id: 'day', label: 'Day trip', meta: 'Out and back · by car', mode: 'near', nights: N.day, reachMin: R.day },
  { id: 'weekend', label: 'Weekend', meta: '1 or 2 nights · by car', mode: 'near', nights: N.weekend, reachMin: R.weekend },
  { id: 'long_weekend', label: 'Long weekend', meta: '3 or 4 nights · by car', mode: 'near', nights: N.long_weekend, reachMin: R.long_weekend },
  { id: 'week_car', label: 'A week by car', meta: 'About 7 nights · from home', mode: 'near', nights: N.week_car, reachMin: R.week_car },
  { id: 'week_air', label: 'A week by air', meta: 'About 7 nights · fly somewhere', mode: 'trip', nights: N.week_air, reachMin: null },
  { id: 'holiday', label: 'Longer holiday', meta: '10 to 21 nights · fly somewhere', mode: 'trip', nights: N.holiday, reachMin: null },
];

export const kindDef = (id: KindId): KindDef => KINDS.find((k) => k.id === id)!;

/** The tile a draft's nights and mode read as (for resuming): the nights give the kind, the mode splits a week. */
export function kindOfDraft(nights: number | null, mode: PlanMode): KindId {
  const n = nights ?? 0;
  if (n <= 0) return mode === 'near' ? 'day' : 'week_air';
  if (n <= 2) return mode === 'near' ? 'weekend' : 'week_air';
  if (n <= 4) return mode === 'near' ? 'long_weekend' : 'week_air';
  if (n <= 9) return mode === 'near' ? 'week_car' : 'week_air';
  return mode === 'near' ? 'week_car' : 'holiday';
}

/** Kinds that read "Next weekend" as a When chip (short trips). */
export const isShortKind = (k: KindId): boolean => k === 'day' || k === 'weekend' || k === 'long_weekend';
