'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { MineTab } from '@/lib/mine/overview';

export interface MineTabSpec {
  value: MineTab;
  label: string;
  /** null while the list is unread or unreadable: no number is better than a wrong one */
  count: number | null;
}

/**
 * Mine's My trips · Favourites switch (components 2.9 tab variant): the segmented look with tab semantics, because the segments change
 * a panel and the URL. Arrows move and select, Home and End jump, one tab stop (the selected tab). The amber fill slides 200 ms; under
 * reduced motion ui.css makes it a plain swap. Panels are rendered by the caller with `id="mine-panel-<value>"`.
 */
export function MineTabs({ tabs, value, onChange }: { tabs: MineTabSpec[]; value: MineTab; onChange: (v: MineTab) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = refs.current[tabs.findIndex((t) => t.value === value)];
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value, tabs]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = tabs.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(tabs[next].value);
  };

  return (
    <div role="tablist" aria-label="Mine" className="seg seg-tabs">
      {thumb ? <span className="seg-thumb" aria-hidden="true" style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }} /> : null}
      {tabs.map((t, i) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`mine-tab-${t.value}`}
            aria-selected={on}
            aria-controls={`mine-panel-${t.value}`}
            aria-label={t.count === null ? t.label : `${t.label}, ${t.count}`}
            tabIndex={on ? 0 : -1}
            className="seg-btn"
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="seg-content">
              <span className="seg-label">{t.label}</span>
              {t.count === null ? null : ' '}
              {t.count === null ? null : (
                <span className="seg-count" aria-hidden="true">
                  {t.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
