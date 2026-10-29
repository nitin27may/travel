'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import './convert.css';

export interface NoticeProps {
  /** our trip's name ("Dolomites"), else the notice says "our trip" */
  ours: string | null;
  /** why the trip cannot be converted, instead of the question */
  blocked?: string | null;
  busy?: boolean;
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * The convert notice (patterns 3.13 item 13; edit-mode-spec 13.2): inline above the Settings section, never a dialog (foundation 4.4:
 * a reversible action does not ask in a modal). It states what happens and that Undo restores it. Continue is the one filled button.
 */
export function ConvertNotice({ ours, blocked, busy, onContinue, onCancel }: NoticeProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  return (
    <div ref={ref} className="ban ban-notice cvn" role="status" data-testid="convert-notice">
      <Icon name="info" size={16} />
      <div className="cvn-main">
        <p className="cvn-text">
          {blocked ??
            `This makes it your own trip. Our later updates to ${ours ? `the ${ours} trip` : 'our trip'} will no longer change it. You can undo this until you leave the page.`}
        </p>
        <div className="cvn-actions">
          {blocked ? null : (
            <Button variant="primary" onClick={onContinue} loading={busy} disabled={busy}>Continue</Button>
          )}
          <Button onClick={onCancel}>{blocked ? 'Close' : 'Cancel'}</Button>
        </div>
      </div>
    </div>
  );
}
