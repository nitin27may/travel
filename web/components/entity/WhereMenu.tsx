'use client';

import { Popover } from '@base-ui/react/popover';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { FacetCount } from '@/lib/entities/filter';
import type { ListState } from '@/lib/entities/types';
import { useMediaQuery } from './useMediaQuery';
import { findWhere, pickArea, pickCountry, pickRegion, regionNoun, selectionOf, splitZero, whereSummary } from './whereModel';
import type { WhereLevel, WhereMatch, WhereParam } from './whereModel';

// The Where filter (nearby-and-regions 4.3 to 4.5, plan A7): country, then state or province, then parks and areas, in one menu. Three
// columns on a desktop, one drilled level at a time on a phone. It reads the facet counts the list already holds (the country's file is
// loaded once a country is chosen) and writes the URL keys `country`, `region` and `area`. It loads nothing itself (P8, P9).

export interface WhereProps {
  /** The pill's name: "Where". */
  label: string;
  state: ListState;
  counts: Record<string, FacetCount[]>;
  /** True while the files that answer the query are loading: the deeper levels then say "Counting…" instead of guessing. */
  loading: boolean;
  /** Rows that match now, for the foot button. */
  shown: number | null;
  labelOf: (param: WhereParam, value: string) => string;
  /** One state change, whatever its depth, so the URL gets one history entry. */
  onPick: (facets: ListState['facets']) => void;
  /** The find field's fallback: hand the words to the list's own search box, which reads "Alberta" as a place. */
  onSearch: (q: string) => void;
}

interface RowProps {
  label: string;
  count?: number;
  selected: boolean;
  kind: 'radio' | 'check' | 'all';
  parent?: boolean;
  tab: boolean;
  empty?: boolean;
  tag?: string;
  onActivate: () => void;
}

function Row({ label, count, selected, kind, parent, tab, empty, tag, onActivate }: RowProps) {
  const counted = count !== undefined && count >= 0;
  // the name is the row's own text ("Alberta 116 places"): no aria-label, so the visible words are always inside the name
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={tab ? 0 : -1}
      className="where-opt"
      data-kind={kind}
      data-selected={selected || undefined}
      data-empty={empty || undefined}
      onClick={onActivate}
    >
      {/* the foundation marks (components 2.5): the same .check-box the Kind and Season menus draw, driven by a hidden input */}
      <span className={kind === 'check' ? 'check where-check' : 'check check-radio where-check'} aria-hidden="true">
        <input type={kind === 'check' ? 'checkbox' : 'radio'} checked={selected} readOnly tabIndex={-1} />
        <span className="check-box">{kind === 'check' ? <Icon name="check" size={13} strokeWidth={2.6} /> : <span className="check-dot" />}</span>
      </span>
      <span className="where-name">
        {label}
        {tag ? <span className="where-tag">{tag}</span> : null}
      </span>
      {counted ? (
        <span className="opt-count num">
          {count}
          <span className="sr-only"> {count === 1 ? 'place' : 'places'}</span>
        </span>
      ) : null}
      {parent ? <Icon name="chevronRight" size={14} /> : null}
    </div>
  );
}

/** One level as a listbox. Up and Down move inside it; the owner of the menu handles Left, Right, Enter and Space. */
function List({ level, label, children, onKey }: { level: WhereLevel | 'find'; label: string; children: ReactNode; onKey: (e: KeyboardEvent<HTMLDivElement>, level: WhereLevel | 'find') => void }) {
  return (
    <div role="listbox" aria-label={label} aria-multiselectable={level === 1 || level === 2 || undefined} className="where-list" data-level={level} onKeyDown={(e) => onKey(e, level)}>
      {children}
    </div>
  );
}

/** The menu body: shared by the desktop popover (`columns`), the phone popover and the phone sheet (`drill`). */
export function WhereBody({ mode, state, counts, loading, shown, labelOf, onPick, onSearch, onDone, hideFoot }: Omit<WhereProps, 'label'> & { mode: 'columns' | 'drill'; onDone: () => void; /** The phone sheet has its own Show and Clear all. */ hideFoot?: boolean }) {
  const sel = selectionOf(state.facets);
  const country = sel.country[0];
  const noun = regionNoun(country);
  const [find, setFind] = useState('');
  const [showZero, setShowZero] = useState<Record<number, boolean>>({});
  const [level, setLevel] = useState<WhereLevel>(sel.region.length ? 2 : country ? 1 : 0);
  const findRef = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // a level's listbox, found by its data attribute: 0 to 2 are the levels, 3 is the find results
  const listOf = (n: number) => root.current?.querySelector<HTMLElement>(`.where-list[data-level="${n === 3 ? 'find' : n}"]`) ?? null;
  const pending = useRef<WhereLevel | null>(null);
  const findId = useId();

  const countries = counts.country ?? [];
  const regionsReady = !loading && counts.region !== undefined;
  const regions = country && regionsReady ? counts.region! : [];
  const areas = sel.region.length && regionsReady ? counts.area ?? [] : [];
  const regionsSplit = splitZero(regions, sel.region);
  const areasSplit = splitZero(areas, sel.area);
  const countryCount = countries.find((c) => c.value === country)?.count ?? 0;
  const regionsLabel = (sel.region.length <= 2 ? sel.region.map((v) => labelOf('region', v)).join(', ') : `${sel.region.length} ${noun.many}`) || '';
  const regionsCount = sel.region.reduce((n, v) => n + (regions.find((r) => r.value === v)?.count ?? 0), 0);
  const countryName = country ? labelOf('country', country) : '';

  const matches = findWhere(find, { countries, regions, areas });

  // a Right or Enter key opens the next level: its first option takes focus once the options are there
  useEffect(() => {
    if (pending.current === null) return;
    const list = listOf(pending.current);
    const target = list?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]:not([data-kind="all"])') ?? list?.querySelector<HTMLElement>('[role="option"]');
    if (!target) return;
    target.focus();
    pending.current = null;
  });

  const focusLevel = (l: WhereLevel) => {
    pending.current = l;
    // the effect above runs after the next render; when the level is already drawn, do it now
    const list = listOf(l);
    const target = list?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]:not([data-kind="all"])') ?? list?.querySelector<HTMLElement>('[role="option"]');
    if (target) {
      target.focus();
      pending.current = null;
    }
  };

  const apply = (facets: ListState['facets']) => onPick(facets);
  const chooseCountry = (value: string) => {
    apply(pickCountry(state.facets, value));
    if (mode === 'drill') setLevel(1);
  };
  const chooseRegion = (value: string | null) => {
    apply(pickRegion(state.facets, value, mode === 'drill'));
    if (mode === 'drill' && value !== null) setLevel(2);
  };
  const chooseArea = (value: string | null) => apply(pickArea(state.facets, value));
  const chooseMatch = (m: WhereMatch) => {
    if (m.level === 0) chooseCountry(m.value);
    else if (m.level === 1) apply(pickRegion(state.facets, m.value));
    else apply({ ...state.facets, area: sel.area.includes(m.value) ? sel.area : [...sel.area, m.value] });
    setFind('');
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>, lv: WhereLevel | 'find') => {
    const list = e.currentTarget;
    const opts = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
    const at = opts.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => {
      e.preventDefault();
      opts[Math.max(0, Math.min(opts.length - 1, i))]?.focus();
    };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') {
      if (at <= 0) {
        e.preventDefault();
        findRef.current?.focus();
      } else go(at - 1);
    } else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(opts.length - 1);
    else if (e.key === 'ArrowRight' && typeof lv === 'number' && lv < 2) {
      e.preventDefault();
      focusLevel((lv + 1) as WhereLevel);
    } else if (e.key === 'ArrowLeft' && typeof lv === 'number' && lv > 0) {
      e.preventDefault();
      focusLevel((lv - 1) as WhereLevel);
    } else if (e.key === ' ' && at >= 0) {
      e.preventDefault();
      opts[at]!.click();
    } else if (e.key === 'Enter' && at >= 0) {
      e.preventDefault();
      const o = opts[at]!;
      // Enter on a parent opens the level below it; on a country or province that is also the pick
      if (o.getAttribute('aria-selected') !== 'true' || lv === 'find') o.click();
      if (typeof lv === 'number' && lv < 2 && o.dataset.kind !== 'all') focusLevel((lv + 1) as WhereLevel);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) findRef.current?.focus();
  };

  const tabFor = (selected: boolean, index: number, anySelected: boolean) => (anySelected ? selected : index === 0);

  const countryRows = (
    <List level={0} label="Country" onKey={onKey}>
      {countries.map((c, i) => (
        <Row key={c.value} label={c.label} count={c.count} selected={sel.country.includes(c.value)} kind="radio" parent tab={tabFor(sel.country.includes(c.value), i, sel.country.length > 0)} onActivate={() => chooseCountry(c.value)} />
      ))}
    </List>
  );

  const zeroLine = (n: number, what: string, key: number) =>
    n > 0 ? (
      <button type="button" className="where-zero" onClick={() => setShowZero({ ...showZero, [key]: !showZero[key] })}>
        {showZero[key] ? `Hide the ${n} with none` : `${n} more ${what} have none here · Show`}
      </button>
    ) : null;

  const regionRows = !country ? (
    <p className="where-note muted">Choose a country to see its {noun.many}.</p>
  ) : !regionsReady ? (
    <p className="where-note muted" role="status">Counting&hellip;</p>
  ) : (
    <List level={1} label={noun.one} onKey={onKey}>
      <Row label={`All of ${countryName}`} count={countryCount} selected={sel.region.length === 0} kind="all" tab={sel.region.length === 0} onActivate={() => chooseRegion(null)} />
      {(showZero[1] ? regions : regionsSplit.shown).map((r) => (
        <Row key={r.value} label={r.label} count={r.count} empty={r.count === 0} selected={sel.region.includes(r.value)} kind={mode === 'drill' ? 'radio' : 'check'} parent={mode === 'drill'} tab={sel.region.includes(r.value)} onActivate={() => chooseRegion(r.value)} />
      ))}
      {!regions.length ? <p className="where-note muted">No {noun.many} recorded for {countryName}.</p> : null}
      {zeroLine(regionsSplit.hidden.length, noun.many, 1)}
    </List>
  );

  const areaRows = !sel.region.length ? (
    <p className="where-note muted">Choose {noun.one.toLowerCase() === 'state' ? 'a state' : `a ${noun.one.toLowerCase()}`} to see its parks and areas.</p>
  ) : !regionsReady ? (
    <p className="where-note muted" role="status">Counting&hellip;</p>
  ) : (
    <List level={2} label="Parks and areas" onKey={onKey}>
      <Row label={`All of ${regionsLabel}`} count={regionsCount} selected={sel.area.length === 0} kind="all" tab={sel.area.length === 0} onActivate={() => chooseArea(null)} />
      {(showZero[2] ? areas : areasSplit.shown).map((a) => (
        <Row key={a.value} label={a.label} count={a.count} empty={a.count === 0} selected={sel.area.includes(a.value)} kind="check" tab={sel.area.includes(a.value)} onActivate={() => chooseArea(a.value)} />
      ))}
      {!areas.length ? <p className="where-note muted">No parks or areas recorded here.</p> : null}
      {zeroLine(areasSplit.hidden.length, 'areas', 2)}
    </List>
  );

  const findBox = (
    <input
      ref={findRef}
      id={findId}
      type="search"
      className="facet-find where-find"
      placeholder="Find a country, province or park"
      aria-label="Find a country, province or park"
      value={find}
      autoComplete="off"
      onChange={(e) => setFind(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const list = find ? listOf(3) : listOf(mode === 'drill' ? level : sel.region.length ? 2 : country ? 1 : 0);
          (list?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]:not([data-kind="all"])') ?? list?.querySelector<HTMLElement>('[role="option"]'))?.focus();
        } else if (e.key === 'Enter' && find && matches[0]) {
          e.preventDefault();
          chooseMatch(matches[0]);
        }
      }}
    />
  );

  const levelName = (m: WhereMatch) => (m.level === 0 ? 'Country' : m.level === 1 ? noun.one : 'Park or area');
  const results = (
    <div className="where-results">
      {matches.length ? (
        <List level="find" label="Matches" onKey={onKey}>
          {matches.slice(0, 12).map((m, i) => (
            <Row key={`${m.level}:${m.value}`} label={m.label} count={m.count} tag={levelName(m)} selected={sel[(['country', 'region', 'area'] as const)[m.level]].includes(m.value)} kind={m.level === 0 ? 'radio' : 'check'} tab={i === 0} onActivate={() => chooseMatch(m)} />
          ))}
        </List>
      ) : (
        <p className="where-note muted" role="status">
          {loading && country ? (
            <>Counting&hellip;</>
          ) : (
            <>
              {country ? `No ${noun.one.toLowerCase()} or park in ${countryName} matches` : 'No country matches'} &ldquo;{find}&rdquo;.{' '}
              <button type="button" className="link-btn" onClick={() => { onSearch(find); setFind(''); onDone(); }}>
                Search places for &ldquo;{find}&rdquo;
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );

  const any = sel.country.length > 0;
  const foot = (
    <div className="popover-foot where-foot">
      {any ? (
        <button type="button" className="link-btn" onClick={() => { apply(pickCountry(state.facets, null)); setLevel(0); }}>
          Clear Where
        </button>
      ) : (
        <span />
      )}
      <button type="button" className="btn pill-done" onClick={onDone}>
        {shown === null ? 'Done' : `Show ${shown}`}
      </button>
    </div>
  );

  if (mode === 'drill') {
    const parentName = level === 1 ? countryName : level === 2 ? regionsLabel : '';
    return (
      <div className="where-menu where-drill" data-level={level} ref={root}>
        <div className="where-head">
          {level > 0 ? (
            <button type="button" className="btn btn-icon btn-ghost where-back" onClick={() => setLevel((level - 1) as WhereLevel)} aria-label={`Back to ${level === 1 ? 'countries' : noun.many}`}>
              <Icon name="chevronLeft" size={18} />
            </button>
          ) : null}
          <span className="where-title">{level === 0 ? 'Where' : parentName}</span>
        </div>
        {findBox}
        {find ? (
          results
        ) : (
          <div className="where-level" key={level}>
            {level === 0 ? countryRows : level === 1 ? regionRows : areaRows}
          </div>
        )}
        {hideFoot ? null : foot}
      </div>
    );
  }

  return (
    <div className="where-menu where-columns" ref={root}>
      {findBox}
      {find ? (
        results
      ) : (
        <div className="where-cols">
          <section className="where-col" aria-label="Country">
            <h3 className="where-h">Country</h3>
            {countryRows}
          </section>
          <section className="where-col" aria-label={noun.one}>
            <h3 className="where-h">{noun.one}{country ? <span> in {countryName}</span> : null}</h3>
            {regionRows}
          </section>
          <section className="where-col" aria-label="Parks and areas">
            <h3 className="where-h">Parks and areas{sel.region.length ? <span> in {regionsLabel}</span> : null}</h3>
            {areaRows}
          </section>
        </div>
      )}
      {foot}
    </div>
  );
}

/** The Where pill: the label with the deepest choice, a clear button, and the menu. */
export function WherePill(props: WhereProps) {
  const { label, state, labelOf } = props;
  const [open, setOpen] = useState(false);
  const phone = useMediaQuery('(max-width: 639px)');
  const sel = selectionOf(state.facets);
  const active = sel.country.length > 0;
  return (
    <span className="pill where-pill" data-active={active || undefined}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className="pill-trigger">
          <span className="pill-text">{whereSummary(label, sel, labelOf)}</span>
          <Icon name="chevronDown" size={14} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" collisionPadding={8} className="popover-pos">
            <Popover.Popup className="popover where-popover" aria-label={label} initialFocus={() => (phone ? false : document.querySelector<HTMLElement>('.where-popover .where-find') ?? true)}>
              <WhereBody {...props} mode={phone ? 'drill' : 'columns'} onDone={() => setOpen(false)} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {active ? (
        <button type="button" className="pill-x" aria-label={`Clear ${label} filter`} onClick={() => props.onPick(pickCountry(state.facets, null))}>
          <Icon name="close" size={13} />
        </button>
      ) : null}
    </span>
  );
}
