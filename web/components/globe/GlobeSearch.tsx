'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { CountryBook } from '@/lib/globe/countries';
import { loadGazetteer, search, type GazEntry, type SearchHit } from '@/lib/globe/search';
import type { GlobeCard } from '@/lib/globe/types';

interface Props {
  cards: GlobeCard[];
  book: CountryBook;
  onPick(hit: SearchHit): void;
}

/** Search a country, state, city, sea or range (components 7.2); saved places and trips come first. `/` focuses it. */
export function GlobeSearch({ cards, book, onPick }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [gaz, setGaz] = useState<GazEntry[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const sources = useMemo(() => ({ gazetteer: gaz, cards, countriesByA3: book.byA3 }), [gaz, cards, book]);
  const hits = useMemo(() => (open ? search(q, sources) : []), [q, sources, open]);

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
        placeholder="Search a country, state, city, sea or range"
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
