// The operations behind each stop action (edit-mode-spec 5; template and built columns). Pure: the document, the entry the person
// pressed and an id maker go in, a list of operations (one undo step) and the words for the toast come out.
import type { PlanOp, PlanDraft } from './model';
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

/** A published stop's own day: where our plan has it, which differs from where it shows once the person moved it. */
function publishedDay(d: PlanDraft, e: StopEntry): number {
  return d.template?.moved.find((m) => m.item === e.id && m.toDay === e.day)?.day ?? e.day;
}

const target = (d: PlanDraft, e: StopEntry): { added: string } | { day: number; item: string } => {
  // a row the rules made (a meal, a rest, the hire car, check-in, the end of the day) is named by its rule key on the day it shows
  const rule = ruleItemOfEntry(e);
  if (rule) return { day: e.day, item: rule };
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
  return [{ kind: 'moveItem', id: newId(), ...target(d, e), toDay, ...(after ? { after } : {}) }];
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
  return [{ kind: 'moveItem', id: newId(), ...target(d, e), toDay: day, ...(after ? { after } : {}) }];
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
export const maybeWords = (e: StopEntry): string => `Moved ${e.title} to Maybe`;

/** What the Move to day list needs to try a move: the stop's schedule id, its published day, the day it shows on, and its added-place op. */
export function stopTarget(d: PlanDraft, e: StopEntry): { id: string; day: number; from: number; added: string | null } {
  return { id: e.id, day: publishedDay(d, e), from: e.day, added: addedOp(d, e) };
}
