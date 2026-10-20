'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { activeFilters, clearAll } from '@/lib/entities/filter';
import type { FacetCount } from '@/lib/entities/filter';
import type { EntityDescriptor, FacetDef, FacetParam, ListState } from '@/lib/entities/types';
import { OPEN_FILTERS } from '@/lib/entities/events';
import { FacetPopover } from './FacetMenu';

export interface PhoneSummaryProps<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
  /** True once the in-flow bar has scrolled under the header. */
  show: boolean;
  shown: number | null;
  counts: Record<string, FacetCount[]>;
  gaps: Record<string, number>;
  primary: FacetDef<Row>[];
  hasMore: boolean;
  labelOf: (param: FacetParam, value: string) => string;
  /** The filters a search reading wrote, while its undo is available. */
  reading: { filters: number; undo: () => void } | null;
  setFacet: (param: FacetParam, values: string[]) => void;
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
  focusSearch: () => void;
}

/**
 * Under 640 px the full filter bar scrolls away with the page. Once it has, this takes its place: one 52 px line, "11 places · 3 filters",
 * and an Edit button that opens the controls in a panel under it. The panel is not modal: no scrim, no focus trap, the page keeps its scroll;
 * Esc, Done, a tap outside and 48 px of page scroll close it, and focus goes back to Edit (lists-stage4-note section 1).
 */
export function PhoneSummary<Row>({ d, state, show, shown, counts, gaps, primary, hasMore, labelOf, reading, setFacet, onState, focusSearch }: PhoneSummaryProps<Row>) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const edit = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const chips = activeFilters(state, d, labelOf);
  const n = chips.length;
  const isOpen = open && show;

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) edit.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;
    const startY = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > 48 && !wrap.current?.contains(document.activeElement)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // a menu opened from the panel takes its own Esc first
      if (document.querySelector('.popover[data-open], [role="dialog"]')) return;
      setOpen(false);
      edit.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || wrap.current?.contains(t) || t.closest('.popover, .popover-pos, [role="dialog"]')) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [isOpen]);

  const noun = shown === 1 ? d.noun.one : d.noun.many;
  const second = reading ? `Read as ${reading.filters} ${reading.filters === 1 ? 'filter' : 'filters'}` : n ? `${n} ${n === 1 ? 'filter' : 'filters'}` : 'Filter';
  return (
    <div className="phone-sticky" data-show={show || undefined} data-open={isOpen || undefined} ref={wrap}>
      <div className="phone-summary" inert={!show}>
        <p className="phone-summary-text" role="status" aria-live="polite">
          <span className="num phone-summary-count">{shown === null ? 'Counting…' : `${shown} ${noun}`}</span>
          <span className="phone-summary-sep"> &middot; </span>
          <span>{second}</span>
        </p>
        {reading ? (
          <button type="button" className="phone-summary-btn" onClick={reading.undo}>
            Undo
          </button>
        ) : null}
        <button ref={edit} type="button" className="phone-summary-btn" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(!isOpen)}>
          Edit
          <Icon name="chevronDown" size={14} />
        </button>
      </div>
      <div className="phone-panel" id={panelId} inert={!isOpen}>
        <div className="phone-panel-in">
          <div className="phone-panel-body">
            {n ? (
              <div className="phone-chips">
                <ul className="chips" aria-label="Active filters">
                  {chips.slice(0, 3).map((c) => (
                    <li key={c.key}>
                      <Chip kind="active" onRemove={() => onState(c.without, 'push')} removeLabel={`Remove filter ${c.label}`}>
                        {c.label}
                      </Chip>
                    </li>
                  ))}
                  {n > 3 ? <li className="phone-more-n">+{n - 3}</li> : null}
                </ul>
              </div>
            ) : null}
            <div className="phone-pills">
              {primary.map((f) => (
                <FacetPopover key={f.param} facet={f} options={counts[f.param] ?? []} selected={state.facets[f.param] ?? []} onChange={(v) => setFacet(f.param, v)} gapN={gaps[f.param]} />
              ))}
            </div>
            <div className="phone-panel-actions">
              <button
                type="button"
                className="btn phone-search-btn"
                aria-label="Search the list"
                onClick={() => {
                  close(false);
                  focusSearch();
                }}
              >
                <Icon name="search" size={16} />
              </button>
              {hasMore ? (
                <button type="button" className="btn" onClick={() => window.dispatchEvent(new Event(OPEN_FILTERS))}>
                  More filters
                </button>
              ) : null}
              {n ? (
                <button type="button" className="link-btn" onClick={() => onState(clearAll(state), 'push')}>
                  Clear all
                </button>
              ) : null}
              <button type="button" className="btn phone-done" onClick={() => close(true)}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
