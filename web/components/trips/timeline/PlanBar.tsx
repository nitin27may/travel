'use client';

import { useEffect, useRef } from 'react';
import type { TimelineModel } from './model';

interface Props {
  model: TimelineModel;
  /** The short profile line, e.g. "Standard pace". */
  label: string;
  active: number | null;
  onPick: (n: number) => void;
  /** "Edit": scroll to the selector and open it. */
  onEdit: () => void;
}

/** Sticky under the header while the days scroll: the profile in a few words and a rail of day numbers (design 3.4). */
export function PlanBar({ model, label, active, onPick, onEdit }: Props) {
  const rail = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = rail.current?.querySelector<HTMLElement>('[data-active]');
    if (!el || !rail.current) return;
    const box = rail.current;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [active]);
  return (
    <nav className="tl-planbar" aria-label="Days" data-print="hide">
      <p className="tl-planbar-line num">
        <span className="tl-planbar-who">{label}</span> · <button type="button" className="tl-reset" onClick={onEdit}>Edit</button>
      </p>
      <ol className="tl-rail-days" ref={rail}>
        {model.days.map((d) => (
          <li key={d.n}>
            <a
              href={`#day-${d.n}`}
              className="tl-rail-cell num"
              data-active={active === d.n || undefined}
              aria-current={active === d.n ? 'true' : undefined}
              aria-label={`Day ${d.n}`}
              onClick={(ev) => {
                ev.preventDefault();
                onPick(d.n);
              }}
            >
              {d.n}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
