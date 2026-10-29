// The estimate card's moves between chosen bases (FLOW stage 4; trip-builder 4.5). Apart from bases.ts because it reads the schedule's
// straight-line leg estimate and the pace rules, which the start chunk must not carry. Pure; loaded with the Days stage.
import type { PlanBaseChoice } from '@travel/core/schema/plan-draft.ts';
import { PACE_RULES } from '@travel/core/schedule/rules.ts';
import { estimateLeg } from '@travel/core/schedule/legs.ts';
import { townName, type BaseInfo } from './bases';
import type { Pace } from './flow';
import { APPROX, durationText } from './format';

export interface Move {
  from: string;
  to: string;
  /** minutes by a straight-line estimate (always ≈ before the build); null when a town's point is unknown */
  min: number | null;
  /** over the day's driving: "a long move" */
  long: boolean;
}

/** The day's driving when the visitor has not set one: the pace's. */
export const driveLimit = (pace: Pace, driveDayMin: number | null): number => driveDayMin ?? PACE_RULES[pace].driveLimitMin;

/** The move between each pair of consecutive bases, as an estimate from the towns' public points. */
export function moves(bases: readonly PlanBaseChoice[], info: Readonly<Record<string, BaseInfo | undefined>>, limitMin: number): Move[] {
  const out: Move[] = [];
  for (let i = 1; i < bases.length; i++) {
    const a = info[bases[i - 1]!.town];
    const b = info[bases[i]!.town];
    const min = a && b ? estimateLeg({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }).minutes : null;
    out.push({ from: a?.name ?? townName(bases[i - 1]!.town), to: b?.name ?? townName(bases[i]!.town), min, long: min !== null && min > limitMin });
  }
  return out;
}

/** "Move Banff to Jasper: 5 h 05 ≈, a long move" (the engine's words, trip-builder 4.5). */
export function moveWords(m: Move): string {
  if (m.min === null) return `Move ${m.from} to ${m.to}: the drive is known after the build`;
  return `Move ${m.from} to ${m.to}: ${durationText(m.min)} ${APPROX}${m.long ? ', a long move' : ''}`;
}
