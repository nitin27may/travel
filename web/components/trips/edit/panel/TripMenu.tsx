'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PLAN_EDIT } from '@travel/core/config/plans.ts';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { removeById, undoRemove } from '@/lib/mine/copies';
import { mineStorage } from '@/lib/mine/storage';
import type { Where } from '@/lib/trip-edit/open';
import { ActionPanel } from './ActionPanel';
import { ResetConfirm } from './ResetConfirm';
import { printTrip } from '@/lib/export/printRequest';

interface Props {
  id: string;
  /** the public trip's slug, which the export menu prints under */
  slug: string;
  title: string;
  where: Where;
  copy: boolean;
  changes: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}

/** The cover's `⋯` on your own trip (components 8.7 trip rows): Undo, Redo, Reset to our plan (copies), Print, then Remove from My trips last. */
export function TripMenu({ id, slug, title, where, copy, changes, canUndo, canRedo, onUndo, onRedo, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const close = (o: boolean) => {
    setOpen(o);
    if (!o) setConfirm(false);
  };
  const act = (fn: () => void) => () => {
    close(false);
    fn();
  };
  const remove = () => {
    const r = removeById(mineStorage().storage, id);
    if (!r.ok) {
      toast({ message: 'Could not remove that trip. Nothing was changed.' });
      return;
    }
    toast({ message: `Removed ${title} from My trips`, actionLabel: 'Undo', onAction: () => void undoRemove(mineStorage().storage, r.removed) });
    router.push('/mine/');
  };
  return (
    <ActionPanel label="Trip actions" title="Trip actions" open={open} onOpenChange={close} triggerClassName="btn btn-icon edit-trip-more">
      {confirm ? (
        <ResetConfirm changes={changes} onCancel={() => setConfirm(false)} onReset={act(onReset)} />
      ) : (
        <>
          <button type="button" role="menuitem" className="edit-row" disabled={!canUndo} onClick={act(onUndo)}>
            <Icon name="undo" size={16} /> <span>Undo</span> <span className="edit-key num">Ctrl Z</span>
          </button>
          <button type="button" role="menuitem" className="edit-row" disabled={!canRedo} onClick={act(onRedo)}>
            <Icon name="redo" size={16} /> <span>Redo</span> <span className="edit-key num">Ctrl Shift Z</span>
          </button>
          {copy && changes > 0 ? (
            <button type="button" role="menuitem" className="edit-row" onClick={() => (changes > PLAN_EDIT.resetConfirmOver ? setConfirm(true) : act(onReset)())}>
              <Icon name="swap" size={16} /> <span>Reset to our plan</span>
            </button>
          ) : null}
          <button type="button" role="menuitem" className="edit-row" onClick={act(() => printTrip(slug))}>
            <Icon name="print" size={16} /> <span>Print</span>
          </button>
          {where === 'device' ? (
            <>
              <hr className="edit-sep" />
              <button type="button" role="menuitem" className="edit-row edit-crit" onClick={act(remove)}>
                <Icon name="close" size={16} /> <span>Remove from My trips</span>
              </button>
            </>
          ) : null}
        </>
      )}
    </ActionPanel>
  );
}
