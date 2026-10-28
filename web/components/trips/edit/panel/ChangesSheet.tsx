'use client';

import { useState } from 'react';
import { PLAN_EDIT } from '@travel/core/config/plans.ts';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { SideSheet } from '@/components/ui/SideSheet';
import type { ChangeRow } from '@/lib/trip-edit/changes';
import { changesLine } from '@/lib/trip-edit/marks';
import { ResetConfirm } from './ResetConfirm';
import { usePhone } from './useMatchMedia';

interface Props {
  open: boolean;
  onClose: () => void;
  rows: ChangeRow[];
  ours: { href: string; title: string } | null;
  onRow: (r: ChangeRow) => void;
  onReset: () => void;
}

/** "Changes from our plan" (edit-mode-spec 10; ruling C4): what and where per row, and one button that names its own action. */
export function ChangesSheet({ open, onClose, rows, ours, onRow, onReset }: Props) {
  const phone = usePhone();
  const [confirm, setConfirm] = useState(false);
  const change = (o: boolean) => {
    if (!o) {
      setConfirm(false);
      onClose();
    }
  };
  const reset = () => {
    setConfirm(false);
    onReset();
  };
  const body = (
    <div className="edit-changes">
      {ours ? (
        <p className="edit-changes-ours">
          <a href={ours.href} target="_blank" rel="noreferrer">Open our {ours.title} trip</a>
        </p>
      ) : null}
      {rows.length ? (
        <ul className="edit-changes-list">
          {rows.map((r) => (
            <li key={r.key} className="edit-change">
              <span className="edit-change-text">{r.text}</span>
              <Button size="sm" onClick={() => onRow(r)}>{r.verb}</Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="edit-why">This trip follows our plan with no changes.</p>
      )}
    </div>
  );
  const footer = confirm ? (
    <ResetConfirm changes={rows.length} onCancel={() => setConfirm(false)} onReset={reset} />
  ) : (
    <Button disabled={rows.length === 0} onClick={() => (rows.length > PLAN_EDIT.resetConfirmOver ? setConfirm(true) : reset())}>Reset to our plan</Button>
  );
  const title = 'Changes from our plan';
  return phone ? (
    <BottomSheet open={open} onOpenChange={change} title={title} snaps={['half', 'full']} initial="half" footer={footer} className="edit-sheet">
      {body}
    </BottomSheet>
  ) : (
    <SideSheet open={open} onOpenChange={change} title={title} kicker={rows.length ? changesLine(rows.length) : undefined} footer={footer} className="edit-sheet">
      {body}
    </SideSheet>
  );
}
