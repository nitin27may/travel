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
