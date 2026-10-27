'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { UnsentSummary } from '@/lib/mine/signout';
import './signout-confirm.css';

interface Props {
  unsent: UnsentSummary;
  /** the network is down: the question says so, and Try again may fail */
  offline: boolean;
  /** Try again is running */
  busy: boolean;
  /** Try again ran and changes are still waiting */
  stillWaiting: boolean;
  onTryAgain: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

const n = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** "1 change to Canadian Rockies is not in your account yet." */
export function unsentTitle(u: UnsentSummary): string {
  if (u.trips.length === 1) return `${n(u.count, 'change', 'changes')} to ${u.trips[0]!.title} ${u.count === 1 ? 'is' : 'are'} not in your account yet.`;
  return `${n(u.count, 'change', 'changes')} to ${n(u.trips.length, 'trip', 'trips')} ${u.count === 1 ? 'is' : 'are'} not in your account yet.`;
}

/**
 * Sign out with changes that have not reached the account (edit-my-trip 4.6): Try again, or Sign out and discard. A modal dialog, so focus
 * is held inside and Escape cancels; Cancel is first in tab order and takes focus (foundation 4.4: irreversible actions confirm).
 */
export function SignOutConfirm({ unsent, offline, busy, stillWaiting, onTryAgain, onDiscard, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d || opened) return;
    if (!d.open) d.showModal();
    setOpened(true);
  }, [opened]);
  const them = unsent.count === 1 ? 'it' : 'them';
  return (
    <dialog ref={ref} className="signout-dialog" role="alertdialog" aria-labelledby="signout-title" aria-describedby="signout-body" onCancel={(e) => (e.preventDefault(), onCancel())}>
      <h2 className="signout-title" id="signout-title">{unsentTitle(unsent)}</h2>
      {unsent.trips.length > 1 ? (
        <ul className="signout-list">
          {unsent.trips.map((t) => (
            <li key={t.id}>{t.title}: {n(t.count, 'change', 'changes')}</li>
          ))}
        </ul>
      ) : null}
      {offline ? (
        <p className="signout-offline" role="status">
          <Icon name="wifiOff" size={16} />
          You are offline.
        </p>
      ) : stillWaiting ? (
        <p className="signout-offline" role="status">
          <Icon name="warn" size={16} />
          It did not go through.
        </p>
      ) : null}
      <p className="signout-body" id="signout-body">
        Try again to send {them} first, or sign out and discard {them}. Everything else is already in your account.
      </p>
      <div className="signout-actions">
        <Button autoFocus onClick={onCancel} disabled={busy || undefined}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onTryAgain} loading={busy}>
          Try again
        </Button>
        <Button variant="danger" onClick={onDiscard} disabled={busy || undefined}>
          Sign out and discard {them}
        </Button>
      </div>
    </dialog>
  );
}
