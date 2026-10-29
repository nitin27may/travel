'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PlanOrigin } from '@travel/core/schema/plan-draft.ts';
import type { PlanStarts } from '@travel/core/schema/api/plan.ts';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { plural } from '@/lib/plan/format';

const SHOWN = 8;
const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

interface Option {
  key: string;
  origin: PlanOrigin;
  name: string;
  /** the name with its code, as the list and the chosen row show it */
  label: string;
  /** the second line: the code and the country, or "City" */
  meta: string;
  cc: string | null;
  rank: number;
}

/** The airports and cities as one list of options, the country of each kept for the suggestions. */
function optionsOf(starts: PlanStarts): Option[] {
  const air: Option[] = starts.airports.map((a) => ({ key: `iata:${a.iata}`, origin: { kind: 'airport', iata: a.iata }, name: a.name, label: `${a.name} (${a.iata})`, meta: a.cc ?? '', cc: a.cc, rank: 0 }));
  const city: Option[] = starts.hubs.map((h) => ({ key: `hub:${h.id}`, origin: { kind: 'hub', id: h.id }, name: h.name, label: h.name, meta: h.cc ? `${h.cc} · city` : 'City', cc: h.cc, rank: 1 }));
  return [...air, ...city];
}

/** The country the browser speaks for (`en-CA` gives CA), used only to order the suggestions; it never leaves the page. */
function localeCountry(): string | null {
  try {
    return /-([A-Z]{2})\b/.exec(navigator.language)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * "Flying from" (FLOW TF4, RB-019): the chosen airport or city with Change, else a search field over the public list. The list is never
 * drawn whole (it holds hundreds of airports): the suggestions are eight (the last choice, then the airports of the country the browser
 * speaks for), and typing narrows to eight matches by name, code or country. The answer is a typed reference; the name is for the screen.
 */
export function AirportPicker({
  starts,
  value,
  name,
  last,
  emptyWord,
  labelledBy,
  onPick,
  onClear,
}: {
  starts: PlanStarts;
  value: PlanOrigin | null;
  name: string | null;
  /** the last choice on this device, offered first */
  last: { origin: PlanOrigin; name: string } | null;
  /** what "no choice" is called ("Decide later" for a holiday) */
  emptyWord: string;
  labelledBy: string;
  onPick: (origin: PlanOrigin, name: string) => void;
  onClear: () => void;
}) {
  const all = useMemo(() => optionsOf(starts), [starts]);
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();
  const showSearch = value === null || editing;
  const chosen = value?.kind === 'airport' ? `${name ?? value.iata} (${value.iata})` : (name ?? 'Chosen');

  const lastKey = last ? (last.origin.kind === 'airport' ? `iata:${last.origin.iata}` : last.origin.kind === 'hub' ? `hub:${last.origin.id}` : '') : '';
  const want = norm(q.trim());
  const { rows, total } = useMemo(() => {
    if (want) {
      const hit = all
        .map((o) => {
          const n = norm(o.name);
          const code = o.origin.kind === 'airport' ? o.origin.iata.toLowerCase() : '';
          const score = code === want ? 0 : n.startsWith(want) ? 1 : n.includes(want) ? 2 : o.cc && norm(o.cc) === want ? 3 : -1;
          return { o, score };
        })
        .filter((x) => x.score >= 0)
        .sort((a, b) => a.score - b.score || a.o.rank - b.o.rank || a.o.name.localeCompare(b.o.name));
      return { rows: hit.slice(0, SHOWN).map((x) => x.o), total: hit.length };
    }
    const cc = (last ? all.find((o) => o.key === lastKey)?.cc : null) ?? localeCountry();
    const near = all.filter((o) => o.key !== lastKey && cc !== null && o.cc === cc).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
    const first = last ? all.filter((o) => o.key === lastKey) : [];
    const list = [...first, ...near, ...all.filter((o) => !first.includes(o) && !near.includes(o))];
    return { rows: list.slice(0, SHOWN), total: all.length };
  }, [all, want, last, lastKey]);

  useEffect(() => setActive(0), [want]);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const choose = (o: Option) => {
    onPick(o.origin, o.name);
    setEditing(false);
    setOpen(false);
    setQ('');
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && open && rows[active]) {
      e.preventDefault();
      choose(rows[active]!);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      if (value !== null) setEditing(false);
    }
  };

  if (!showSearch) {
    return (
      <div className="plan-from" data-testid="plan-from">
        <p className="plan-from-name">{chosen}</p>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)} aria-label={`Change where you fly from, now ${chosen}`}>
          Change
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} aria-label={`${emptyWord}: clear where you fly from`}>
          Clear
        </Button>
      </div>
    );
  }
  return (
    <div
      className="plan-combo"
      ref={wrap}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <span className="input plan-combo-input">
        <Icon name="search" size={16} />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-labelledby={labelledBy}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Find an airport or city"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
      </span>
      <p className="sr-only" role="status" aria-live="polite">
        {open ? (want ? plural(total, 'match', 'matches') : `${rows.length} suggestions`) : ''}
      </p>
      {open ? (
        <ul id={listId} role="listbox" aria-label={want ? 'Matching airports and cities' : 'Suggested airports and cities'} className="plan-combo-list">
          {rows.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="plan-combo-opt"
              data-active={i === active || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              onMouseMove={() => setActive(i)}
            >
              <span className="plan-combo-name">{o.label}</span>
              {o.meta ? <span className="plan-combo-meta">{o.meta}</span> : null}
            </li>
          ))}
          {!rows.length ? <li className="plan-combo-none">No airport or city matches “{q.trim()}”.</li> : null}
          {total > rows.length ? <li className="plan-combo-more">{want ? `${total - rows.length} more. Keep typing to narrow the list.` : 'Type a city, an airport or its code to search.'}</li> : null}
        </ul>
      ) : null}
      <div className="plan-combo-foot">
        {value !== null ? (
          <button type="button" className="link-btn" onClick={() => { setEditing(false); setOpen(false); setQ(''); }}>
            Keep {chosen}
          </button>
        ) : (
          <button type="button" className="link-btn" onClick={() => { setOpen(false); onClear(); }}>
            {emptyWord}
          </button>
        )}
      </div>
    </div>
  );
}
