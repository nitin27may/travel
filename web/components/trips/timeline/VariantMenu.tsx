'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export interface MenuEntry {
  label: string;
  /** What picking it does to the day, from the scheduler: "5.2 km walking · 2 h 30 driving · 07:30 to 20:30". */
  detail?: string | null;
  /** Why it does not fit this party; drawn in the warning colour. */
  warn?: string | null;
  /** Fix (a rule fails) or Check (advice); Check reads in the warning colour, Fix in the critical one (ER-016). */
  warnLevel?: 'fix' | 'check' | null;
  onSelect: () => void;
}

interface Props {
  label: string;
  ariaLabel: string;
  entries: MenuEntry[];
  /** Called when the list opens or closes, so the page can work the consequence lines out only when they are wanted. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * The per-day version chip (spec 3.6): a button that opens a short list. Arrow keys move, Enter or Space picks, Esc and an outside
 * click close. Written here, not with the L0 Menu, because that one pulls a 21 kB library into every trip page's first load.
 */
export function VariantMenu({ label, ariaLabel, entries, onOpenChange }: Props) {
  const [open, setOpenState] = useState(false);
  const setOpen = (v: boolean | ((x: boolean) => boolean)) => {
    setOpenState((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      if (next !== prev) queueMicrotask(() => onOpenChange?.(next));
      return next;
    });
  };
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const away = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  const move = (i: number, d: number) => items.current[(i + d + entries.length) % entries.length]?.focus();
  return (
    <div className="tl-menu" ref={root} onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); (root.current?.querySelector('button') as HTMLElement | null)?.focus(); } }}>
      <button type="button" className="btn btn-sm tl-vchip" aria-haspopup="menu" aria-expanded={open} aria-label={ariaLabel} onClick={() => setOpen((v) => !v)}>
        <span className="tl-vchip-label">{label}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open ? (
        <div className="tl-menu-list" role="menu">
          {entries.map((e, i) => (
            <button
              key={e.label}
              ref={(el) => { items.current[i] = el; }}
              type="button"
              role="menuitem"
              className="tl-menu-item"
              onClick={() => { setOpen(false); e.onSelect(); }}
              onKeyDown={(ev) => {
                if (ev.key === 'ArrowDown') { ev.preventDefault(); move(i, 1); } else if (ev.key === 'ArrowUp') { ev.preventDefault(); move(i, -1); }
              }}
            >
              <span className="tl-menu-label">{e.label}</span>
              {e.detail ? <span className="tl-menu-detail num">{e.detail}</span> : null}
              {e.warn ? <span className="tl-menu-warn" data-level={e.warnLevel ?? 'fix'}>{e.warn}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
