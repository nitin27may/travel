'use client';

import { useEffect, useRef } from 'react';
import type { Category } from '@/lib/public/types';
import type { CategorySectionModel } from './model';

interface Props {
  sections: CategorySectionModel[];
  active: Category | null;
  sticky: boolean;
  onPick: (id: Category) => void;
}

/**
 * The six category chips with their counts (patterns 3.4). Tapping a chip with items opens By category at that section;
 * an empty category is at 45% and not clickable. On the phone the strip scrolls sideways with snap and a fade, and
 * keeps the active chip in view.
 */
export function CategoryStrip({ sections, active, sticky, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active || !box.current) return;
    const chip = box.current.querySelector<HTMLElement>(`[data-cat-chip="${active}"]`);
    if (!chip) return;
    const b = box.current;
    const left = chip.offsetLeft - 16;
    if (left < b.scrollLeft || chip.offsetLeft + chip.offsetWidth > b.scrollLeft + b.clientWidth) b.scrollTo({ left, behavior: 'smooth' });
  }, [active]);
  return (
    <nav className="cat-strip" data-print="hide" aria-label="Categories in this trip" data-sticky={sticky || undefined}>
      <div className="cat-strip-scroll" ref={box}>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className="cat-chip"
            data-cat-chip={s.id}
            data-active={active === s.id || undefined}
            disabled={s.count === 0}
            aria-current={active === s.id ? 'true' : undefined}
            onClick={() => onPick(s.id)}
          >
            <span>{s.label}</span>
            <span className="num cat-chip-n">{s.count}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
