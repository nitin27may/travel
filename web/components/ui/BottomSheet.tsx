'use client';

import { Dialog } from '@base-ui/react/dialog';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { cx } from './cx';
import { PEEK_PX, SNAP_ORDER, snapOffset, startSnap, type Snap } from './sheetSnap';

export type { Snap };
const TOP_GAP = 64; // the phone top bar stays visible above a full sheet
const DISMISS_PX = 90;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Which stops exist, e.g. the map sheet has all three, a filter sheet only `full`. */
  snaps?: Snap[];
  initial?: Snap;
  /** A scrim and a focus trap; off for the map sheet that sits over a live map. */
  modal?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Height of the peek stop in px (default 120); the globe sheet uses a taller one so the first rows show at rest. */
  peekPx?: number;
  /** Px the sheet stands above the screen's bottom edge (the globe's list sits on the 84 px phone bottom bar): its height gives them up, so the top is not pushed off screen. */
  bottomGap?: number;
}

/**
 * Phone bottom sheet (components 5.5): top radius 18, grab bar, snap points peek 120 / half 50% / full under the
 * top bar. Drag with velocity, or the Expand and Collapse buttons for keyboard. A drag past the lowest stop closes it.
 * The container slides with CSS (260 ms in, 200 ms out); Motion owns the drag and the snap settle.
 */
export function BottomSheet({ open, onOpenChange, title, snaps = ['peek', 'half', 'full'], initial, modal = true, footer, children, className, peekPx = PEEK_PX, bottomGap = 0 }: Props) {
  const reduce = useReducedMotion();
  const stops = useMemo(() => SNAP_ORDER.filter((s) => snaps.includes(s)), [snaps]);
  const [snap, setSnap] = useState<Snap>(startSnap(stops, initial));
  // Every open starts at the initial stop; a snap chosen in an earlier open is not kept (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnap(startSnap(stops, initial));
  }
  const [height, setHeight] = useState(640);

  useEffect(() => {
    if (!open) return;
    const set = () => setHeight(Math.max(320, window.innerHeight - TOP_GAP) - bottomGap);
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, [open, bottomGap]);

  const offsetOf = useCallback((s: Snap) => snapOffset(s, height, peekPx), [height, peekPx]);
  const idx = stops.indexOf(snap);
  const move = (dir: 1 | -1) => setSnap(stops[Math.min(stops.length - 1, Math.max(0, idx + dir))]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <Dialog.Portal>
        {modal ? <Dialog.Backdrop className="scrim" /> : null}
        <Dialog.Popup className={cx('sheet-bottom-frame', className)} style={{ height }} aria-describedby={undefined} initialFocus={modal ? undefined : false}>
          <motion.div
            className="sheet-panel"
            drag={reduce ? false : 'y'}
            dragConstraints={{ top: 0, bottom: height }}
            dragElastic={0.04}
            dragMomentum={false}
            animate={{ y: offsetOf(snap) }}
            initial={false}
            transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 520, damping: 40, mass: 1 }}
            onDragEnd={(_, info) => {
              const projected = offsetOf(snap) + info.offset.y + info.velocity.y * 0.15;
              const lowest = offsetOf(stops[0]);
              if (projected > lowest + DISMISS_PX) {
                onOpenChange(false);
                return;
              }
              let best = stops[0];
              for (const s of stops) if (Math.abs(offsetOf(s) - projected) < Math.abs(offsetOf(best) - projected)) best = s;
              setSnap(best);
            }}
          >
            <div className="sheet-grab" aria-hidden="true" />
            <header className="sheet-head">
              <Dialog.Title className="sheet-title">{title}</Dialog.Title>
              <div className="sheet-head-actions">
                {stops.length > 1 ? (
                  <>
                    <Button size="sm" variant="ghost" icon aria-label="Expand" disabled={idx === stops.length - 1} onClick={() => move(1)}>
                      <Icon name="chevronUp" size={16} />
                    </Button>
                    <Button size="sm" variant="ghost" icon aria-label="Collapse" disabled={idx === 0} onClick={() => move(-1)}>
                      <Icon name="chevronDown" size={16} />
                    </Button>
                  </>
                ) : null}
                <Dialog.Close className="btn btn-icon btn-ghost btn-sm" aria-label="Close">
                  <Icon name="close" size={16} />
                </Dialog.Close>
              </div>
            </header>
            <div className="sheet-body">{children}</div>
            {footer ? <div className="sheet-foot">{footer}</div> : null}
          </motion.div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
