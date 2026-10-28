// The operations behind each stop action (edit-mode-spec 5; template and built columns). Pure: the document, the entry the person
// pressed and an id maker go in, a list of operations (one undo step) and the words for the toast come out.
import type { PlanOp, PlanDraft } from './model';
import { refOfDay, type DayRef } from './dayMap';
import { rowName, ruleItemOfEntry, type RowFields } from './ruleRows';

/** The slice of a timeline entry these functions read; `kind`, `sub`, `sourceItemId` and `lane` tell a row the rules made (STEP2-E1B). */
export interface StopEntry extends RowFields {
  title: string;
  at?: { placeSlug?: string | null; name?: string } | null;
}

const PLACE = 'place/';
export const newOpId = (): string => `o-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
type NewId = () => string;

/** The place a stop is, as a catalogue ref, when it has a page. */
export const placeRefOf = (e: StopEntry): string | null => (e.at?.placeSlug ? `${PLACE}${e.at.placeSlug}` : null);

/** The entry of `template.added` an added place made, by its place. */
function addedOp(d: PlanDraft, e: StopEntry): string | null {
  if (e.addedBy !== 'visitor' || !e.id.startsWith('add-')) return null;
  const ref = `${PLACE}${e.id.slice(4)}`;
  return d.template?.added.find((a) => a.ref === ref)?.op ?? null;
}

/**
 * The document names a day by its ref (a published number, or an inserted day's operation id); the page shows it as Day n, which differs
 * once a day was inserted or dropped (STEP2-E4, lib/trip-edit/dayMap.ts). Every operation here goes through this.
 */
export const dayRef = (d: PlanDraft, n: number): DayRef => (d.template ? refOfDay(d.template.days, n) : n);

/** A published stop's own day: where our plan has it, which differs from where it shows once the person moved it. */
function publishedDay(d: PlanDraft, e: StopEntry): number {
  const here = dayRef(d, e.day);
  return d.template?.moved.find((m) => m.item === e.id && m.toDay === here)?.day ?? (typeof here === 'number' ? here : e.day);
}

const target = (d: PlanDraft, e: StopEntry): { added: string } | { day: number; item: string } => {
  // a row the rules made (a meal, a rest, the hire car, check-in, the end of the day) is named by its rule key on the day it shows
  const rule = ruleItemOfEntry(e);
  if (rule) {
    const day = dayRef(d, e.day);
    return { day: typeof day === 'number' ? day : e.day, item: rule };
  }
  const op = addedOp(d, e);
  return op ? { added: op } : { day: publishedDay(d, e), item: e.id };
};

/** Remove: any stop (published, added, from our trip, engine-placed), or a row the rules made (STEP2-E1B, template only). One undo step. */
export function removeOps(d: PlanDraft, e: StopEntry, newId: NewId = newOpId): PlanOp[] {
  if (!d.template) return [{ kind: 'removePick', id: newId(), ref: e.id }];
  return [{ kind: 'removePlace', id: newId(), ...target(d, e) }];
}

/** Move to another day: the end of that day (a published stop moved with no `after` goes to the start, so the caller passes the last stop). */
export function moveToDayOps(d: PlanDraft, e: StopEntry, toDay: number, after: string | null, newId: NewId = newOpId): PlanOp[] {
  if (!d.template) return [{ kind: 'moveItem', id: newId(), ref: e.id, toDay, ...(after ? { afterRef: after } : {}) }];
  return [{ kind: 'moveItem', id: newId(), ...target(d, e), toDay: dayRef(d, toDay), ...(after ? { after } : {}) }];
}

/**
 * Move up or down inside the day. `stops` are the day's stops in time order. Up goes after the stop two above (or to the start); down
 * after the stop below. A stop our plan did not write (an added place with no explicit place) is not a position to anchor on: the nearest
 * stop of the plan before it is used instead. Null when there is nowhere to go.
 */
export function nudgeOps(d: PlanDraft, e: StopEntry, stops: readonly { id: string }[], dir: -1 | 1, newId: NewId = newOpId): PlanOp[] | null {
  const i = stops.findIndex((s) => s.id === e.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= stops.length) return null;
  const anchorIdx = dir === -1 ? i - 2 : i + 1;
  const planned = (id: string): boolean => !id.startsWith('add-');
  let after: string | null = null;
  for (let k = anchorIdx; k >= 0; k--) {
    const s = stops[k]!;
    if (s.id !== e.id && (planned(s.id) || !d.template)) {
      after = s.id;
      break;
    }
  }
  if (dir === 1 && after === null) return null;
  const day = e.day;
  if (!d.template) {
    return after === null ? [{ kind: 'moveItem', id: newId(), ref: e.id, toDay: day, first: true }] : [{ kind: 'moveItem', id: newId(), ref: e.id, toDay: day, afterRef: after }];
  }
  return [{ kind: 'moveItem', id: newId(), ...target(d, e), toDay: dayRef(d, day), ...(after ? { after } : {}) }];
}

/** The nearest stop before position `i` that the plan wrote (an added place is no anchor in a template, the schedule has no id for it). */
function anchorBefore(d: PlanDraft, order: readonly { id: string }[], i: number, skipId: string): string | null {
  for (let k = i - 1; k >= 0; k--) {
    const s = order[k]!;
    if (s.id !== skipId && (!d.template || !s.id.startsWith('add-'))) return s.id;
  }
  return null;
}

/** One stop to the day, after `after` (null: the start of the day), in the draft's own form. */
function placeOp(d: PlanDraft, e: StopEntry, toDay: number, after: string | null, newId: NewId): PlanOp {
  if (!d.template) return after === null ? { kind: 'moveItem', id: newId(), ref: e.id, toDay, first: true } : { kind: 'moveItem', id: newId(), ref: e.id, toDay, afterRef: after };
  return { kind: 'moveItem', id: newId(), ...target(d, e), toDay: dayRef(d, toDay), ...(after ? { after } : {}) };
}

/**
 * Swap with another stop of the trip (edit-mode-spec 5.2): each takes the other's place in the other's day. Two moves, returned together so
 * the caller makes them one undo step. `stopsOf` gives a day's stops in time order. A same-day swap exchanges the two positions. Null when
 * the two are the same stop.
 */
export function swapOps(d: PlanDraft, a: StopEntry & { day: number }, b: StopEntry & { day: number }, stopsOf: (day: number) => readonly { id: string }[], newId: NewId = newOpId): PlanOp[] | null {
  if (a.id === b.id && a.day === b.day) return null;
  const same = a.day === b.day;
  const orderA = stopsOf(a.day).map((s) => ({ id: s.id }));
  const orderB = same ? orderA : stopsOf(b.day).map((s) => ({ id: s.id }));
  const ia = orderA.findIndex((s) => s.id === a.id);
  const ib = orderB.findIndex((s) => s.id === b.id);
  if (ia < 0 || ib < 0) return null;
  if (same) {
    orderA[ia] = { id: b.id };
    orderA[ib] = { id: a.id };
  } else {
    orderA[ia] = { id: b.id };
    orderB[ib] = { id: a.id };
  }
  // where each lands in its new day: after the stop that now stands before it
  const newA = (same ? orderA : orderB).findIndex((s) => s.id === a.id);
  const newB = orderA.findIndex((s) => s.id === b.id);
  const afterA = anchorBefore(d, same ? orderA : orderB, newA, a.id);
  const afterB = anchorBefore(d, orderA, newB, b.id);
  const moveA = () => placeOp(d, a, b.day, afterA, newId);
  const moveB = () => placeOp(d, b, a.day, afterB, newId);
  // a stop that goes right after the other waits for it to have moved
  return afterA === b.id ? [moveB(), moveA()] : [moveA(), moveB()];
}

/** Swap for another place (copies): the stop leaves and the chosen place takes its slot in the day, as one step. Null for a built trip. */
export function swapForOps(d: PlanDraft, e: StopEntry, slug: string, dayStops: readonly { id: string }[], newId: NewId = newOpId): PlanOp[] | null {
  if (!d.template) return null;
  const i = dayStops.findIndex((s) => s.id === e.id);
  const after = i < 0 ? null : anchorBefore(d, dayStops, i, e.id);
  return [...removeOps(d, e, newId), { kind: 'addPlace', id: newId(), day: dayRef(d, e.day), ref: `${PLACE}${slug}`, ...(after ? { after } : {}) }];
}

/** Add to Maybe (copies): the stop leaves its day and joins the Maybe list, as one step. Null for a stop with no place page. */
export function maybeOps(d: PlanDraft, e: StopEntry, newId: NewId = newOpId): PlanOp[] | null {
  const ref = placeRefOf(e);
  if (!d.template || !ref) return null;
  return [{ kind: 'removePlace', id: newId(), ...target(d, e) }, { kind: 'addMaybe', id: newId(), ref }];
}

/** The key a stop's note lives under: `<day>:<item>` for a published stop, the entry's operation id for an added place. */
export function noteKeyOf(d: PlanDraft, e: StopEntry): string {
  const t = target(d, e);
  return 'added' in t ? t.added : `${t.day}:${t.item}`;
}
export function noteOps(d: PlanDraft, e: StopEntry, text: string, newId: NewId = newOpId): PlanOp[] {
  const t = text.trim();
  return [{ kind: 'setNote', id: newId(), key: noteKeyOf(d, e), text: t === '' ? null : t }];
}
export const noteOf = (d: PlanDraft, e: StopEntry): string => (d.template ? (d.template.notes[noteKeyOf(d, e)] ?? '') : '');

// ---- the words (README 5.2 toasts; polite announcements) ----
export const removedWords = (e: StopEntry): string => `Removed ${rowName(e)} from Day ${e.day}`;
export const movedWords = (e: StopEntry, to: number): string => `Moved ${e.title} to Day ${to}`;
export const nudgedWords = (e: StopEntry, dir: -1 | 1): string => `Moved ${e.title} ${dir === -1 ? 'up' : 'down'}`;
export const swappedWords = (a: StopEntry, b: StopEntry): string => `Swapped ${a.title} and ${b.title}`;
export const swappedForWords = (a: StopEntry, name: string): string => `Swapped ${a.title} for ${name}`;
export const maybeWords = (e: StopEntry): string => `Moved ${e.title} to Maybe`;

/** What the Move to day list needs to try a move: the stop's schedule id, its published day, the day it shows on, and its added-place op. */
export function stopTarget(d: PlanDraft, e: StopEntry): { id: string; day: number; from: number; added: string | null } {
  return { id: e.id, day: publishedDay(d, e), from: e.day, added: addedOp(d, e) };
}
