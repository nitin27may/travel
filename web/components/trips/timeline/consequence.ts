import { fmtHM } from '@travel/core/schedule/rules.ts';
import type { DayTimeline, Profile, ScheduleDayInput, ScheduleItem, ScheduleOptions } from '@travel/core/schedule/types.ts';
import { formatDistance, type DistanceUnit } from '@/lib/format/units';
import type { Engine } from './useTimeline';
import { warnText } from './warnText';

// What a change would do to a day, worked out by the scheduler itself so the figure on the button is the figure the day shows after
// the click (principle P6: the cost sits where the choice is made). Nothing here is typed by hand.

const toMin = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** A day that would end after this is not offered an addition (the scheduler clamps a clock at 23:59, which hides the overrun). */
export const LATEST_END = '23:00';

export interface AddCost {
  /** Extra driving the addition brings, in minutes, never negative. */
  driveMin: number;
  /** When the day ends with the addition, "HH:MM". */
  ends: string;
  /** The day would end after 23:00: the addition is not offered. */
  tooLate: boolean;
  /** A condensed plan has parts of the day, not clock times: no end to report. */
  blocks: boolean;
}

/** The day with and without one more place: the drive added and where the day then ends. */
export function addCost(engine: Engine, input: ScheduleDayInput, profile: Profile, opts: ScheduleOptions, item: ScheduleItem): AddCost {
  const before = engine.scheduleDay(input, profile, opts);
  const after = engine.scheduleDay(input, profile, { ...opts, added: [...(opts.added ?? []), item] });
  return { driveMin: Math.max(0, after.totals.driveMin - before.totals.driveMin), ends: after.span.end, tooLate: !after.blocks && toMin(after.span.end) > toMin(LATEST_END), blocks: after.blocks };
}

/** "adds about 2 h of driving", "adds no driving", or "Ends after 23:00, not added". */
export function costLine(c: AddCost): string {
  if (c.tooLate) return `Ends after ${LATEST_END}, not added`;
  const drive = c.driveMin >= 10 ? `adds about ${fmtHM(c.driveMin)} of driving` : 'adds no driving';
  return c.blocks ? drive : `${drive}, day ends about ${c.ends}`;
}

export interface VariantLine {
  /** One line of what the version asks of the day for the profile in force: walk, drive, and when it ends. */
  line: string;
  /** Why it does not fit this party, or that the day runs long; null when nothing needs saying. */
  warn: string | null;
  /** How a warning reads (ER-016): a rule the party fails is Fix (the minimum age of a stop), the day running long is advice, Check. */
  level: 'fix' | 'check' | null;
}

/** The consequence of picking a version, from the scheduled day itself. */
export function variantLine(tl: DayTimeline, unit: DistanceUnit): VariantLine {
  const parts = [
    tl.totals.walkKm > 0 ? `${formatDistance(tl.totals.walkKm, unit)} walking` : 'no walk planned',
    tl.totals.driveMin > 0 ? `${fmtHM(tl.totals.driveMin)} driving` : null,
    tl.blocks ? null : `${tl.span.start} to ${tl.span.end}`,
  ].filter(Boolean);
  const noFit = tl.notes.find((n) => n.kind === 'no-fit');
  const cap = tl.warnings.find((w) => w.code === 'S_DAY_CAP');
  const warn = noFit ? noFit.text.replace(/^.*?picked for this day\.\s*/, '').replace(/\.$/, '') : cap ? warnText(cap.message.replace(/ Optional: .*$/, '')) : null;
  return { line: parts.join(' · '), warn, level: noFit ? 'fix' : cap ? 'check' : null };
}
