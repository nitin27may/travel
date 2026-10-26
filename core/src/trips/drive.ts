// One drive figure for the trip (trip-and-places-ux-fixes.md 4.7, finding I14). The cover's "Drive a day" and each day's driving
// (the day header, the trip's shape) come from these two functions, so the cover can never say "about 1 h 40" while the days add
// up to about 2 h a day (the Rockies before UXB-C: the cover read the prototype seed's `driveAvgMin`, 100, and the days showed the
// timelines' `totals.driveMin`, 1,765 min over 15 days).

/** The fields of a day timeline this module reads (core/src/schedule/types.ts DayTimeline). */
export interface DriveDay {
  totals: { driveMin: number };
  /** A condensed plan: entries carry a part of the day, no legs are generated, so the timeline's drive total is not the day's drive. */
  blocks: boolean;
}

/**
 * The minutes of driving a day shows. A timed day: the timeline's own total (its drive legs, the figure the day header prints).
 * A condensed day (`blocks`): the plan's own figure for the day (`PublicDay.driveMin`), because the scheduler invents no legs
 * there; when the plan has none, the timeline's total. Null when neither is known.
 */
export function dayDriveMin(tl: DriveDay | null | undefined, planned: number | null = null): number | null {
  if (!tl) return planned;
  if (tl.blocks) return planned ?? (tl.totals.driveMin > 0 ? tl.totals.driveMin : null);
  return tl.totals.driveMin;
}

/** Rounded to 5 minutes: the timeline's own grain, so "1 h 58" reads "2 h", as the spec says it. */
const round5 = (n: number): number => Math.round(n / 5) * 5;

/**
 * The cover's "Drive a day": the mean of every day's `dayDriveMin` (days with no driving count as 0, so it is "a day of the trip",
 * not "a driving day"), rounded to 5 minutes. Null when no day has a known figure.
 */
export function driveAverageMin(days: readonly { tl: DriveDay | null | undefined; planned: number | null }[]): number | null {
  const mins = days.map((d) => dayDriveMin(d.tl, d.planned)).filter((m): m is number => m !== null);
  if (!mins.length) return null;
  return round5(mins.reduce((s, m) => s + m, 0) / mins.length);
}

/** A long drive day for the trip's shape (4.2): 2 h 30 or more at the wheel. */
export const LONG_DRIVE_MIN = 150;
