import { describe, expect, it } from 'vitest';
import { PLAN_EDIT } from '@travel/core/config/plans.ts';
import { applyOps, type PlanOp } from '@travel/core/plan/ops.ts';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { changeRows } from '@/lib/trip-edit/changes';
import { changeCount, entryMarks } from '@/lib/trip-edit/marks';
import { openTrip, saveOps } from '@/lib/trip-edit/open';
import { maybeOps, moveToDayOps, noteOps, nudgeOps, removeOps, removedWords, stopTarget } from '@/lib/trip-edit/stopOps';
import { afterRedo, afterUndo, emptyStack, loadStack, pushStep, saveStack } from '@/lib/trip-edit/undo';
import { withEdit } from '@/lib/trip-edit/editMode';
import { copy, ID_A, memory } from './helpers';

// STEP2-E1: the operations behind each stop action, the undo stack (cap 50, kept across a reload), the changes rows and the device store.
const base = (): PlanDraft => (copyToPlanDraft(copy({ overrides: {} })) as { success: true; data: PlanDraft }).data;
let n = 0;
const id = (): string => `o-t${++n}`;
const stop = (over: Record<string, unknown> = {}) => ({ id: 'seceda', day: 3, title: 'Seceda ridge', addedBy: 'author', at: { placeSlug: 'seceda' }, ...over });

describe('removing a stop', () => {
  it('removes a published stop with one operation, and its inverse puts it back', () => {
    const d = base();
    const ops = removeOps(d, stop(), id);
    expect(ops).toEqual([{ kind: 'removePlace', id: 'o-t1', day: 3, item: 'seceda' }]);
    const r = applyOps(d, ops);
    expect(r.doc.template?.removed).toEqual([{ op: 'o-t1', day: 3, item: 'seceda' }]);
    const back = applyOps(r.doc, r.inverse);
    expect(back.doc.template?.removed).toEqual([]);
  });

  it('removes a stop of ours that the person had moved, by its own published day', () => {
    let d = base();
    d = applyOps(d, moveToDayOps(d, stop({ day: 3 }), 5, null, id)).doc;
    // it now shows on Day 5
    const t = stopTarget(d, stop({ day: 5 }));
    expect(t).toMatchObject({ id: 'seceda', day: 3, from: 5, added: null });
    const r = applyOps(d, removeOps(d, stop({ day: 5 }), id));
    expect(r.doc.template?.removed).toEqual([expect.objectContaining({ day: 3, item: 'seceda' })]);
  });

  it('removes a place the person added, by its operation', () => {
    let d = base();
    d = applyOps(d, [{ kind: 'addPlace', id: 'o-add', day: 2, ref: 'place/pyramid-lake' } as PlanOp]).doc;
    const e = stop({ id: 'add-pyramid-lake', day: 2, addedBy: 'visitor', title: 'Pyramid Lake' });
    const ops = removeOps(d, e, id);
    expect(ops[0]).toMatchObject({ kind: 'removePlace', added: 'o-add' });
    expect(applyOps(d, ops).doc.template?.added).toEqual([]);
  });

  it('on a built draft is a removePick of the stop', () => {
    const built = { ...base(), template: undefined } as unknown as PlanDraft;
    expect(removeOps(built, stop({ id: 'place/seceda' }), id)).toEqual([{ kind: 'removePick', id: 'o-t' + n, ref: 'place/seceda' }]);
  });

  it('names the toast "Removed X from Day n"', () => {
    expect(removedWords(stop())).toBe('Removed Seceda ridge from Day 3');
  });
});

describe('moving a stop', () => {
  it('moves to another day, at the end when told which stop is last', () => {
    const d = base();
    const ops = moveToDayOps(d, stop(), 4, 'x-last', id);
    expect(ops).toEqual([expect.objectContaining({ kind: 'moveItem', day: 3, item: 'seceda', toDay: 4, after: 'x-last' })]);
    expect(applyOps(d, ops).doc.template?.moved).toHaveLength(1);
  });

  it('moves up after the stop two above, down after the stop below, and is null at the ends', () => {
    const d = base();
    const stops = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(nudgeOps(d, stop({ id: 'c' }), stops, -1, id)![0]).toMatchObject({ item: 'c', toDay: 3, after: 'a' });
    expect(nudgeOps(d, stop({ id: 'b' }), stops, -1, id)![0]).not.toHaveProperty('after');
    expect(nudgeOps(d, stop({ id: 'b' }), stops, 1, id)![0]).toMatchObject({ after: 'c' });
    expect(nudgeOps(d, stop({ id: 'a' }), stops, -1, id)).toBeNull();
    expect(nudgeOps(d, stop({ id: 'd' }), stops, 1, id)).toBeNull();
  });

  it('Add to Maybe is one step of two operations, and one undo restores both', () => {
    const d = base();
    const ops = maybeOps(d, stop(), id)!;
    expect(ops.map((o) => o.kind)).toEqual(['removePlace', 'addMaybe']);
    const r = applyOps(d, ops);
    expect(r.doc.template?.maybe).toHaveLength(1);
    const back = applyOps(r.doc, r.inverse);
    expect(back.doc.template?.maybe).toEqual([]);
    expect(back.doc.template?.removed).toEqual([]);
    expect(maybeOps(d, stop({ at: null }), id)).toBeNull();
  });

  it('a note is keyed by day and item, and an empty text removes it', () => {
    const d = base();
    const r = applyOps(d, noteOps(d, stop(), '  Book the lift  ', id));
    expect(r.doc.template?.notes).toEqual({ '3:seceda': 'Book the lift' });
    expect(applyOps(r.doc, noteOps(r.doc, stop(), '', id)).doc.template?.notes).toEqual({});
  });
});

describe('marks and the changes rows', () => {
  it('marks an added place and a stop moved from another day, in words', () => {
    let d = base();
    d = applyOps(d, [{ kind: 'addPlace', id: 'o-add', day: 2, ref: 'place/pyramid-lake' } as PlanOp, ...moveToDayOps(d, stop(), 5, null, id)]).doc;
    const marks = entryMarks(d);
    expect(marks({ id: 'add-pyramid-lake', day: 2, addedBy: 'visitor' })).toEqual(['Added by you']);
    expect(marks({ id: 'seceda', day: 5, addedBy: 'author' })).toEqual(['Moved from Day 3']);
    expect(marks({ id: 'seceda', day: 3, addedBy: 'author' })).toEqual([]);
  });

  it('lists one row per entry with its own verb, and every row button undoes its entry', () => {
    let d = base();
    d = applyOps(d, [
      { kind: 'addPlace', id: 'o-add', day: 2, ref: 'place/pyramid-lake' },
      { kind: 'removePlace', id: 'o-rm', day: 3, item: 'seceda' },
      { kind: 'moveItem', id: 'o-mv', day: 4, item: 'ortisei', toDay: 5 },
      { kind: 'setVariant', id: 'o-v', day: 2, variant: 'B' },
      { kind: 'setNote', id: 'o-n', key: '3', text: 'Tickets' },
      { kind: 'addMaybe', id: 'o-m', ref: 'place/lago-di-braies' },
    ] as PlanOp[]).doc;
    const names = { item: (x: string) => (x === 'seceda' ? 'Seceda ridge' : null), place: (s: string) => (s === 'pyramid-lake' ? 'Pyramid Lake' : null) };
    const rows = changeRows(d, names, id);
    expect(rows.map((r) => r.verb).sort()).toEqual(['Move it back', 'Put it back', 'Put it back', 'Remove it', 'Remove note', 'Use our version']);
    expect(rows.find((r) => r.verb === 'Remove it')!.text).toBe('Added Pyramid Lake to Day 2');
    expect(rows.find((r) => r.text.startsWith('Removed'))!.text).toBe('Removed Seceda ridge from Day 3');
    // every template entry is a row: the count the page shows and the rows agree
    expect(rows).toHaveLength(changeCount(d));
    for (const r of rows) d = applyOps(d, r.ops).doc;
    expect(changeCount(d)).toBe(0);
  });

  it('Reset to our plan is one operation and its inverse brings every change back', () => {
    let d = base();
    d = applyOps(d, [{ kind: 'removePlace', id: 'o-1', day: 1, item: 'a' }, { kind: 'removePlace', id: 'o-2', day: 2, item: 'b' }] as PlanOp[]).doc;
    const r = applyOps(d, [{ kind: 'reset', id: 'o-r', day: null }] as PlanOp[]);
    expect(changeCount(r.doc)).toBe(0);
    expect(changeCount(applyOps(r.doc, r.inverse).doc)).toBe(2);
    expect(PLAN_EDIT.resetConfirmOver).toBe(3);
  });
});

describe('the undo stack (EA5)', () => {
  const step = (i: number) => ({ ops: [{ kind: 'deleteEntry', id: `o-${i}`, target: `o-t${i}` } as PlanOp], label: `Step ${i}` });

  it('keeps 50 steps and drops the oldest when a 51st arrives', () => {
    let s = emptyStack();
    for (let i = 1; i <= 51; i++) s = pushStep(s, step(i));
    expect(s.past).toHaveLength(PLAN_EDIT.undoSteps);
    expect(s.past[0]!.label).toBe('Step 2');
    expect(s.past.at(-1)!.label).toBe('Step 51');
  });

  it('undo moves a step to redo, redo moves it back, and a new change clears redo', () => {
    let s = pushStep(pushStep(emptyStack(), step(1)), step(2));
    s = afterUndo(s, step(20));
    expect(s.past.map((x) => x.label)).toEqual(['Step 1']);
    expect(s.future.map((x) => x.label)).toEqual(['Step 20']);
    s = afterRedo(s, step(2));
    expect(s.future).toEqual([]);
    s = pushStep(afterUndo(s, step(20)), step(3));
    expect(s.future).toEqual([]);
  });

  it('survives a reload: it is read back from the tab session, capped, and an unreadable value is an empty stack', () => {
    const store = memory();
    let s = emptyStack();
    for (let i = 1; i <= 60; i++) s = pushStep(s, step(i));
    saveStack(store, ID_A, s);
    expect(loadStack(store, ID_A).past).toHaveLength(50);
    expect(loadStack(store, ID_A).past.at(-1)!.label).toBe('Step 60');
    store.setItem(`travel.trip-edit.undo.${ID_A}`, '{not json');
    expect(loadStack(store, ID_A)).toEqual(emptyStack());
    saveStack(store, ID_A, emptyStack());
    expect(store.getItem(`travel.trip-edit.undo.${ID_A}`)).toBeNull();
  });
});

describe('a device copy keeps its removals and moves (the sidecar)', () => {
  it('writes the template lists beside the copy and lays them back over it on the next open, with the added places keeping their ids', () => {
    const s = memory([copy({ overrides: {} })]);
    const ops: PlanOp[] = [
      { kind: 'removePlace', id: 'o-rm', day: 3, item: 'seceda' },
      { kind: 'moveItem', id: 'o-mv', day: 4, item: 'ortisei', toDay: 5 },
      { kind: 'addPlace', id: 'o-ad', day: 2, ref: 'place/pyramid-lake' },
    ];
    expect(saveOps(ID_A, ops, { storage: s })).toEqual({ ok: true });
    const r = openTrip(ID_A, { storage: s });
    expect(r.kind === 'ok' && r.doc.template?.removed).toEqual([{ op: 'o-rm', day: 3, item: 'seceda' }]);
    expect(r.kind === 'ok' && r.doc.template?.moved).toHaveLength(1);
    expect(r.kind === 'ok' && r.doc.template?.added[0]!.op).toBe('o-ad');
    // an undo is saved like any other change, and an empty set leaves nothing behind
    const undo = applyOps((r as { doc: PlanDraft }).doc, [{ kind: 'reset', id: 'o-z', day: null }] as PlanOp[]);
    expect(saveOps(ID_A, [{ kind: 'reset', id: 'o-z', day: null }] as PlanOp[], { storage: s })).toEqual({ ok: true });
    expect(changeCount(undo.doc)).toBe(0);
    expect(s.getItem('travel.trip-edit.device')).toBeNull();
  });

  it('forgets the lists of a copy that is gone', () => {
    const s = memory([copy({ overrides: {} })]);
    saveOps(ID_A, [{ kind: 'removePlace', id: 'o-rm', day: 3, item: 'seceda' } as PlanOp], { storage: s });
    expect(s.getItem('travel.trip-edit.device')).toContain(ID_A);
    s.setItem('travel.copies.local', JSON.stringify({ schema: 'copies/1', items: [], noteSeen: null, snoozedUntil: null, merged: {} }));
    expect(openTrip(ID_A, { storage: s })).toEqual({ kind: 'missing' });
  });
});

describe('the address', () => {
  it('adds and removes edit=1 and keeps the other keys and the fragment', () => {
    expect(withEdit(new URL('https://x.test/t/abc/?view=day#day-3'), true)).toBe('/t/abc/?view=day&edit=1#day-3');
    expect(withEdit(new URL('https://x.test/t/abc/?view=day&edit=1#day-3'), false)).toBe('/t/abc/?view=day#day-3');
    expect(withEdit(new URL('https://x.test/t/abc/?edit=1'), false)).toBe('/t/abc/');
  });
});
