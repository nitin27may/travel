'use client';

import type { ReactNode } from 'react';
import { cx } from './cx';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  /** Shown instead of the state word when the switch is locked, e.g. "Off: reduced motion". */
  note?: string;
  className?: string;
}

/** 44 x 24 switch (components 2.5): off is a `--line-2` track, on is `--accent`; the label sits to the right. */
export function Switch({ checked, onCheckedChange, children, disabled, note, className }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} className={cx('switch', className)} onClick={() => onCheckedChange(!checked)}>
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className="switch-label">{children}</span>
      {note ? <span className="switch-note">{note}</span> : <span className="sr-only">{checked ? 'On' : 'Off'}</span>}
    </button>
  );
}
