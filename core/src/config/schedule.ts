// The day scheduler's numbers that are not duration rules (core/src/schedule/rules.ts holds those), defined once. Pure and
// framework-free: the trip page's scheduler bundle (core/src/schedule/browser.ts) imports this file.

/**
 * Gaps on a day's time rail (sweep SW-022). A wait longer than this before a timed stop, a meal or a check-in is drawn as its own
 * row ("Free time", "Rest at the base"), so the times on the rail always add up: a 20 minute wait before a 16:30 stop was silent at the
 * old 20 minute threshold. Shorter waits fold into the next start (they are rounding, not time to spend).
 */
export const FREE_ROW_MIN = 10;

/**
 * The legs of a stop moved to a day at another base when the stop has no map point (template.ts `movedLegs`; STEP2-C2 gap). The leg
 * ladder's own straight-line estimate takes the drive between the two bases; these minutes stand for the part the data cannot place.
 */
export const MOVED_STOP_LEGS = {
  /** No stored way from its own base to the stop: the stop is taken to be this far from that base. Larger than a 10 minute local move on purpose. */
  nearOwnBaseMin: 30,
  /** Neither the stop nor one of the two bases has a point: a conservative guess, always shown as an estimate (≈). */
  unknownMin: 60,
} as const;

/**
 * A stop with no point on a transfer day, driven on to the next base, with only the stored way from the start base to it (legs.ts, the hub
 * rung; S2D-SCHED cause 1). The stop is taken to lie on the way: the base-to-base estimate less that stored way, but never under this.
 */
export const TRANSFER_STOP_FLOOR_MIN = 30;

/**
 * The midday return to the base (S2D-SCHED cause 3, Dolomites Day 2): a wait longer than `minWaitMin` before a stop with a set time is spent at
 * the base, with a leg back and a leg out again, when each of those drives is at most `maxLegMin`. Otherwise the wait stays a Free time at the stop.
 */
export const MIDDAY_RETURN = { minWaitMin: 120, maxLegMin: 30 } as const;

/**
 * The plan's own day start (a "Leave the base" time written for the plan's main version) is moved later when the version scheduled reaches its
 * first set time with a wait longer than this (S2D-SCHED cause 4, adults Day 4 A waited 3 h 20 at Wilcox Pass). A start the person set, or an
 * operator's time, never moves; no stop with a set time moves.
 */
export const LATE_START_SLACK_MIN = 60;
