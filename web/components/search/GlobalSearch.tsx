'use client';

import { Dialog } from '@base-ui/react/dialog';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon, kindIcon } from '@/components/ui/Icon';
import { loadSearchIndex } from '@/lib/search/client';
import { setSink, stopBuffer, takeBuffer } from '@/lib/search/typeahead';
import { createSearcher, describeCounts, type Searcher } from '@/lib/search/search';
import { suggest } from '@/lib/search/suggest';
import type { SearchHit, SearchRecord } from '@/lib/search/types';
import '@/styles/home.css';

export interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

const GROUP_ICON = { trip: 'route', area: 'globe' } as const;

function glyph(r: SearchRecord) {
  return r.k === 'place' ? kindIcon(r.kind ?? 'place') : GROUP_ICON[r.k];
}

/**
 * One search over trips, places and areas (components 2.10). A popover under the header on desktop and a
 * full-height sheet on phone. Results come on the first character from an in-memory index that is fetched the
 * first time the dialog opens. Arrow keys move, Enter opens, Esc clears and then closes.
 */
export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState(() => takeBuffer());
  const [searcher, setSearcher] = useState<Searcher | null>(null);
  const [records, setRecords] = useState<SearchRecord[]>([]);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // keys typed before the input had focus (see typeahead.ts)
  useEffect(() => {
    const pending = takeBuffer();
    setSink((apply) => { setQ(apply); setActive(0); });
    // keys that arrived between the first render and this effect
    queueMicrotask(() => pending && setQ(pending));
    return () => stopBuffer();
  }, []);

  useEffect(() => {
    if (!open || searcher) return;
    let dead = false;
    loadSearchIndex().then(
      (recs) => { if (!dead) { setRecords(recs); setSearcher(createSearcher(recs)); } },
      () => { if (!dead) setFailed(true); },
    );
    return () => { dead = true; };
  }, [open, searcher]);

  const result = useMemo(() => (searcher && q.trim() ? searcher.search(q) : null), [searcher, q]);
  const suggestion = useMemo(() => (searcher && q.trim() && result && result.groups.length === 0 ? suggest(q, records, (t) => { const r = searcher.search(t); return r.counts.trips + r.counts.places + r.counts.areas; }) : null), [searcher, q, result, records]);
  const flat: SearchHit[] = useMemo(() => result?.groups.flatMap((g) => g.hits) ?? [], [result]);
  const status = failed ? 'Search is unavailable' : result ? describeCounts(result) : '';

  const go = (h: SearchHit | undefined) => {
    if (!h) return;
    onClose();
    router.push(h.record.h);
  };

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!flat.length) return;
      e.preventDefault();
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % flat.length : (a - 1 + flat.length) % flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[active] ?? flat[0]);
    } else if (e.key === 'Escape' && q) {
      // first Esc clears; the dialog only closes on the next one
      e.preventDefault();
      e.stopPropagation();
      setQ('');
    }
  };

  let index = -1;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="scrim" />
        <Dialog.Popup className="search-dialog gs" aria-describedby={undefined} initialFocus={inputRef}>
          <Dialog.Title className="sr-only">Search trips, places and areas</Dialog.Title>
          <div className="gs-bar">
            <div className="search">
              <Icon name="search" size={16} />
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-expanded={flat.length > 0}
                aria-controls={listId}
                aria-activedescendant={flat.length ? `${listId}-${active}` : undefined}
                aria-autocomplete="list"
                aria-label="Search trips, places and areas"
                placeholder="Search trips, places and areas"
                autoComplete="off"
                value={q}
                onChange={(e) => { setQ(e.target.value); setActive(0); }}
                onKeyDown={onKeyDown}
                onFocus={stopBuffer}
              />
              {q ? (
                <button type="button" className="search-clear" aria-label="Clear search" onClick={() => { setQ(''); inputRef.current?.focus(); }}>
                  <Icon name="close" size={14} />
                </button>
              ) : null}
            </div>
            <button type="button" className="gs-close" onClick={onClose}>
              Close
            </button>
          </div>
          <span className="sr-only" role="status" aria-live="polite">{status}</span>

          <div className="gs-body" id={listId} role="listbox" aria-label="Results">
            {failed ? (
              <p className="gs-empty">Search could not load. Reload the page to try again.</p>
            ) : !q.trim() ? (
              <p className="gs-hint">Try a country, a trail or a kind, like lake.</p>
            ) : !searcher ? (
              <p className="gs-hint">Loading the index.</p>
            ) : !result || result.groups.length === 0 ? (
              <p className="gs-empty">
                No trip or place matches &lsquo;{q.trim()}&rsquo;. {suggestion ? '' : 'Try a country or a kind, like lake.'}
                {suggestion?.href ? (
                  <a className="gs-suggest" href={suggestion.href} onClick={(e) => { e.preventDefault(); onClose(); router.push(suggestion.href!); }}>{suggestion.label}</a>
                ) : suggestion?.query ? (
                  <button type="button" className="gs-suggest" onClick={() => { setQ(suggestion.query!); setActive(0); inputRef.current?.focus(); }}>{suggestion.label}</button>
                ) : null}
              </p>
            ) : (
              result.groups.map((g) => (
                <div key={g.id} role="group" aria-label={g.label} className="gs-group">
                  <h3 className="gs-group-h">
                    {g.label} <span className="gs-count">{g.total}</span>
                  </h3>
                  {g.hits.map((h) => {
                    index += 1;
                    const i = index;
                    return (
                      <a
                        key={h.record.h}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        data-active={i === active || undefined}
                        href={h.record.h}
                        className="gs-row"
                        onMouseMove={() => setActive(i)}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                          e.preventDefault();
                          go(h);
                        }}
                      >
                        <span className="kind-glyph kind-glyph-sm" aria-hidden="true">
                          <Icon name={glyph(h.record)} size={15} />
                        </span>
                        <span className="gs-text">
                          <span className="gs-name">{h.record.n}</span>
                          <span className="gs-sub">{h.record.s}</span>
                        </span>
                      </a>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
