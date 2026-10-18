'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { cx } from './cx';

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  /** Greyed and not selectable; `title` explains why. */
  disabled?: boolean;
  title?: string;
  /** Extra data-* hook for tests and analytics. */
  dataView?: string;
}

interface SegmentedProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** 40 px default, 34 on maps and toolbars, 32 on the phone category strip. */
  size?: 'md' | 's' | 'xs';
  /** Icon-only on phone when more than three segments (components 2.9). */
  iconsOnPhone?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Radio group with a sliding amber fill (components 2.9). Arrow keys move and select, Home and End jump,
 * one tab stop. The fill slides 200 ms on `--e-std`; reduced motion makes it a plain swap.
 */
export function Segmented<T extends string>({ segments, value, onChange, label, size = 'md', iconsOnPhone, className }: SegmentedProps<T>) {
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = segments.map((s, i) => (s.disabled ? -1 : i)).filter((i) => i >= 0);

  // the amber fill is one element that slides to the checked segment (200 ms on --e-std, a fade under reduced motion)
  useLayoutEffect(() => {
    const el = refs.current[segments.findIndex((x) => x.value === value)];
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value, segments, size]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const at = enabled.indexOf(index);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = enabled[(at + 1) % enabled.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = enabled[(at - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(segments[next].value);
  };

  return (
    <div role="radiogroup" aria-label={label} className={cx('seg', `seg-${size}`, iconsOnPhone && 'seg-icons-phone', className)}>
      {thumb ? <span className="seg-thumb" aria-hidden="true" style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }} /> : null}
      {segments.map((s, i) => {
        const on = s.value === value;
        return (
          <button
            key={s.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={s.disabled || undefined}
            tabIndex={on || (!enabled.includes(segments.findIndex((x) => x.value === value)) && i === enabled[0]) ? 0 : -1}
            title={s.title}
            data-view={s.dataView}
            className="seg-btn"
            onClick={() => {
              if (!s.disabled) onChange(s.value);
            }}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="seg-content">
              {s.icon ? <Icon name={s.icon} size={15} /> : null}
              <span className="seg-label">{s.label}</span>
            </span>
            {s.disabled && s.title ? <span className="sr-only">. {s.title}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
