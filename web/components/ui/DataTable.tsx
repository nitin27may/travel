'use client';

import { useEffect, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Icon } from './Icon';

interface Props {
  /** Saved views, Columns, Density, Export CSV (components 4.2). */
  tools: ReactNode;
  density: 'comfortable' | 'compact';
  /** The scroll container; holds the table so the page itself never scrolls sideways. */
  scrollRef?: React.Ref<HTMLDivElement>;
  /** From `useScrollCue` on the same container: shows the right-edge cue and the first-column shadow. */
  cue?: ScrollCue;
  children: ReactNode;
}

export interface ScrollCue {
  /** Columns wait to the right of the visible part. */
  more: boolean;
  /** The table has moved off its left edge, so the sticky first column floats over cells. */
  scrolled: boolean;
}

/**
 * Tracks how far a scroll container has moved sideways (backlog 2.40). Also sets `--sbw` on its parent: the width of a
 * classic scrollbar, so the right-edge fade stops short of it and the bar stays visible.
 */
export function useScrollCue(ref: RefObject<HTMLDivElement | null>): ScrollCue {
  const [cue, setCue] = useState<ScrollCue>({ more: false, scrolled: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const next = { more: el.scrollLeft + el.clientWidth < el.scrollWidth - 2, scrolled: el.scrollLeft > 2 };
      setCue((c) => (c.more === next.more && c.scrolled === next.scrolled ? c : next));
      el.parentElement?.style.setProperty('--sbw', `${Math.max(0, el.offsetWidth - el.clientWidth - 2)}px`);
    };
    read();
    el.addEventListener('scroll', read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', read);
      ro.disconnect();
    };
  }, [ref]);
  return cue;
}

/**
 * Shell of the data table: tools row above, then a bordered, rounded container that scrolls inside itself with
 * a sticky head, a sticky first column and sticky group rows. Rows, cells and sorting stay with the caller (TanStack Table).
 * When columns are hidden to the right, the right edge fades and a hint names them; `data-scrolled` puts a shadow under the
 * sticky first column once the table has moved.
 */
export function DataTableShell({ tools, density, scrollRef, cue, children }: Props) {
  return (
    <div className="table-view" data-density={density}>
      <div className="table-tools">
        {tools}
        {cue?.more ? <span className="table-hint" aria-hidden="true">Scroll sideways for more columns</span> : null}
      </div>
      <div className="table-frame" data-more={cue?.more || undefined} data-scrolled={cue?.scrolled || undefined}>
        <div className="table-scroll" ref={scrollRef} tabIndex={-1}>
          {children}
        </div>
        <span className="table-more" aria-hidden="true">
          <Icon name="chevronRight" size={16} />
        </span>
      </div>
    </div>
  );
}
