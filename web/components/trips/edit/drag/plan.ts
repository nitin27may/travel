// The pure half of drag and the keyboard model (STEP2-E2; edit-mode-spec 5.2, 5.3): where a stop lands, the operations that put it
// there, the words that say so. No DOM and no React, so each rule is a unit test. The moves are E1's own operations (`moveItem`), so one
// drag or one lift-and-drop is one undo step, the same as the Move to day sheet.
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import { moveToDayOps, newOpId, nudgedWords, type StopEntry } from '@/lib/trip-edit/stopOps';

/** Where a stop would land: a day, and the place among that day's OTHER stops (0 = before the first, n = after the last). */
export interface Target {
  day: number;
  index: number;
}

/** Position words use one-based places among every stop of the day, the dragged one included: "position 2 of 4". */
export const positionOf = (t: Target, othersInDay: number): { place: number; of: number } => ({ place: t.index + 1, of: othersInDay + 1 });

/**
 * The stop a move lands after: the nearest stop before `index` that our plan wrote. An added place is not an anchor in a copy (the
 * scheduler moves published stops before it places added ones), which is the rule `nudgeOps` already follows; a built trip anchors on any.
 * Null means the start of the day.
 */
export function anchorAfter(d: PlanDraft, others: readonly { id: string }[], index: number): string | null {
  for (let k = Math.min(index, others.length) - 1; k >= 0; k--) {
    const s = others[k]!;
    if (!d.template || !s.id.startsWith('add-')) return s.id;
  }
  return null;
}

/** The operations of a drop, or null when the stop would not move (dropped where it started). `others` are the target day's stops without the dragged one. */
export function dropOps(d: PlanDraft, e: StopEntry, t: Target, others: readonly { id: string }[], from: Target, newId: () => string = newOpId): PlanOp[] | null {
  if (t.day === from.day && t.index === from.index) return null;
  const after = anchorAfter(d, others, t.index);
  if (!d.template && after === null) return [{ kind: 'moveItem', id: newId(), ref: e.id, toDay: t.day, first: true }];
  return moveToDayOps(d, e, t.day, after, newId);
}

/** The toast and the undo label of a drop. */
export function dropWords(e: StopEntry, t: Target, from: Target, othersInDay: number): string {
  if (t.day !== from.day) return `Moved ${e.title} to Day ${t.day}`;
  if (Math.abs(t.index - from.index) === 1) return nudgedWords(e, t.index < from.index ? -1 : 1);
  const p = positionOf(t, othersInDay);
  return `Moved ${e.title} to position ${p.place} of ${p.of}`;
}

/** What a screen reader hears on each step and after the drop: "Seceda, Day 3, position 2 of 4". */
export const stepWords = (e: StopEntry, t: Target, othersInDay: number): string => {
  const p = positionOf(t, othersInDay);
  return `${e.title}, Day ${t.day}, position ${p.place} of ${p.of}`;
};
export const lifted = (e: StopEntry, t: Target, othersInDay: number): string => `Lifted ${stepWords(e, t, othersInDay)}. Arrow keys move it, Page Up and Page Down change the day, Space drops it, Escape puts it back.`;
export const droppedWords = (e: StopEntry, t: Target, othersInDay: number, crossDay: boolean): string => {
  const p = positionOf(t, othersInDay);
  return crossDay ? `Moved ${e.title} to Day ${t.day}, position ${p.place} of ${p.of}` : `Moved ${e.title}, position ${p.place} of ${p.of}`;
};
export const cancelledWords = (e: StopEntry, from: Target, othersInDay: number): string => `Cancelled. ${stepWords(e, from, othersInDay)}`;

export type MoveKey = 'up' | 'down' | 'pageup' | 'pagedown' | 'home' | 'end';
export const MOVE_KEYS: Record<string, MoveKey> = { ArrowUp: 'up', ArrowDown: 'down', PageUp: 'pageup', PageDown: 'pagedown', Home: 'home', End: 'end' };

/**
 * The target after a key while lifted. `counts` is the number of OTHER stops of each day (the dragged one left out), `days` the day
 * numbers in order. Page keys keep the place, clamped to the new day. Returns the same target when there is nowhere to go.
 */
export function keyTarget(cur: Target, key: MoveKey, counts: ReadonlyMap<number, number>, days: readonly number[]): Target {
  const n = counts.get(cur.day) ?? 0;
  switch (key) {
    case 'up':
      return { day: cur.day, index: Math.max(0, cur.index - 1) };
    case 'down':
      return { day: cur.day, index: Math.min(n, cur.index + 1) };
    case 'home':
      return { day: cur.day, index: 0 };
    case 'end':
      return { day: cur.day, index: n };
    default: {
      const i = days.indexOf(cur.day);
      const to = days[i + (key === 'pageup' ? -1 : 1)];
      if (i < 0 || to === undefined) return cur;
      return { day: to, index: Math.min(cur.index, counts.get(to) ?? 0) };
    }
  }
}

/** The pill: "to Day 3 · before 11:30 · +42 min driving ≈". `before` is the next stop's time, null at the end of a day. */
export function pillText(day: number, before: string | null, driving: string | null): string {
  return [`to Day ${day}`, before ? `before ${before}` : 'at the end', driving ? `${driving} ≈` : null].filter(Boolean).join(' · ');
}

/** The slot index a pointer at `y` lands in, given the vertical middles of the day's other stops, in order. */
export const indexAt = (mids: readonly number[], y: number): number => mids.filter((m) => m < y).length;

/** How far to scroll this frame: negative near the top edge, positive near the bottom, zero between. Speed grows as the pointer nears the edge. */
export function edgeSpeed(y: number, viewportH: number, edge: number, max: number): number {
  if (y < edge) return -Math.ceil(Math.min(1, (edge - Math.max(y, 0)) / edge) * max);
  if (y > viewportH - edge) return Math.ceil(Math.min(1, (Math.min(y, viewportH) - (viewportH - edge)) / edge) * max);
  return 0;
}
