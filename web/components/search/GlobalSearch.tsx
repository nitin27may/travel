'use client';

import { writeSession } from '@/lib/storage/safe';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon, kindIcon } from '@/components/ui/Icon';
import { countParsedAsync, onSearchGrow, relaxText, relaxToResults, search, suggest } from '@/lib/client/data';
import type { Relaxation } from '@/lib/client/data';
import type { Suggestion } from '@/lib/search/suggest';
import { setSink, stopBuffer, takeBuffer } from '@/lib/search/typeahead';
import { describeCounts } from '@/lib/search/search';
import { QueryChips } from './QueryChips';
import { useQueryParse } from './useQueryParse';
import { HANDOFF_KEY } from '@/lib/search/applied';
import type { Handoff } from '@/lib/search/applied';
import type { SearchHit, SearchRecord, SearchResult } from '@/lib/search/types';
import type { ParsedQuery } from '@/lib/search/parse/types';
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
 * One search over trips, places and areas (components 2.10). A panel under the header on desktop and under the phone header above the
 * bottom bar. It is not modal (lists-stage4-note section 2): no scrim, no `aria-modal`, no inert page and no trap; the page keeps its scroll.
 * Esc clears the text and then closes, a click outside or Tab out closes, and focus goes back to the control that opened it. Nothing loads until the first character: the index is split by kind and country, and the
 * parts that can match the query load first (lib/client/data.ts `search`); the rest follow and the answer refreshes. Arrow keys move, Enter opens, Esc clears and then closes.
 */
export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState(() => takeBuffer());
  const [answer, setResult] = useState<SearchResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [suggested, setSuggested] = useState<{ q: string; s: Suggestion | null } | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [closing, setClosing] = useState(false);
  // the words read as filters (backlog 3.43); the name hits below stay as they were (A1)
  const smart = useQueryParse(q, { enabled: open });

  // the panel eases out before it goes; focus returns to the control that opened it when the visitor asked to close (Esc, Close)
  const requestClose = (returnFocus: boolean) => {
    if (closing) return;
    setClosing(true);
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      onClose();
      if (returnFocus && opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
    }, calm ? 0 : 120);
  };
  useEffect(() => {
    opener.current = document.activeElement;
    // after the buffer effect below has taken the keys typed so far, as the dialog's initial focus used to
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);
  // not modal: a tap outside closes it without being swallowed, and so does 60 px of page scroll on desktop once the box is empty
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || panelRef.current?.contains(t)) return;
      // a second press on a Search button (header or hero) closes the panel and returns focus to it; the click that follows only
      // asks to open what is already open, so it ends closed
      const toggle = t.closest('[aria-keyshortcuts="/"]');
      // Safari does not focus a button on press, so the opener recorded at mount can be <body>: focus the button that was pressed
      if (toggle) opener.current = toggle;
      requestClose(!!toggle);
    };
    const startY = window.scrollY;
    const onScroll = () => {
      if (window.matchMedia('(min-width: 640px)').matches && !inputRef.current?.value && Math.abs(window.scrollY - startY) > 60) requestClose(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll);
    };
    // requestClose reads state that only changes to close
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing]);

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

  // nothing matched and every part is in: ask the data module for the nearest question that does have an answer
  const nothing = !!answer && answer.groups.length === 0 && !answer.partial;
  useEffect(() => {
    if (!open || !nothing || !q.trim()) return;
    let live = true;
    suggest(q).then(
      (s) => live && setSuggested({ q, s }),
      () => live && setSuggested({ q, s: null }),
    );
    return () => {
      live = false;
    };
  }, [open, nothing, q]);
  const suggestion = suggested?.q === q ? suggested.s : null;

  // an empty box shows the hint, never the last answer
  const result = q.trim() ? answer : null;
  const hits: SearchHit[] = useMemo(() => result?.groups.flatMap((g) => g.hits) ?? [], [result]);
  const parsed = smart.parsed;
  const read = !!parsed && parsed.target !== 'search' && parsed.chips.length > 0 ? parsed : null;
  // the count and the "did you mean" come from the list files of the page we are on, so they arrive a moment after the reading
  const [counted, setCounted] = useState<{ for: ParsedQuery; got: { n: number; unchecked: number } | null } | null>(null);
  const [relaxed, setRelaxed] = useState<{ for: ParsedQuery; got: Relaxation | null } | null>(null);
  useEffect(() => {
    if (!read) return;
    let alive = true;
    void countParsedAsync(read).then((got) => alive && setCounted({ for: read, got }));
    return () => {
      alive = false;
    };
  }, [read]);
  const count = read && counted?.for === read ? counted.got : null;
  useEffect(() => {
    if (!read || count?.n !== 0) return;
    let alive = true;
    void relaxToResults(read).then((got) => alive && setRelaxed({ for: read, got }), () => alive && setRelaxed({ for: read, got: null }));
    return () => {
      alive = false;
    };
  }, [read, count]);
  const relax = read && count?.n === 0 && relaxed?.for === read ? relaxed.got : null;
  const noun = read?.target === 'trips' ? 'trips' : 'places';
  // the first option opens the list the words describe, then the other readings, then the name hits (smart-search 6.1)
  const lead: { id: string; href: string; kind: 'show' | 'dym'; label: string }[] = useMemo(
    () =>
      read
        ? [
            // a reading that gives nothing opens the relaxed one: never a bare "Show 0 places" under neat chips
            relax
              ? { id: 'show', href: relax.parsed.href, kind: 'show', label: `Show ${relax.n} ${relax.n === 1 ? noun.slice(0, -1) : noun} that match ${relax.total - relax.dropped.length} of ${relax.total}` }
              : { id: 'show', href: read.href, kind: 'show', label: count === null ? `Show ${noun}` : `Show ${count.n} ${count.n === 1 ? noun.slice(0, -1) : noun}` },
            ...read.didYouMean.map((d, i) => ({ id: `dym-${i}`, href: d.href, kind: 'dym' as const, label: d.label })),
          ]
        : [],
    [read, count, noun, relax],
  );
  const optionCount = lead.length + hits.length;
  const status = failed ? 'Search is unavailable' : `${read ? `Read as ${read.chips.map((c) => c.label).join(', ')}. ` : ''}${result ? describeCounts(result) : ''}`.trim();

  const goTo = (href: string | undefined) => {
    if (!href) return;
    onClose();
    router.push(href);
  };
  // the first option opens the list the words describe: the list holds the reading like one typed in its own box (undo line, relaxing when it gives nothing)
  const handOff = (href: string) => {
    if (!read || href !== lead[0]?.href || lead[0]?.kind !== 'show') return;
    const value: Handoff = relax ? { text: q, parsed: relax.parsed, relaxed: { dropped: relax.dropped, total: relax.total } } : { text: q, parsed: read };
    writeSession(HANDOFF_KEY, JSON.stringify(value)); // blocked: the list just opens with the filters
  };
  const goOption = (i: number) => {
    const href = i < lead.length ? lead[i]?.href : hits[i - lead.length]?.record.h;
    if (href) handOff(href);
    goTo(href);
  };

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!optionCount) return;
      e.preventDefault();
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % optionCount : (a - 1 + optionCount) % optionCount));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goOption(Math.min(active, Math.max(optionCount - 1, 0)));
    } else if (e.key === 'Backspace' && read && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
      // nothing left of the caret to delete: Backspace takes off the last chip instead
      e.preventDefault();
      smart.remove(read.chips[read.chips.length - 1]!.id);
    } else if (e.key === 'Escape') {
      // first Esc clears the text; Esc on an empty box closes the panel
      e.preventDefault();
      e.stopPropagation();
      if (q) setQ('');
      else requestClose(true);
    }
  };

  let index = lead.length - 1;
  // portalled to <body>: the hero card is transformed, and a transformed ancestor turns position: fixed into "relative to the card"
  return createPortal(
    <div
      ref={panelRef}
      className="search-dialog gs gs-panel"
      role="search"
      aria-label="Search trips, places and areas"
      data-closing={closing || undefined}
      onBlur={(e) => {
        // Tab out of the panel closes it; a click elsewhere is the pointerdown above
        const next = e.relatedTarget as Node | null;
        if (next && !panelRef.current?.contains(next)) requestClose(false);
      }}
    >
          <div className="gs-bar">
            <div className="search">
              <Icon name="search" size={16} />
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-expanded={optionCount > 0}
                aria-controls={listId}
                aria-activedescendant={optionCount ? `${listId}-${Math.min(active, optionCount - 1)}` : undefined}
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
            <button type="button" className="gs-close" onClick={() => requestClose(true)}>
              Close
            </button>
          </div>
          <span className="sr-only" role="status" aria-live="polite">{status}</span>

          {read ? (
            <div className="gs-read">
              <QueryChips parsed={read} onRemove={smart.remove} onPick={smart.pick} onEmpty={() => inputRef.current?.focus()} />
              {relax ? (
                <p className="gs-relaxed" role="status">
                  {relaxText(relax, noun)} &middot; without {relax.dropped.map((c) => c.label).join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="gs-body" id={listId} role="listbox" aria-label="Results">
            {failed ? (
              <p className="gs-empty">Search could not load. Reload the page to try again.</p>
            ) : !q.trim() ? (
              <p className="gs-hint">Try a country, a trail or a kind, like lake.</p>
            ) : !result && !read ? (
              <p className="gs-hint">Searching.</p>
            ) : null}
            {lead.length ? (
              <>
                {lead.slice(0, 1).map((o, i) => (
                  <a
                    key={o.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    data-active={i === active || undefined}
                    href={o.href}
                    className="gs-show"
                    onMouseMove={() => setActive(i)}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      handOff(o.href);
                      goTo(o.href);
                    }}
                  >
                    <span>{o.label}</span>
                    <small>{count && count.unchecked ? `+ ${count.unchecked} not checked yet \u00a0` : ''}Enter</small>
                  </a>
                ))}
                {lead.length > 1 ? (
                  <div role="group" aria-label="Did you mean" className="gs-dym">
                    <span>Did you mean</span>
                    {lead.slice(1).map((o, j) => {
                      const i = j + 1;
                      return (
                        <a
                          key={o.id}
                          id={`${listId}-${i}`}
                          role="option"
                          aria-selected={i === active}
                          data-active={i === active || undefined}
                          href={o.href}
                          className="gs-dym-row"
                          onMouseMove={() => setActive(i)}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                            e.preventDefault();
                            goTo(o.href);
                          }}
                        >
                          {o.label}
                        </a>
                      );
                    })}
                  </div>
                ) : null}
                {hits.length ? <h3 className="gs-names-h">Names that match the words</h3> : null}
              </>
            ) : null}
            {result && result.groups.length === 0 && result.partial && !read ? (
              <p className="gs-hint">Searching.</p>
            ) : result && result.groups.length === 0 && !read && q.trim() ? (
              <p className="gs-empty">
                No trip or place matches &lsquo;{q.trim()}&rsquo;. {suggestion ? '' : 'Try a country or a kind, like lake.'}
                {suggestion?.href ? (
                  <a className="gs-suggest" href={suggestion.href} onClick={(e) => { e.preventDefault(); goTo(suggestion.href); }}>{suggestion.label}</a>
                ) : suggestion?.query ? (
                  <button type="button" className="gs-suggest" onClick={() => { setQ(suggestion.query!); setActive(0); inputRef.current?.focus(); }}>{suggestion.label}</button>
                ) : null}
              </p>
            ) : (
              result?.groups.map((g) => (
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
                          goTo(h.record.h);
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
    </div>,
    document.body,
  );
}
