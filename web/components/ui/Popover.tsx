'use client';

import { Popover as BasePopover } from '@base-ui/react/popover';
import type { ReactNode } from 'react';
import { cx } from './cx';

interface Props {
  /** The trigger's content; the trigger itself is a button with `triggerClassName`. */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Accessible name for the popup. */
  label: string;
  align?: 'start' | 'center' | 'end';
  wide?: boolean;
  children: ReactNode;
}

/** Anchored panel for date pickers, column choosers, saved views (components 5.2). Esc closes and focus returns to the trigger. */
export function Popover({ trigger, triggerClassName, label, align = 'start', wide, children }: Props) {
  return (
    <BasePopover.Root>
      <BasePopover.Trigger className={triggerClassName}>{trigger}</BasePopover.Trigger>
      <BasePopover.Portal>
        <BasePopover.Positioner sideOffset={8} align={align} className="popover-pos">
          <BasePopover.Popup className={cx('popover', wide && 'popover-wide')} aria-label={label}>
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
