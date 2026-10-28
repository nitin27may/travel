'use client';

// One edit session of one trip in one tab: applies a change, keeps the undo and redo stack (50 steps, kept across a reload in the tab),
// raises the toast with Undo, and says what happened to a screen reader. The document and its saving are the page's (useTripDocument);
// this adds the stack. A change is one list of operations (one undo step); an Undo is itself saved as operations, like any other
// (edit-mode-spec 10), so the account's outbox sees it as a new change.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StorageLike } from '@travel/core/schema/copies.ts';
import { readSession, removeSession, writeSession } from '@/lib/storage/safe';
import { useToast } from '@/components/ui/Toast';
import { applyOps, type PlanDraft, type PlanOp } from '@/lib/trip-edit/model';
import type { SaveResult } from '@/lib/trip-edit/open';
import { afterRedo, afterUndo, dropTop, loadStack, pushStep, saveStack, type UndoStack } from '@/lib/trip-edit/undo';

// the tab's session storage through the one door (lib/storage/safe.ts): a browser that blocks site data answers null and the stack lasts for the page
const store = (): StorageLike => ({ getItem: readSession, setItem: (k, v) => void writeSession(k, v), removeItem: (k) => void removeSession(k) });

export interface EditSession {
  /** Applies a change; false when it could not be (nothing changed). */
  commit: (ops: PlanOp[], label: string, opts?: { toast?: boolean }) => boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** The label of the step Undo would take back. */
  undoLabel: string | null;
  redoLabel: string | null;
  /** Says it in the polite live region. */
  say: string;
  announce: (s: string) => void;
}

export function useEditSession(id: string, doc: PlanDraft, save: (ops: readonly PlanOp[]) => SaveResult, announceClearMs: number): EditSession {
  const { toast } = useToast();
  const [stack, setStack] = useState<UndoStack>(() => {
    return loadStack(store(), id);
  });
  const [say, setSay] = useState('');
  const stackRef = useRef(stack);
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  const put = useCallback(
    (next: UndoStack) => {
      stackRef.current = next;
      setStack(next);
      saveStack(store(), id, next);
    },
    [id],
  );
  const announce = useCallback(
    (s: string) => {
      setSay(s);
      window.setTimeout(() => setSay((cur) => (cur === s ? '' : cur)), announceClearMs);
    },
    [announceClearMs],
  );

  const undoRef = useRef<() => void>(() => undefined);
  const commit = useCallback<EditSession['commit']>(
    (ops, label, opts = {}) => {
      const r = applyOps(docRef.current, ops);
      if (!r.applied.length || r.skipped.length) {
        toast({ message: 'Could not make that change. Nothing was changed.' });
        return false;
      }
      if (!save(ops).ok) {
        toast({ message: 'Could not save that change. Nothing was changed.' });
        return false;
      }
      docRef.current = r.doc;
      if (r.inverse.length) put(pushStep(stackRef.current, { ops: r.inverse, label }));
      if (opts.toast !== false) toast({ message: label, actionLabel: 'Undo', onAction: () => undoRef.current(), });
      announce(label);
      return true;
    },
    [save, put, toast, announce],
  );

  const run = useCallback(
    (dir: 'undo' | 'redo') => {
      const from = dir === 'undo' ? stackRef.current.past : stackRef.current.future;
      const top = from[from.length - 1];
      if (!top) return;
      const r = applyOps(docRef.current, top.ops);
      if (!r.applied.length || r.skipped.length || !save(top.ops).ok) {
        // its target is gone (another device removed it): the step leaves the stack
        put(dropTop(stackRef.current, dir === 'undo' ? 'past' : 'future'));
        toast({ message: `Could not ${dir} that: it no longer applies.` });
        return;
      }
      docRef.current = r.doc;
      const step = { ops: r.inverse, label: top.label };
      put(dir === 'undo' ? afterUndo(stackRef.current, step) : afterRedo(stackRef.current, step));
      const words = dir === 'undo' ? `Undid: ${top.label}` : `Redid: ${top.label}`;
      toast({ message: words });
      announce(words);
    },
    [save, put, toast, announce],
  );
  const undo = useCallback(() => run('undo'), [run]);
  const redo = useCallback(() => run('redo'), [run]);
  useEffect(() => {
    undoRef.current = undo;
  }, [undo]);

  return {
    commit, undo, redo, canUndo: stack.past.length > 0, canRedo: stack.future.length > 0,
    undoLabel: stack.past[stack.past.length - 1]?.label ?? null, redoLabel: stack.future[stack.future.length - 1]?.label ?? null, say, announce,
  };
}
