// The rows a day's rules made, in edit mode (STEP2-E1B): which entries are such rows, what they are called when they are no longer
// on the day, and the one-line note the item sheet shows when removing one leaves the day inconsistent (foundation 4.4: a reversible
// action never asks; it says what stays). Pure. The key itself is core's (core/src/schedule/ruleRows.ts), so the scheduler that hides
// a row and the page that removes it read the same key.
import { isRuleItem, RULE_PREFIX, ruleItemOf, ruleKeyOf, rowsOfKeys } from '@travel/core/schedule/ruleRows.ts';
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';

export { isRuleItem, ruleKeyOf };

/** An entry as the stop actions see it; a timeline entry has every field. */
export interface RowFields {
  id: string;
  day: number;
  addedBy: string;
  kind?: string;
  sub?: string | null;
  sourceItemId?: string | null;
  lane?: string;
}

/**
 * A generated row's id starts with the day number the scheduler made it on (`5-all-meal-lunch`), and that number does not change when a day
 * is inserted or dropped (STEP2-E4: the page shows Day n, the entries keep their ids). The key is read from the id's own number.
 */
const nativeDay = <T extends { id: string; day: number }>(e: T): T => {
  const m = /^(\d+)-/.exec(e.id);
  return m && Number(m[1]) !== e.day ? { ...e, day: Number(m[1]) } : e;
};

/** The `removed` item of a generated row (`rule:all-car-hire`), or null for a stop, a leg or the sun. */
export function ruleItemOfEntry(e: RowFields): string | null {
  if (e.kind === undefined || e.sourceItemId === undefined) return null;
  const key = ruleKeyOf({ id: e.id, day: nativeDay(e).day, kind: e.kind as TimelineEntry['kind'], sub: e.sub ?? null, addedBy: e.addedBy as TimelineEntry['addedBy'], sourceItemId: e.sourceItemId, lane: (e.lane ?? 'all') as TimelineEntry['lane'] });
  return key === null ? null : ruleItemOf(key);
}

/** The ending of a day by where it ends: "the drive back to Banff", "the drive to the airport". */
function endName(sub: string | null, place: string | null): string {
  if (sub === 'at-airport') return 'the drive to the airport';
  if (sub === 'at-home') return 'the drive home';
  if (!place) return 'the end of the day';
  return sub === 'at-next-base' ? `the drive on to ${place}` : `the drive back to ${place}`;
}

/** What a removed row is called in the toast and the changes list: its own title, the end of a day by its drive. */
export function rowName(e: { kind?: string; sub?: string | null; title: string; at?: { name?: string | null } | null }): string {
  return e.kind === 'end' ? endName(e.sub ?? null, e.at?.name ?? null) : e.title;
}

const STEM: [RegExp, string][] = [
  [/^start$/, 'The start of the day'],
  [/^car-hire$/, 'Collect the hire car'],
  [/^checkin$/, 'Check-in'],
  [/^checkout$/, 'Check-out'],
  [/^end$/, 'The drive back'],
  [/^meal-lunch$/, 'Lunch'],
  [/^meal-dinner$/, 'Dinner'],
  [/^rest-at-base-/, 'Rest at the base'],
  [/^rest-/, 'Free time'],
  [/^break-coffee-/, 'Coffee and a snack'],
  [/^break-leg-stretch-/, 'Stretch break'],
  [/^break-/, 'A break'],
  [/^booking-/, 'A booking check-in'],
];

/** Plain words for a rule key, when no timeline shows the row any more: "Lunch", "Collect the hire car". */
export function ruleWords(key: string): string {
  const stem = key.slice(key.indexOf('-') + 1);
  return STEM.find(([re]) => re.test(stem))?.[1] ?? 'A planned row';
}

/**
 * The name of a removed row for the changes list: read from the timelines that still show it (our plan's, as the page first draws it),
 * else the plain words of its key. `item` is the `removed` entry's item (`rule:...`).
 */
export function ruleName(timelines: readonly DayTimeline[], day: number, item: string): string {
  const key = item.slice(RULE_PREFIX.length);
  const e = timelines.find((t) => t.day === day)?.entries.find((x) => ruleKeyOf(x) === key);
  return e ? rowName(e) : ruleWords(key);
}

/**
 * The note under a generated row's actions when removing it leaves something the day still relies on (edit-mode-spec 5.4): the hire
 * car, check-in, and the drive back. Null for any other row. `day` is the day's entries in time order.
 */
export function ruleNote(e: TimelineEntry, day: readonly TimelineEntry[]): string | null {
  const key = ruleKeyOf(nativeDay(e));
  if (key === null) return null;
  const stem = key.slice(key.indexOf('-') + 1);
  if (stem === 'car-hire') {
    const i = day.indexOf(e);
    const drive = day.slice(i + 1).find((x) => x.kind === 'leg' && x.leg?.mode === 'drive' && x.to?.name);
    return drive ? `The drive to ${drive.to!.name} stays; nothing meets the car.` : 'The drives stay; nothing meets the car.';
  }
  if (stem === 'checkin') return `You still sleep in ${e.at?.name ?? 'your stay'}; nothing checks you in.`;
  if (stem === 'end') {
    const lane = key.slice(0, key.indexOf('-'));
    const drives = rowsOfKeys(day.map(nativeDay), [`${lane}-end`]).filter((x) => x.kind === 'leg');
    if (!drives.length) return null;
    const last = [...day].reverse().find((x) => x.lane === e.lane && x.sourceItemId && !x.insideOf && x.kind !== 'sun');
    const name = endName(e.sub, e.at?.name ?? null);
    return `${name[0]!.toUpperCase()}${name.slice(1)} goes; the day ends${last ? ` after ${last.title}` : ' where you are'}.`;
  }
  return null;
}
