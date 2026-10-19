'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

interface Props {
  label: string;
  ariaLabel: string;
  entries: { label: string; onSelect: () => void }[];
}

/**
 * The per-day version chip (spec 3.6): a button that opens a short list. Arrow keys move, Enter or Space picks, Esc and an outside
 * click close. Written here, not with the L0 Menu, because that one pulls a 21 kB library into every trip page's first load.
 */
export function VariantMenu({ label, ariaLabel, entries }: Props) {
  const [open, setOpen] = useState(false);
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
              {e.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
