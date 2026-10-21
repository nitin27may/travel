'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { CountryBook } from '@/lib/globe/countries';
import { search as searchSite } from '@/lib/client/data';
import { loadGazetteer, norm, ownHit, search, type GazEntry, type SearchHit } from '@/lib/globe/search';

interface Props {
  /** A shorter prompt where the field is narrow (landscape phone). */
  placeholder?: string;
  book: CountryBook;
  /** False when the "Natural features" switch is off: rivers, landforms and seas leave the results. */
  features?: boolean;
  /** Turns natural features back on from the empty-result row; the query stays. */
  onTurnOnFeatures?(): void;
  onPick(hit: SearchHit): void;
}

/** Search a country, state, city, sea or range (components 7.2); saved places and trips come first. `/` focuses it. */
export function GlobeSearch({ book, features = true, onTurnOnFeatures, onPick, placeholder = 'Search the globe' }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [gaz, setGaz] = useState<GazEntry[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [own, setOwn] = useState<SearchHit[]>([]);
  const sources = useMemo(() => ({ gazetteer: gaz, own, countriesByA3: book.byA3 }), [gaz, own, book]);

  // Saved places and trips come from the site search (sharded by country, loaded as the query needs them); the globe holds no list of its own.
  useEffect(() => {
    const term = q.trim();
    if (!open || !term) { setOwn([]); return; } // eslint-disable-line react-hooks/set-state-in-effect -- clears the answer when the query empties
    let live = true;
    const run = () => searchSite(term, {}, 12).then((r) => {
      if (!live) return;
      const hits = r.groups.filter((g) => g.id !== 'areas').flatMap((g) => g.hits.map((h) => ownHit(h.record)));
      // the site search also matches area and kind text; the globe lists only places and trips whose own name matches
      const nq = norm(term);
      const named = (h: SearchHit) => norm(h.name).startsWith(nq) || (nq.length >= 3 && norm(h.name).includes(nq));
      setOwn(hits.filter((h): h is SearchHit => !!h && named(h)).sort((a, b) => Number(norm(b.name).startsWith(nq)) - Number(norm(a.name).startsWith(nq)) || a.name.length - b.name.length));
    }).catch(() => live && setOwn([]));
    void run();
    return () => { live = false; };
  }, [q, open]);
  const hits = useMemo(() => (open ? search(q, sources, 12, { features }) : []), [q, sources, open, features]);

  // With the switch off, a query that matches only natural features says so and offers the one way back (P4), instead of an empty list.
  const hiddenFeature = useMemo(() => {
    if (features || !open || !q.trim() || hits.length) return null;
    return search(q, sources, 12, { features: true }).find((h) => h.action.type === 'feature') ?? null;
  }, [features, open, q, sources, hits.length]);

  const warm = () => { void loadGazetteer().then(setGaz).catch(() => undefined); };
  const pick = (h: SearchHit | undefined) => {
    if (!h) return;
    setQ(h.name); setOpen(false); input.current?.blur();
    onPick(h);
  };

  return (
    <div className="globe-search" role="search">
      <Icon name="search" size={16} className="globe-search-icon" />
      <input
        ref={input}
        type="search"
        className="globe-search-input"
        placeholder={placeholder}
        aria-label="Search the globe"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={hits[cursor] ? `${listId}-${cursor}` : undefined}
        autoComplete="off"
        value={q}
        onFocus={() => { warm(); setOpen(true); }}
        onChange={(e) => { setQ(e.target.value); setCursor(0); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { setCursor((c) => Math.min(hits.length - 1, c + 1)); e.preventDefault(); }
          else if (e.key === 'ArrowUp') { setCursor((c) => Math.max(0, c - 1)); e.preventDefault(); }
          else if (e.key === 'Enter') pick(hits[cursor] ?? hits[0]);
          else if (e.key === 'Escape') { if (open) { setOpen(false); e.stopPropagation(); } else input.current?.blur(); }
        }}
      />
      {hiddenFeature ? (
        <ul className="globe-results" role="listbox" aria-label="Search results">
          <li className="globe-result globe-result-note" role="presentation" onMouseDown={(e) => e.preventDefault()}>
            <span className="globe-result-name">{hiddenFeature.name} is a natural feature. Natural features are off.</span>
            <button type="button" className="globe-result-act" onClick={() => onTurnOnFeatures?.()}>Turn on</button>
          </li>
        </ul>
      ) : null}
      {open && hits.length ? (
        <ul className="globe-results" role="listbox" id={listId} aria-label="Search results">
          {hits.map((h, i) => (
            <li key={h.id} id={`${listId}-${i}`} role="option" aria-selected={i === cursor} className="globe-result" data-on={i === cursor ? 'true' : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>
              <span className="globe-result-name">{h.flag ? `${h.flag} ` : ''}{h.name}</span>
              <span className="globe-result-kind"><b>{h.kindLabel}</b>{h.where ? ` · ${h.where}` : ''}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
