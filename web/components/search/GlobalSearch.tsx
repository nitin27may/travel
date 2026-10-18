'use client';

import { Dialog } from '@base-ui/react/dialog';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon, kindIcon } from '@/components/ui/Icon';
import { onSearchGrow, search } from '@/lib/client/data';
import { setSink, stopBuffer, takeBuffer } from '@/lib/search/typeahead';
import { describeCounts } from '@/lib/search/search';
import type { SearchHit, SearchRecord, SearchResult } from '@/lib/search/types';
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
 * full-height sheet on phone. Nothing loads until the first character: the index is split by kind and country, and the
 * parts that can match the query load first (lib/client/data.ts `search`); the rest follow and the answer refreshes. Arrow keys move, Enter opens, Esc clears and then closes.
 */
export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState(() => takeBuffer());
  const [answer, setResult] = useState<SearchResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
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

  // more parts landed after an answer: ask again
  useEffect(() => onSearchGrow(() => setTick((t) => t + 1)), []);

  useEffect(() => {
    if (!open || !q.trim()) return;
    let live = true;
    search(q).then(
      (r) => {
        if (!live) return;
        setFailed(false);
        setResult(r);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [open, q, tick]);

  // an empty box shows the hint, never the last answer
  const result = q.trim() ? answer : null;
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
            ) : !result ? (
              <p className="gs-hint">Searching.</p>
            ) : result.groups.length === 0 && result.partial ? (
              <p className="gs-hint">Searching.</p>
            ) : result.groups.length === 0 ? (
              <p className="gs-empty">
                No trip or place matches &lsquo;{q.trim()}&rsquo;. Try a country or a kind, like lake.
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
