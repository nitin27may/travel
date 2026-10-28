// The undo and redo stack of one trip in one tab (edit-mode-spec 10; EA5). Each step is the list of operations that UNDOES a change (its
// inverse, from `applyOps`), with the words that name it. Undoing a step applies it and pushes the inverse of that onto the other stack,
// so redo is the same function the other way round. At most PLAN_EDIT.undoSteps steps are kept: a 51st drops the oldest. Pure over a
// `StorageLike` (sessionStorage in the page), so a test passes a memory store. Not synced, by design.
import { PLAN_EDIT } from '@travel/core/config/plans.ts';
import type { StorageLike } from '@travel/core/schema/copies.ts';
import type { PlanOp } from './model';
import { undoKey } from './keys';

export interface Step {
  /** operations that undo (or, on the redo stack, redo) the change */
  ops: PlanOp[];
  /** "Removed Moose Lake Loop from Day 5" */
  label: string;
}
export interface UndoStack {
  past: Step[];
  future: Step[];
}
export const emptyStack = (): UndoStack => ({ past: [], future: [] });

/** A new change: pushed on the past, the redo stack cleared, the oldest step dropped past the cap. */
export function pushStep(s: UndoStack, step: Step, cap: number = PLAN_EDIT.undoSteps): UndoStack {
  return { past: [...s.past, step].slice(-cap), future: [] };
}
/** Undo took the last past step; `redo` is what applied it returned (the inverse of the inverse). */
export function afterUndo(s: UndoStack, redo: Step): UndoStack {
  return { past: s.past.slice(0, -1), future: [...s.future, redo].slice(-PLAN_EDIT.undoSteps) };
}
export function afterRedo(s: UndoStack, undo: Step): UndoStack {
  return { past: [...s.past, undo].slice(-PLAN_EDIT.undoSteps), future: s.future.slice(0, -1) };
}
/** A step whose target is gone (another device removed it) leaves the stack. */
export const dropTop = (s: UndoStack, which: 'past' | 'future'): UndoStack => ({ ...s, [which]: s[which].slice(0, -1) });

export function loadStack(storage: StorageLike, id: string): UndoStack {
  try {
    const p = JSON.parse(storage.getItem(undoKey(id)) ?? 'null') as { v?: number; past?: Step[]; future?: Step[] } | null;
    if (p && p.v === 1 && Array.isArray(p.past) && Array.isArray(p.future)) return { past: p.past.slice(-PLAN_EDIT.undoSteps), future: p.future.slice(-PLAN_EDIT.undoSteps) };
  } catch {
    /* unreadable: start empty */
  }
  return emptyStack();
}
export function saveStack(storage: StorageLike, id: string, s: UndoStack): void {
  try {
    if (!s.past.length && !s.future.length) storage.removeItem(undoKey(id));
    else storage.setItem(undoKey(id), JSON.stringify({ v: 1, ...s }));
  } catch {
    /* the stack lasts for the page at most */
  }
}
