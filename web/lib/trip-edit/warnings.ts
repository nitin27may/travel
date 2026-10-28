// Warnings in two levels in edit mode (edit-mode-spec 11; STEP2-E5). Pure: the levels come from core's one table (`WARN_LEVEL`), this file
// adds what the UI needs on top: which warnings are shown, how a two-level code is read, which fix each Fix code offers, and the counts.
// A code with no level in the table shows nothing (the C1 test fails a new check that has none), except the scheduler's own S_ notes, which
// read as To check, as the Move to day list does. Nothing here ever disables an edit (Q-BE6).
import { warnLevel } from '@travel/core/plan/warnings.ts';
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';

export type Level = 'fix' | 'check';

/** A warning as the day header shows it. */
export interface Warn {
  /** the day as the page numbers it (Day n) */
  day: number;
  code: string;
  message: string;
  entryId: string | null;
  level: Level;
}

/**
 * W_FIT carries two levels (core warnings.ts): Fix when a RULE fails for the party, Check when only OUR ADVICE fails. The scheduler words the
 * two differently (core/src/schedule/validate.ts) and carries no field for it, so the basis is read from the sentence: "has a minimum age
 * of" is the operator's rule; "is advised for age" and "is an adults' hike in this plan" are ours. A sentence we do not know gets the rule
 * reading (P2: the safety reading wins), as core says a caller that cannot tell must. tests/trip-edit/warnings.test.ts pins the wording.
 */
export const FIT_ADVICE = [/ is advised for age /, / is an adults' hike in this plan/] as const;
export function basisOf(code: string, message: string): 'rule' | 'advice' | undefined {
  if (code !== 'W_FIT' && code !== 'TB_FIT') return undefined;
  return FIT_ADVICE.some((r) => r.test(message)) ? 'advice' : 'rule';
}

/** The level a warning is shown at, or null when it is not shown (hidden, or a code the table does not know). */
export function shownLevel(w: { code: string; message: string }): Level | null {
  const l = warnLevel(w.code, basisOf(w.code, w.message));
  if (l === 'hidden') return null;
  if (l) return l;
  return w.code.startsWith('S_') ? 'check' : null;
}

/** What a Fix-level code offers: the one fix button. `null` is a code that is levelled but has no fix to offer here. */
export type FixKind = 'move' | 'remove';
export const FIX_OF = {
  // closed that weekday, or outside opening hours: another day may be open then; else the stop goes
  W_HOURS: 'move',
  // a booking on another or a dropped day: the stop belongs on a day that fits; else it goes
  W_BOOKING_DAY: 'move',
  // a book-by date passed, or a rule of the operator that the party fails: the stop cannot stay as planned
  W_DEADLINE: 'remove',
  W_FIT: 'remove',
  // not built yet (STEP2-C2) and the builder's own (STEP2-B2): levelled, never emitted by the page's scheduler
  W_NO_ROUTE: null,
  TB_CLOSED: null,
  TB_FIT: null,
} as const satisfies Record<string, FixKind | null>;
export const fixKindOf = (code: string): FixKind | null => (Object.hasOwn(FIX_OF, code) ? (FIX_OF as Record<string, FixKind | null>)[code]! : null);

/** Every shown warning of the days, Fix first within a day, in day order. */
export function collect(timelines: readonly Pick<DayTimeline, 'day' | 'warnings'>[]): Warn[] {
  return timelines.flatMap((t) =>
    t.warnings.flatMap((w) => {
      const level = shownLevel(w);
      return level ? [{ day: t.day, code: w.code, message: w.message, entryId: w.entryId, level }] : [];
    }),
  );
}

export interface Counts {
  fix: number;
  check: number;
  /** the first Fix warning's day, where "n to fix" jumps to */
  firstFixDay: number | null;
}
export const NO_COUNTS: Counts = { fix: 0, check: 0, firstFixDay: null };

export function countOf(ws: readonly Warn[]): Counts {
  const fix = ws.filter((w) => w.level === 'fix');
  return { fix: fix.length, check: ws.length - fix.length, firstFixDay: fix[0]?.day ?? null };
}

/** "1 to fix", "3 to check", or both with a middle dot; empty when there is nothing. */
export function countWords(c: Pick<Counts, 'fix' | 'check'>): string {
  return [c.fix ? `${c.fix} to fix` : '', c.check ? `${c.check} to check` : ''].filter(Boolean).join(' · ');
}

/** The entry a warning belongs to, if the day still has it. */
export const entryOf = (t: Pick<DayTimeline, 'entries'>, w: { entryId: string | null }): TimelineEntry | null => (w.entryId ? (t.entries.find((e) => e.id === w.entryId) ?? null) : null);
