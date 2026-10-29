// Warning levels for edit mode (edit-mode-spec 11.1, Q-BE6; gap-analysis D3; task STEP2-C1). Every day-check code of
// core/src/checks/codes.ts and every builder did-not-fit code (`TB_*`, plan-draft.ts PLAN_MISS_CODES) and area check (PLAN_AREA_CODES) has exactly one level here, and
// the UI reads the level, never a code list of its own (STEP2-E5). core/test/plan/warnings.test.ts fails on a code with no level, so
// a new check cannot reach a screen unclassified.
//
//   fix     at rest on the day header, counted in the sticky row ("1 to fix") and the Summary's Checks line (P2 safety exception);
//           `--crit` text with the triangle, never a fill
//   check   on the day header, collapsed to "3 to check · Show" when there are several; `--warn` text on `--warn-soft`
//   hidden  author data checks: never shown to visitors (W_FIT_UNKNOWN shows as the gap chip "Not checked yet", not a warning)
//
// W_FIT (and the builder's TB_FIT) carry two levels: Fix when a RULE fails for the party (an operator's age, height or weight limit),
// Check when only OUR ADVICE fails. A caller that cannot tell gets Fix (P2: the safety reading wins). Warnings never block an edit;
// estimates (≈) are never a warning. Pure constants: the browser loads this file through extension point X-S2.
import { WARN_CODES, type WarnCode } from "../checks/codes.ts";
import { PLAN_AREA_CODES, PLAN_MISS_CODES } from "../schema/plan-draft.ts";

export const WARN_LEVELS = ["fix", "check", "hidden"] as const;
export type WarnLevel = (typeof WARN_LEVELS)[number];
/** A code's level, or its two levels when it depends on what failed (a rule for the party, or our advice). */
export type WarnLevelRule = WarnLevel | { rule: WarnLevel; advice: WarnLevel };

/**
 * Codes that are specified and levelled before their check lands: `W_NO_ROUTE` (no road between two stops on the drive model) is added
 * to WARN_CODES by STEP2-C2 (gap-analysis D4). Once it is there this list may drop it; nothing breaks while it stays.
 */
export const PENDING_WARN_CODES = ["W_NO_ROUTE"] as const;

type MissCode = (typeof PLAN_MISS_CODES)[number];
type AreaCode = (typeof PLAN_AREA_CODES)[number];
type LevelledCode = WarnCode | (typeof PENDING_WARN_CODES)[number] | MissCode | AreaCode;

/** The one table (edit-mode-spec 11.1). */
export const WARN_LEVEL = {
  // ---- fix: the trip does not work as planned
  W_HOURS: "fix",
  W_DEADLINE: "fix",
  W_BOOKING_DAY: "fix",
  W_FIT: { rule: "fix", advice: "check" },
  W_NO_ROUTE: "fix",
  TB_CLOSED: "fix",
  // ---- check: it works, but look at it
  W_DRIVE_LIMIT: "check",
  W_DAYLIGHT: "check",
  W_PACE: "check",
  W_CEILING: "check",
  W_EARLY: "check",
  W_OVERLAP: "check",
  TB_FIT: { rule: "fix", advice: "check" },
  TB_TOO_FAR: "check",
  TB_TIME: "check",
  TB_BOOKING: "check",
  TB_UNKNOWN: "check",
  TB_AREA_EMPTY: "check",
  // ---- hidden: author data checks, and the fit gap shown as a chip
  W_ORDER: "hidden",
  W_LEG_MISSING: "hidden",
  W_LEG_DRIFT: "hidden",
  W_NO_COORDS: "hidden",
  W_TZ_MISSING: "hidden",
  W_FIT_UNKNOWN: "hidden",
} as const satisfies Record<LevelledCode, WarnLevelRule>;

/** Every code the table levels. */
export const LEVELLED_CODES = Object.keys(WARN_LEVEL) as LevelledCode[];

/**
 * The level of a code, or null for a code this table does not know (a newer check than this build: the caller shows nothing rather
 * than guess). `basis` says what failed for a two-level code; absent, the Fix reading.
 */
export function warnLevel(code: string, basis?: "rule" | "advice"): WarnLevel | null {
  if (!Object.hasOwn(WARN_LEVEL, code)) return null;
  const v = WARN_LEVEL[code as LevelledCode] as WarnLevelRule;
  return typeof v === "string" ? v : v[basis ?? "rule"];
}

/** How many of a day's (or a trip's) warnings are at each shown level: the "1 to fix" and "3 to check" counts. Unknown codes count nowhere. */
export function warnCounts(codes: readonly (string | { code: string; basis?: "rule" | "advice" })[]): { fix: number; check: number } {
  const out = { fix: 0, check: 0 };
  for (const c of codes) {
    const level = typeof c === "string" ? warnLevel(c) : warnLevel(c.code, c.basis);
    if (level === "fix" || level === "check") out[level] += 1;
  }
  return out;
}

/** True when a code is a day check of core/src/checks (not a builder did-not-fit code). */
export const isDayCheck = (code: string): boolean => Object.hasOwn(WARN_CODES, code);
