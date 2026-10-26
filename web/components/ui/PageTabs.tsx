'use client';

import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from './cx';

export interface PageTab<V extends string> {
  value: V;
  label: string;
  /** Drawn after the label from 640 px (components 1.6) and always part of the accessible name; null or absent draws nothing. */
  count?: number | null;
}

interface Props<V extends string> {
  /** The tablist's name: "Trip sections". */
  label: string;
  /** Only tabs with content are passed: a dead tab is never drawn (P4). */
  tabs: PageTab<V>[];
  value: V;
  /** Enter, Space or a press: the tab is opened (manual activation: arrows only move focus). */
  onActivate: (v: V) => void;
  /** A tab took focus: the panel's chunk can load now, so opening it is usually instant. */
  onFocusTab?: (v: V) => void;
  /** `trip` gives `trip-tab-<v>` for the tab and `trip-panel-<v>` for its panel. */
  idPrefix: string;
  className?: string;
}

/**
 * Underline page tabs (components 1.6, patterns 3.10): WAI-ARIA tabs with manual activation and roving tabindex. Left and Right move
 * focus (wrapping), Home and End jump, Enter or Space opens. The row is sticky under the header; the stylesheet decides where (phones keep
 * one sticky row). Styles live in styles/trip-tabs.css.
 */
export function PageTabs<V extends string>({ label, tabs, value, onActivate, onFocusTab, idPrefix, className }: Props<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = tabs.length;
    const next = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
  };
  return (
    <div className={cx('trip-tabbar', className)} data-print="hide">
      {/* no script: every panel is in the page, in order, and the tab buttons would do nothing (spec 3.4 "No script") */}
      <noscript>
        <style>{'@layer base{.trip-tabbar{display:none}.trip-panel[hidden],.tl-lists[hidden]{display:block !important}}'}</style>
      </noscript>
      <div role="tablist" aria-label={label} className="trip-tablist" data-n={tabs.length}>
        {tabs.map((t, i) => {
          const on = t.value === value;
          const n = t.count ?? null;
          return (
            <button
              key={t.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${t.value}`}
              aria-selected={on}
              aria-controls={`${idPrefix}-panel-${t.value}`}
              aria-label={n === null ? undefined : `${t.label}, ${n}`}
              tabIndex={on ? 0 : -1}
              className="trip-tab"
              data-tab={t.value}
              onClick={() => onActivate(t.value)}
              onFocus={() => onFocusTab?.(t.value)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {t.label}
              {n === null ? null : <span className="trip-tab-n num"> {n}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
