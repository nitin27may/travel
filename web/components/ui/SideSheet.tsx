'use client';

import { Dialog } from '@base-ui/react/dialog';
import { useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';
import type { IdentityKey } from './Chip';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Cap kicker over the photo, white at 80% (never amber on a photo). */
  kicker?: string;
  /** Header image; the node replaces the default `<img>`, so callers can pass EntityImage with its fallback. */
  media?: ReactNode;
  identity?: IdentityKey;
  /** `true` is modal with a scrim (forms); `'trap-focus'` keeps focus inside with no scrim and a scrollable page (detail sheets). */
  modal?: boolean | 'trap-focus';
  footer?: ReactNode;
  finalFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
}

/**
 * Right-edge drawer, 460 px (components 5.1). Header: 140 px photo under a 10% to 85% gradient, kicker, 32 px title,
 * 4 px identity bar. Slides in 260 ms, out 200 ms. Esc closes; focus moves to the title on open and back to the opener on close.
 */
export function SideSheet({ open, onOpenChange, title, kicker, media, identity = 'none', modal = true, footer, finalFocus, children, className }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <Dialog.Portal>
        {modal === true ? <Dialog.Backdrop className="scrim" /> : null}
        <Dialog.Popup className={cx('sheet sheet-side', className)} initialFocus={titleRef} finalFocus={finalFocus} aria-describedby={undefined}>
          <div className="sheet-photo" style={{ ['--tc' as string]: `var(--id-${identity})` }}>
            {media ? <div className="sheet-media">{media}</div> : null}
            <div className="sheet-photo-text">
              {kicker ? <p className="sheet-kicker">{kicker}</p> : null}
              <Dialog.Title ref={titleRef} tabIndex={-1} className="sheet-heading">
                {title}
              </Dialog.Title>
            </div>
            <Dialog.Close className="btn btn-icon btn-ghost sheet-close" aria-label="Close">
              <Icon name="close" size={18} />
            </Dialog.Close>
          </div>
          <div className="sheet-body">{children}</div>
          {footer ? <div className="sheet-foot">{footer}</div> : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Keeps the last content mounted while the closing transition runs. */
export function useKept<T>(value: T | null): T | null {
  const [kept, setKept] = useState<T | null>(value);
  if (value && value !== kept) setKept(value);
  return value ?? kept;
}
