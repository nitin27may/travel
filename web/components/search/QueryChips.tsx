'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Chip, ParsedQuery } from '@/lib/search/parse/types';
import '@/styles/search.css';

export interface QueryChipsProps {
  parsed: ParsedQuery;
  onRemove: (id: string) => void;
  onPick: (id: string, alt: Chip) => void;
  /** Called when the last chip is gone and focus has nowhere to land: put it back in the search box. */
  onEmpty?: () => void;
  /** Only the open questions (the age asked for "with kids" on Trips). */
  onlyAsk?: boolean;
  /** Leave out the "Not used" words (the list shows them in its own box). */
  hideWords?: boolean;
  label?: string;
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * How a query was read (smart-search 6.1, H3): one removable chip for every filter the words became, a chip with a small arrow that
 * offers the other readings, the words that were not used, and the words that have no filter yet. Chip words are the facet labels the
 * filter bar already uses. A dashed chip is a question; a dashed grey one was added because another chip needs it.
 */
export function QueryChips({ parsed, onRemove, onPick, onEmpty, onlyAsk, hideWords, label = 'Read as' }: QueryChipsProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const popId = useId();
  const chips = parsed.chips.filter((c) => (onlyAsk ? c.ask : true));

  // opening the other readings moves focus into them; Escape or a pick brings it back to the chip
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('.qc-pop button')?.focus();
  }, [open]);

  const remove = (c: Chip) => {
    const host = root.current?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(c.id)}"]`);
    const next = (host?.nextElementSibling?.matches('.qchip') ? host.nextElementSibling : host?.previousElementSibling?.matches('.qchip') ? host.previousElementSibling : null) as HTMLElement | null;
    const nextId = next?.dataset.chip;
    const done = () => {
      setLeaving(null);
      setOpen(null);
      onRemove(c.id);
      // focus follows to the neighbour, or back to the box; a removed button must not drop focus on the page
      queueMicrotask(() => {
        const target = nextId ? root.current?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(nextId)}"] .qchip-t`) : null;
        if (target) target.focus();
        else onEmpty?.();
      });
    };
    if (reduced()) return done();
    setLeaving(c.id);
    window.setTimeout(done, 180);
  };

  const onChipKey = (e: KeyboardEvent<HTMLButtonElement>, c: Chip) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      remove(c);
    } else if (e.key === 'Escape' && open === c.id) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(null);
    }
  };

  const openChip = chips.find((c) => c.id === open);
  const alts = openChip?.alternatives ?? [];
  const words = hideWords ? null : parsed;
  if (!chips.length && !(words && (words.notYet.length || words.unused.length))) return null;

  return (
    <div className="qc" ref={root}>
      {chips.length ? (
        <div className="qc-row" role="group" aria-label="How the search was read">
          <span className="qc-lbl" aria-hidden="true">{label}</span>
          {chips.map((c) => {
            const hasAlt = Boolean(c.alternatives?.length);
            return (
              <span key={c.id} className="qchip" data-chip={c.id} data-implied={c.implied || undefined} data-ask={c.ask || undefined} data-leaving={leaving === c.id || undefined}>
                <button
                  type="button"
                  className="qchip-t"
                  aria-haspopup={hasAlt ? 'true' : undefined}
                  aria-expanded={hasAlt ? open === c.id : undefined}
                  aria-controls={hasAlt && open === c.id ? popId : undefined}
                  onClick={() => hasAlt && setOpen(open === c.id ? null : c.id)}
                  onKeyDown={(e) => onChipKey(e, c)}
                >
                  {c.label}
                  {c.implied ? <span className="qchip-sub">needed</span> : null}
                  {hasAlt ? <span className="qchip-caret" aria-hidden="true">&#9662;</span> : null}
                </button>
                <button type="button" className="qchip-x" aria-label={`Remove ${c.label}`} onClick={() => remove(c)} onKeyDown={(e) => onChipKey(e, c)}>
                  <span aria-hidden="true">&times;</span>
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
      {openChip && alts.length ? (
        <div className="qc-pop" id={popId} role="group" aria-label={openChip.ask ? 'Pick the age' : 'Other readings'}>
          <span className="qc-lbl">{openChip.ask ? 'Youngest child' : 'Or read it as'}</span>
          {alts.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                setOpen(null);
                onPick(openChip.id, a);
                root.current?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(openChip.id)}"] .qchip-t`)?.focus();
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                e.preventDefault();
                e.stopPropagation();
                setOpen(null);
                root.current?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(openChip.id)}"] .qchip-t`)?.focus();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
      {words && (words.notYet.length || words.unused.length) ? (
        <div className="qc-unused">
          {words.notYet.length ? (
            <>
              <span className="qc-lbl">Not used yet</span>
              {words.notYet.map((w) => (
                <span key={w} className="qc-word" data-yet="">{w}</span>
              ))}
              <span>no filter for it yet</span>
            </>
          ) : null}
          {words.unused.length ? (
            <>
              <span className="qc-lbl">Not used</span>
              {words.unused.map((w) => (
                <span key={w} className="qc-word">{w}</span>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
