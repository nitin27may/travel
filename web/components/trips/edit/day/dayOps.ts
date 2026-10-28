// The operations behind each day action of a copy (edit-mode-spec 6; STEP2-E4) and the words for their toasts. Pure: the document, the day
// as the page shows it (Day n) and an id maker go in; a list of operations (one undo step) comes out. The document names a day by its ref
// (a published number, or an added day's operation id), so every number goes through lib/trip-edit/dayMap.ts.
import { PLAN_DOC_LIMITS } from '@travel/core/config/plans.ts';
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';
import { daySlots, nOfRef, refOfDay, type DayRef } from '@/lib/trip-edit/dayMap';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import { newOpId, placeRefOf } from '@/lib/trip-edit/stopOps';

type NewId = () => string;
const ops = (d: PlanDraft) => d.template?.days ?? [];

/** The days a copy holds now: our plan's, plus the added days, less the dropped ones. `published` is the number of days of our plan. */
export const dayCount = (d: PlanDraft, published: number): number => published + ops(d).reduce((n, x) => n + (x.kind === 'insert' ? 1 : typeof x.day === 'number' ? -1 : 0), 0);

/** Why Add a day is not possible, or null. The cap is `PLAN_DOC_LIMITS` (the days of a copy, and how many day operations a document holds). */
export function addDayBlock(d: PlanDraft, published: number): string | null {
  if (ops(d).length >= PLAN_DOC_LIMITS.dayOps) return `A copy holds at most ${PLAN_DOC_LIMITS.dayOps} added or dropped days`;
  if (dayCount(d, published) >= PLAN_DOC_LIMITS.templateDays) return `A trip holds at most ${PLAN_DOC_LIMITS.templateDays} days`;
  return null;
}

/** The published day an inserted day goes after, for "after Day n": Day n itself, or the published day before it when Day n is an added day. */
export function insertAfterOf(d: PlanDraft, n: number): number {
  const slots = daySlots(ops(d), n);
  for (let i = Math.min(n, slots.length) - 1; i >= 0; i--) {
    const r = slots[i]!.ref;
    if (typeof r === 'number') return r;
  }
  return 0;
}

/** Add a day after Day n: an empty day with the base of the day before (the scheduler's `insertDay`). */
export function addDayOps(d: PlanDraft, n: number, newId: NewId = newOpId): PlanOp[] {
  return [{ kind: 'insertDay', id: newId(), after: insertAfterOf(d, n) }];
}

/** The number the added day will show once `op` is applied (it lands after the days already added at the same place, so it may not be n + 1). */
export function addedDayNumber(d: PlanDraft, op: PlanOp): number | null {
  if (op.kind !== 'insertDay') return null;
  return nOfRef([...ops(d), { op: op.id, kind: 'insert', after: op.after }], op.id);
}

/** What happens to the stops of a dropped day. */
export type DropHow = { kind: 'move'; to: number } | { kind: 'maybe' } | { kind: 'remove' };

/** The stops of a day: the entries that are places of the plan or added by the person (not legs, meals the rules placed, the sun, or a regroup, which is not a place). */
export const dropStops = (entries: readonly TimelineEntry[]): TimelineEntry[] =>
  entries.filter((e) => !!e.sourceItemId && !e.insideOf && !e.block && e.kind !== 'sun' && e.kind !== 'leg' && e.kind !== 'booking' && e.addedBy !== 'scheduler' && !(e.kind === 'rest' && e.sub === 'together'));

/**
 * The bookings a day holds, by name: a stop with a booking check-in row (a slot the operator holds), and the rows of the Bookings tab that
 * count from this published day. Dropping the day releases none of them, so the person is asked once (patterns 4.4).
 */
export function dayBookings(tl: Pick<DayTimeline, 'entries'>, rows: readonly { name: string; day: number | null }[], publishedDay: number | null): string[] {
  const names: string[] = [];
  for (const e of tl.entries) {
    if (e.kind !== 'booking' || !e.bookingOf) continue;
    const stop = tl.entries.find((x) => x.id === e.bookingOf);
    names.push(stop?.title ?? e.title.replace(/^Check in for /, ''));
  }
  if (publishedDay !== null) for (const r of rows) if (r.day === publishedDay && !names.includes(r.name)) names.push(r.name);
  return names;
}

/** "Drop Day 7 and its canoe booking?" / "Drop Day 7 and its 2 bookings?" */
export function bookingQuestion(n: number, names: readonly string[]): string {
  return names.length === 1 ? `Drop Day ${n} and its ${names[0]} booking?` : `Drop Day ${n} and its ${names.length} bookings?`;
}

/**
 * Drop Day n. The day's stops move to the end of another day, go to Maybe, or go with the day (the first two keep them). Maybe is one step
 * with the drop: only stops with a place page can be kept there, and the rest go with the day.
 */
export function dropDayOps(d: PlanDraft, n: number, how: DropHow, stops: readonly TimelineEntry[], newId: NewId = newOpId): PlanOp[] {
  const days = ops(d);
  const day = refOfDay(days, n);
  if (how.kind === 'move') return [{ kind: 'dropDay', id: newId(), day, to: refOfDay(days, how.to) }];
  const keep: PlanOp[] = [];
  if (how.kind === 'maybe') {
    const seen = new Set((d.template?.maybe ?? []).map((m) => m.ref));
    for (const e of stops) {
      const ref = placeRefOf(e);
      if (ref && !seen.has(ref)) {
        seen.add(ref);
        keep.push({ kind: 'addMaybe', id: newId(), ref });
      }
    }
  }
  return [...keep, { kind: 'dropDay', id: newId(), day }];
}

/** The toast for a drop. The day the stops moved to keeps its place, so past the dropped day it shows one number lower. */
export function droppedWords(n: number, how: DropHow, stops: number): string {
  if (stops === 0) return `Dropped Day ${n}`;
  if (how.kind === 'move') return `Dropped Day ${n} · ${stops === 1 ? 'its stop moved' : `its ${stops} stops moved`} to Day ${how.to > n ? how.to - 1 : how.to}`;
  if (how.kind === 'maybe') return `Dropped Day ${n} · ${stops === 1 ? 'its stop is' : `its ${stops} stops are`} in Maybe`;
  return `Dropped Day ${n} and ${stops === 1 ? 'its stop' : `its ${stops} stops`}`;
}

/** Whether our plan's Day `ref` differs from what the person has made of it: a version, a stop off, on or moved. (Notes stay when a day resets.) */
export function dayChanged(d: PlanDraft, ref: DayRef): boolean {
  const t = d.template;
  if (!t || typeof ref !== 'number') return false;
  return (
    t.overrides[String(ref)] !== undefined ||
    t.added.some((a) => a.day === ref) ||
    t.removed.some((r) => r.day === ref) ||
    t.moved.some((m) => m.day === ref || m.toDay === ref)
  );
}

/** Reset Day n to our plan: published days only, undoable, no confirm. */
export function resetDayOps(d: PlanDraft, n: number, newId: NewId = newOpId): PlanOp[] | null {
  const ref = refOfDay(ops(d), n);
  return typeof ref === 'number' ? [{ kind: 'reset', id: newId(), day: ref }] : null;
}

/** The key a day's note lives under: the published number as text, or the added day's operation id. */
export const dayNoteKey = (d: PlanDraft, n: number): string => String(refOfDay(ops(d), n));
export const dayNoteOf = (d: PlanDraft, n: number): string => d.template?.notes[dayNoteKey(d, n)] ?? '';
export function dayNoteOps(d: PlanDraft, n: number, text: string, newId: NewId = newOpId): PlanOp[] {
  const t = text.trim();
  return [{ kind: 'setNote', id: newId(), key: dayNoteKey(d, n) as never, text: t === '' ? null : t }];
}

/** Version of Day n (published days only): a version key, or null for the one chosen for the party. */
export function versionOps(d: PlanDraft, n: number, key: 'A' | 'B' | 'C' | null, newId: NewId = newOpId): PlanOp[] | null {
  const ref = refOfDay(ops(d), n);
  return typeof ref === 'number' ? [{ kind: 'setVariant', id: newId(), day: ref, variant: key }] : null;
}
