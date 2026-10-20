import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import type { DayZone } from '@/lib/public/types';

// Display-only marks on a scheduled day (TRP, row 3.35). The scheduler works on one clock; these two functions change what the
// reader sees without changing a duration, a warning or the order: the clock after a time-zone line, and the times that wait for a flight.

const MIN_PER_DAY = 24 * 60;
const toMin = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** "08:30" moved by `offsetMin` minutes, wrapped into one day. */
export function shiftClock(hhmm: string, offsetMin: number): string {
  const m = (((toMin(hhmm) + offsetMin) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface ZoneRun {
  /** The first entry on the far side of the line: the marker "clocks go back" goes before it. */
  from: number;
  /** One past the last entry still on the far side. */
  to: number;
  /** The first entry back on the home clock (after the drive back): the marker "back on Mountain time" goes before it, or null when the day ends over the line. */
  back: number | null;
}

/**
 * The stretch of a day spent over a time-zone line: from the first thing that happens at one of the zone's stops (the drive in is
 * still on the home clock) to the drive away. Meals, breaks and rests in between are at the stop, so they read in local time too.
 */
export function zoneRun(entries: TimelineEntry[], zone: DayZone): ZoneRun | null {
  const here = new Set(zone.items);
  const member = (e: TimelineEntry): boolean => (e.sourceItemId !== null && here.has(e.sourceItemId)) || (e.insideOf !== undefined && here.has(e.insideOf));
  const first = entries.findIndex(member);
  if (first < 0) return null;
  let from = first;
  while (from > 0 && entries[from - 1]!.kind !== 'leg' && entries[from - 1]!.kind !== 'start') from -= 1;
  let last = first;
  entries.forEach((e, i) => {
    if (member(e)) last = i;
  });
  let to = last + 1;
  while (to < entries.length && entries[to]!.kind !== 'leg' && entries[to]!.kind !== 'end') to += 1;
  let back = to;
  while (back < entries.length && (entries[back]!.kind === 'leg' || entries[back]!.kind === 'sun')) back += 1;
  return { from, to, back: back < entries.length ? back : null };
}

/** The entries as the reader of that zone sees them: the far side of the line in local time, everything else untouched. Sun rows stay on the home clock. */
export function localEntries(entries: TimelineEntry[], zone: DayZone | undefined): TimelineEntry[] {
  const run = zone ? zoneRun(entries, zone) : null;
  if (!zone || !run) return entries;
  return entries.map((e, i) => {
    if (i < run.from || i >= run.to || e.kind === 'sun' || e.kind === 'leg') return e;
    const anchor = e.time.anchor ? { ...e.time.anchor, range: [shiftClock(e.time.anchor.range[0], zone.offsetMin), shiftClock(e.time.anchor.range[1], zone.offsetMin)] as [string, string] } : undefined;
    return { ...e, start: shiftClock(e.start, zone.offsetMin), end: shiftClock(e.end, zone.offsetMin), tz: zone.abbr, time: anchor ? { ...e.time, anchor } : e.time };
  });
}

/** What the page says at the line. */
export function zoneNotes(zone: DayZone): { enter: string; back: string } {
  const h = Math.abs(zone.offsetMin) / 60;
  const unit = h === 1 ? 'hour' : 'hours';
  const dir = zone.offsetMin < 0 ? ['back', 'forward'] : ['forward', 'back'];
  return {
    enter: `${zone.place} is on ${zone.label}: clocks go ${dir[0]} ${h} ${unit}. Times below read in local time (${zone.abbr}).`,
    back: `Back on ${zone.home} (${zone.homeAbbr}): clocks go ${dir[1]} ${h} ${unit}.`,
  };
}

/** The label under a time that waits for a flight. */
export const FLIGHT_NOTE = 'Depends on your flight';

/**
 * A departure day whose flight time the plan does not know: the day's own start, the drive to the airport and the end are tied to the
 * flight, so they read "about" with a note, and the stop that only fits a late flight says so. No clock time is invented.
 */
export function flightEntries(entries: TimelineEntry[], flight: boolean | undefined): TimelineEntry[] {
  if (!flight) return entries;
  return entries.map((e) => {
    const tied = e.kind === 'start' || e.kind === 'end' || (e.kind === 'leg' && e.to?.name !== undefined && /airport/i.test(e.to.name)) || e.optional;
    if (!tied || e.kind === 'sun') return e;
    const note = e.time.note ? `${FLIGHT_NOTE}. ${e.time.note}` : FLIGHT_NOTE;
    return { ...e, time: { ...e.time, confidence: 'anchored' as const, note } };
  });
}
