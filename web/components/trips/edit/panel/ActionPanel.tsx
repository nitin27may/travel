'use client';

import { Popover } from '@base-ui/react/popover';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Icon } from '@/components/ui/Icon';
import { usePhone } from './useMatchMedia';

interface Props {
  /** The opener's accessible name, which also names the panel: "Actions for Seceda, Day 3". */
  label: string;
  /** The sheet's title on a phone (components 8.7: the name in `--t-title`). */
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the opener shows; the default is the three dots. */
  trigger?: ReactNode;
  triggerClassName?: string;
  /** One mono line under the sheet's title: "Day 3 · 11:30 · Base: Jasper". */
  meta?: string;
  children: ReactNode;
}

/** Arrows, Home and End move between the rows of a menu (components 5.2). */
export function menuKeys(e: KeyboardEvent<HTMLElement>): void {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled]),[role="menuitemradio"]:not([disabled])')];
  if (!rows.length) return;
  const i = rows.indexOf(document.activeElement as HTMLElement);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : e.key === 'ArrowDown' ? (i + 1) % rows.length : (i - 1 + rows.length) % rows.length;
  e.preventDefault();
  rows[next]?.focus();
}

/**
 * One container for the item sheet (components 8.7): a bottom sheet on a phone, an anchored menu from 640 px (no scrim, flips to stay in
 * view). Esc, the close button or a tap on the scrim closes it and focus returns to the opener. The rows are the caller's.
 */
export function ActionPanel({ label, title, open, onOpenChange, trigger, triggerClassName = 'edit-more', meta, children }: Props) {
  const phone = usePhone();
  const opener = useRef<HTMLButtonElement>(null);
  const glyph = trigger ?? <Icon name="more" size={20} />;
  if (phone) {
    return (
      <>
        <button ref={opener} type="button" className={triggerClassName} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => onOpenChange(true)}>
          {glyph}
        </button>
        <BottomSheet open={open} onOpenChange={onOpenChange} title={title} snaps={['half', 'full']} initial="half" className="edit-sheet">
          {meta ? <p className="edit-meta num">{meta}</p> : null}
          <div role="menu" aria-label={label} className="edit-rows" onKeyDown={menuKeys}>
            {children}
          </div>
        </BottomSheet>
      </>
    );
  }
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger className={triggerClassName} aria-label={label}>
        {glyph}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="popover-pos">
          <Popover.Popup className="popover edit-menu" aria-label={label}>
            {meta ? <p className="edit-meta num">{meta}</p> : null}
            <div role="menu" aria-label={label} className="edit-rows" onKeyDown={menuKeys}>
              {children}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
