import { describe, expect, it } from 'vitest';
import { applyOps } from '@travel/core/plan/ops.ts';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { TRIP_EDIT_UI } from '@/lib/config/product';
import {
  anchorAfter, cancelledWords, dropOps, dropWords, droppedWords, edgeSpeed, indexAt, keyTarget, lifted, pillText, positionOf, stepWords,
} from '@/components/trips/edit/drag/plan';
import { readSingleKeys, SINGLE_KEYS_KEY, writeSingleKeys } from '@/components/trips/edit/drag/singleKeys';
import { copy } from './helpers';

// STEP2-E2: where a dragged or lifted stop lands, the operations of the drop, and the words. The pure half; the pointer and the keys are t-edit-drag and t-edit-keyboard.
const base = (): PlanDraft => (copyToPlanDraft(copy({ overrides: {} })) as { success: true; data: PlanDraft }).data;
let n = 0;
const id = (): string => `o-d${++n}`;
const stop = (over: Record<string, unknown> = {}) => ({ id: 'seceda', day: 3, title: 'Seceda ridge', addedBy: 'author', at: { placeSlug: 'seceda' }, ...over });
const ids = (...a: string[]) => a.map((x) => ({ id: x }));

describe('the anchor of a drop', () => {
  it('is the nearest stop above, and null at the top', () => {
    const d = base();
    expect(anchorAfter(d, ids('a', 'b', 'c'), 0)).toBeNull();
    expect(anchorAfter(d, ids('a', 'b', 'c'), 2)).toBe('b');
    expect(anchorAfter(d, ids('a', 'b', 'c'), 3)).toBe('c');
  });
  it('skips a place the person added in a copy (the scheduler moves plan stops first), but not in a built trip', () => {
    const d = base();
    expect(anchorAfter(d, ids('a', 'add-lake'), 2)).toBe('a');
    expect(anchorAfter(d, ids('add-lake', 'add-pond'), 2)).toBeNull();
    const built = { ...d, template: undefined } as unknown as PlanDraft;
    expect(anchorAfter(built, ids('a', 'add-lake'), 2)).toBe('add-lake');
  });
});

describe('the operations of a drop', () => {
  it('is nothing when it lands where it started', () => {
    expect(dropOps(base(), stop(), { day: 3, index: 1 }, ids('a', 'c'), { day: 3, index: 1 }, id)).toBeNull();
  });
  it('moves within the day to a place, one operation, and undo puts it back', () => {
    const d = base();
    const ops = dropOps(d, stop({ id: 'a' }), { day: 3, index: 2 }, ids('b', 'c', 'd'), { day: 3, index: 0 }, id)!;
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: 'moveItem', item: 'a', toDay: 3, after: 'c' });
    const r = applyOps(d, ops);
    expect(r.doc.template?.moved).toHaveLength(1);
    const back = applyOps(r.doc, r.inverse);
    expect(back.doc.template?.moved).toEqual([]);
  });
  it('moves across days to the start, and onto a day cell it lands at the end', () => {
    const d = base();
    const start = dropOps(d, stop(), { day: 5, index: 0 }, ids('x', 'y'), { day: 3, index: 1 }, id)!;
    expect(start[0]).toMatchObject({ toDay: 5 });
    expect(start[0]).not.toHaveProperty('after');
    const end = dropOps(d, stop(), { day: 5, index: 2 }, ids('x', 'y'), { day: 3, index: 1 }, id)!;
    expect(end[0]).toMatchObject({ toDay: 5, after: 'y' });
  });
  it('a built trip moves a pick: first at the top, else after a pick', () => {
    const built = { ...base(), template: undefined } as unknown as PlanDraft;
    expect(dropOps(built, stop({ id: 'place/a' }), { day: 2, index: 0 }, ids('place/b'), { day: 1, index: 0 }, id)![0]).toMatchObject({ kind: 'moveItem', ref: 'place/a', toDay: 2, first: true });
    expect(dropOps(built, stop({ id: 'place/a' }), { day: 2, index: 1 }, ids('place/b'), { day: 1, index: 0 }, id)![0]).toMatchObject({ ref: 'place/a', toDay: 2, afterRef: 'place/b' });
  });
});

describe('the words', () => {
  const e = stop();
  it('says the step the way the spec has it', () => {
    expect(positionOf({ day: 3, index: 1 }, 3)).toEqual({ place: 2, of: 4 });
    expect(stepWords(e, { day: 3, index: 1 }, 3)).toBe('Seceda ridge, Day 3, position 2 of 4');
    expect(lifted(e, { day: 3, index: 1 }, 3)).toMatch(/^Lifted Seceda ridge, Day 3, position 2 of 4\. /);
    expect(droppedWords(e, { day: 4, index: 2 }, 4, true)).toBe('Moved Seceda ridge to Day 4, position 3 of 5');
    expect(cancelledWords(e, { day: 3, index: 1 }, 3)).toBe('Cancelled. Seceda ridge, Day 3, position 2 of 4');
  });
  it('names the toast: a day, one step up or down, or a place', () => {
    expect(dropWords(e, { day: 4, index: 0 }, { day: 3, index: 1 }, 2)).toBe('Moved Seceda ridge to Day 4');
    expect(dropWords(e, { day: 3, index: 0 }, { day: 3, index: 1 }, 3)).toBe('Moved Seceda ridge up');
    expect(dropWords(e, { day: 3, index: 3 }, { day: 3, index: 1 }, 3)).toBe('Moved Seceda ridge to position 4 of 4');
  });
  it('the pill: day, before the next stop or at the end, and the driving change when known', () => {
    expect(pillText(3, '11:30', '+42 min driving')).toBe('to Day 3 · before 11:30 · +42 min driving ≈');
    expect(pillText(3, null, null)).toBe('to Day 3 · at the end');
  });
});

describe('the keyboard', () => {
  const counts = new Map([[1, 3], [2, 0], [3, 4]]);
  const days = [1, 2, 3];
  it('arrows step within the day and stop at its ends', () => {
    expect(keyTarget({ day: 1, index: 1 }, 'up', counts, days)).toEqual({ day: 1, index: 0 });
    expect(keyTarget({ day: 1, index: 0 }, 'up', counts, days)).toEqual({ day: 1, index: 0 });
    expect(keyTarget({ day: 1, index: 2 }, 'down', counts, days)).toEqual({ day: 1, index: 3 });
    expect(keyTarget({ day: 1, index: 3 }, 'down', counts, days)).toEqual({ day: 1, index: 3 });
  });
  it('Home and End go to the top and bottom of the day', () => {
    expect(keyTarget({ day: 3, index: 2 }, 'home', counts, days)).toEqual({ day: 3, index: 0 });
    expect(keyTarget({ day: 3, index: 2 }, 'end', counts, days)).toEqual({ day: 3, index: 4 });
  });
  it('Page keys change the day, keep the place where there is room, and stay put at the first and last day', () => {
    expect(keyTarget({ day: 1, index: 2 }, 'pagedown', counts, days)).toEqual({ day: 2, index: 0 });
    expect(keyTarget({ day: 2, index: 0 }, 'pagedown', counts, days)).toEqual({ day: 3, index: 0 });
    expect(keyTarget({ day: 3, index: 3 }, 'pageup', counts, days)).toEqual({ day: 2, index: 0 });
    expect(keyTarget({ day: 1, index: 1 }, 'pageup', counts, days)).toEqual({ day: 1, index: 1 });
    expect(keyTarget({ day: 3, index: 1 }, 'pagedown', counts, days)).toEqual({ day: 3, index: 1 });
  });
});

describe('the pointer', () => {
  it('lands before the stops whose middle is below it', () => {
    expect(indexAt([100, 200, 300], 50)).toBe(0);
    expect(indexAt([100, 200, 300], 150)).toBe(1);
    expect(indexAt([100, 200, 300], 999)).toBe(3);
    expect(indexAt([], 10)).toBe(0);
  });
  it('autoscrolls only in the outer edge, faster nearer it', () => {
    const u = TRIP_EDIT_UI;
    expect(edgeSpeed(400, 800, u.autoscrollEdgePx, u.autoscrollMaxPx)).toBe(0);
    expect(edgeSpeed(0, 800, u.autoscrollEdgePx, u.autoscrollMaxPx)).toBe(-u.autoscrollMaxPx);
    expect(edgeSpeed(800, 800, u.autoscrollEdgePx, u.autoscrollMaxPx)).toBe(u.autoscrollMaxPx);
    expect(Math.abs(edgeSpeed(50, 800, u.autoscrollEdgePx, u.autoscrollMaxPx))).toBeLessThan(Math.abs(edgeSpeed(10, 800, u.autoscrollEdgePx, u.autoscrollMaxPx)));
  });
  it('keeps the thresholds in one home: 4 px handle, 8 px row, 300 ms, 64 px', () => {
    expect([TRIP_EDIT_UI.dragHandlePx, TRIP_EDIT_UI.dragRowPx, TRIP_EDIT_UI.longPressMs, TRIP_EDIT_UI.autoscrollEdgePx]).toEqual([4, 8, 300, 64]);
  });
});

describe('the single-letter setting', () => {
  it('is on until switched off, and on again when switched on', () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', { value: { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } }, configurable: true });
    expect(readSingleKeys()).toBe(true);
    writeSingleKeys(false);
    expect(store.get(SINGLE_KEYS_KEY)).toBe('off');
    expect(readSingleKeys()).toBe(false);
    writeSingleKeys(true);
    expect(readSingleKeys()).toBe(true);
    Reflect.deleteProperty(globalThis, 'window');
  });
});
