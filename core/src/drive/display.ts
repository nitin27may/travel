// Display rules for drive figures (driving-time-model.md 4.2 and 4.6): the rounding a day row shows and the near-mode keep rule.
// Pure. The words ("about", the ≈ mark, chips) are DT-UI's; this file only decides the numbers.
import { DRIVE_DISPLAY } from "../config/drive.ts";
import type { DriveEstimate } from "./types.ts";

/** Rounded for display: under 1 h to 5 min, 1 to 4 h to 10 min, over 4 h to 15 min (never below one step). */
export function displayMinutes(minutes: number): number {
  for (const [below, step] of DRIVE_DISPLAY.rounding) {
    if (minutes < below) return Math.max(step, Math.round(minutes / step) * step);
  }
  return minutes;
}

/** True when the figure should be marked ≈ (anything not routed or authored). */
export const isApproximate = (e: Pick<DriveEstimate, "confidence">): boolean => e.confidence === "modelled" || e.confidence === "rough";

/**
 * Near mode (spec 4.2): keep a candidate when its estimate x the keep factor is within the limit. Optimistic on purpose: routing
 * the survivors removes the extra ones; a dropped place that was really inside could never come back. A leg with no road is dropped.
 */
export function keepWithin(e: Pick<DriveEstimate, "minutes" | "confidence">, limitMin: number): boolean {
  if (e.minutes === null) return false;
  if (e.confidence === "routed" || e.confidence === "authored") return e.minutes <= limitMin;
  return e.minutes * DRIVE_DISPLAY.keepFactor <= limitMin;
}
