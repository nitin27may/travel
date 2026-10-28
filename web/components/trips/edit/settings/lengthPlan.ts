// A change of length from the Dates section (edit-mode-spec 9.2; STEP2-E4): longer asks where the new days go, shorter asks which days go and
// what happens to their stops; Apply makes `insertDay` or `dropDay` operations, one undo step. Pure over the document and the days'
// stops. Days are the numbers the page shows (Day n), the operations name them by ref (lib/trip-edit/dayMap.ts).
import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import { newOpId } from '@/lib/trip-edit/stopOps';
import { dropDayOps, insertAfterOf, type DropHow } from '../day/dayOps';

export type LengthChange =
  /** `count` empty days after Day `after` (the last day: at the end) */
  | { kind: 'add'; count: number; after: number }
  /** these days go; their stops move to the nearest day that stays, go to Maybe, or go with them */
  | { kind: 'drop'; days: readonly number[]; how: 'move' | 'maybe' | 'remove' };

/** The day that stays and takes the stops of dropped Day `n`: the nearest one before it, else the nearest after. Null when no day stays. */
export function stayingDay(n: number, count: number, dropped: ReadonlySet<number>): number | null {
  for (let d = n - 1; d >= 1; d--) if (!dropped.has(d)) return d;
  for (let d = n + 1; d <= count; d++) if (!dropped.has(d)) return d;
  return null;
}

export function lengthOps(doc: PlanDraft, change: LengthChange, count: number, stopsOf: (n: number) => readonly TimelineEntry[], newId: () => string = newOpId): PlanOp[] {
  if (change.kind === 'add') return Array.from({ length: change.count }, () => ({ kind: 'insertDay' as const, id: newId(), after: insertAfterOf(doc, change.after) }));
  const gone = new Set(change.days);
  const ops: PlanOp[] = [];
  // the days go from the back, so each one's target is named by the document's own days (refs do not move)
  for (const n of [...change.days].sort((a, b) => b - a)) {
    const to = change.how === 'move' ? stayingDay(n, count, gone) : null;
    const how: DropHow = to !== null ? { kind: 'move', to } : { kind: change.how === 'maybe' ? 'maybe' : 'remove' };
    ops.push(...dropDayOps(doc, n, how, stopsOf(n), newId));
  }
  return ops;
}

/** "Day 7", "Days 6 and 7", "Days 5, 6 and 7". */
export function dayList(days: readonly number[]): string {
  const d = [...days].sort((a, b) => a - b);
  return d.length === 1 ? `Day ${d[0]}` : `Days ${d.slice(0, -1).join(', ')} and ${d[d.length - 1]}`;
}

/** The confirm when a dropped day holds a booking: "Drop Day 7 and its canoe booking?" */
export const bookingsLine = (days: readonly number[], names: readonly string[]): string => `Drop ${dayList(days)} and ${names.length === 1 ? `its ${names[0]} booking` : `its ${names.length} bookings`}?`;

/** The words before Apply: "Add 2 days · after Day 4" and "Drop Day 7 · its 2 stops move to Day 6". */
export function lengthLine(change: LengthChange, count: number, stopsOf: (n: number) => readonly TimelineEntry[]): string {
  if (change.kind === 'add') return `Add ${change.count} ${change.count === 1 ? 'day' : 'days'} · ${change.after >= count ? 'at the end' : `after Day ${change.after}`}`;
  const gone = new Set(change.days);
  const days = [...change.days].sort((a, b) => a - b);
  const list = dayList(days);
  const stops = days.reduce((s, n) => s + stopsOf(n).length, 0);
  if (stops === 0) return `Drop ${list} · no stops on ${days.length === 1 ? 'it' : 'them'}`;
  const words = `${stops === 1 ? 'its stop' : `their ${stops} stops`}`;
  if (change.how === 'maybe') return `Drop ${list} · ${words} ${stops === 1 ? 'goes' : 'go'} to Maybe`;
  if (change.how === 'remove') return `Drop ${list} · ${words} ${stops === 1 ? 'is' : 'are'} removed`;
  const to = [...new Set(days.map((n) => stayingDay(n, count, gone)))].filter((x): x is number => x !== null);
  return `Drop ${list} · ${words} ${stops === 1 ? 'moves' : 'move'} to ${to.length === 1 ? `Day ${to[0]}` : 'the days that stay'}`;
}
