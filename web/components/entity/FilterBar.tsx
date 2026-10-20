'use client';

import dynamic from 'next/dynamic';
import { useEffect, useId, useState } from 'react';
import '@/styles/filters.css';
import type { ReactElement, RefObject } from 'react';
import { Chip } from '@/components/ui/Chip';
import type { SmartRowProps } from '@/components/search/SmartRow';
import { Icon } from '@/components/ui/Icon';
import { SearchInput } from '@/components/ui/Input';
import { activeFilters, clearAll, dropDependents } from '@/lib/entities/filter';
import type { FacetCount } from '@/lib/entities/filter';
import { promotedFor, scopeTokens } from '@/lib/entities/facets';
import type { EntityDescriptor, FacetDef, FacetParam, ListState, ViewName } from '@/lib/entities/types';
import { FacetPopover } from './FacetMenu';
import { LazyMoreFilters } from './MoreFilters.lazy';
import { OPEN_FILTERS, OPEN_UNCHECKED } from '@/lib/entities/events';
import type { PhoneFilterProps } from './PhoneFilterSheet';
import { useMediaQuery } from './useMediaQuery';
import { ViewOptions } from './ViewOptions';
import { ViewSwitcher } from './ViewSwitcher';

export interface FilterBarProps<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
  counts: Record<string, FacetCount[]>;
  labelOf: (param: FacetParam, value: string) => string;
  /** Rows that match, or null while the files that answer the query are loading (the count line then says so; it never guesses). */
  shown: number | null;
  /** Rows inside the scope of the query (its Kind and country): the "of N" of the count line. */
  scope: number;
  /** What the scope is called: the Kind's name, or the list's noun. */
  scopeNoun: string;
  /** Rows listed apart as "not checked yet". */
  unchecked: number;
  /** Per facet with a "not known" state, the rows in it. */
  gaps: Record<string, number>;
  searchRef: RefObject<HTMLInputElement | null>;
  /** What the count line adds, e.g. "12 not checked yet" (a facet's `gap`). */
  notes?: string[];
  /** The smart-search reading of the box (backlog 3.43): held by the page, because the empty state needs it too. */
  smart?: Pick<SmartRowProps<Row>, 'applied' | 'onApplied' | 'onReading' | 'slot'> & { holding: boolean };
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
}

/** The most pills the bar holds: four primary and, when a Kind is chosen, two promoted from its scope (contract 7.1 rule 2). */
export const MAX_PROMOTED = 2;

function visibleFacets<Row>(d: EntityDescriptor<Row>, state: ListState, counts: Record<string, FacetCount[]>): FacetDef<Row>[] {
  // a scoped or guarded facet is in `counts` only while it can split the results (the 60% rule), so absence means hidden
  const guarded = (f: FacetDef<Row>) => f.scoped || f.guard || f.hideIfEmpty;
  return d.facets.filter((f) => !f.hidden && !f.legacy && (!f.dependsOn || (state.facets[f.dependsOn]?.length ?? 0) > 0) && (!guarded(f) || counts[f.param] !== undefined || (state.facets[f.param]?.length ?? 0) > 0));
}

/** Primary pills, then the facets the Kind scope promotes into the bar (at most two), then everything else under "More filters". */
export function partitionFacets<Row>(d: EntityDescriptor<Row>, state: ListState, counts: Record<string, FacetCount[]>): { primary: FacetDef<Row>[]; more: FacetDef<Row>[] } {
  const facets = visibleFacets(d, state, counts);
  const promoted = promotedFor(scopeTokens(d, state))
    .map((id) => facets.find((f) => f.param === id && f.tier === 'more'))
    .filter((f): f is FacetDef<Row> => Boolean(f))
    .slice(0, MAX_PROMOTED);
  return {
    primary: [...facets.filter((f) => f.tier !== 'more'), ...promoted],
    more: facets.filter((f) => f.tier === 'more' && !promoted.includes(f)),
  };
}

/** More-tier facets that cannot show yet because the facet they depend on has no value (region before a country, area before a region), with that facet's name. */
function waitingFacets<Row>(d: EntityDescriptor<Row>, state: ListState): { facet: FacetDef<Row>; parent: string }[] {
  return d.facets
    .filter((f) => !f.hidden && !f.scoped && f.tier === 'more' && f.dependsOn && !(state.facets[f.dependsOn]?.length ?? 0))
    .map((facet) => ({ facet, parent: d.facets.find((p) => p.param === facet.dependsOn)?.label ?? facet.dependsOn! }));
}

// the search box reads its words as filters in a chunk of its own: nothing of the parser rides in the first load of the list pages
const SmartRow = dynamic(() => import('@/components/search/SmartRow'), { ssr: false }) as unknown as <Row>(props: SmartRowProps<Row>) => ReactElement | null;

// generic components lose their type parameter through dynamic(); restore it
const PhoneFilterSheet = dynamic(() => import('./PhoneFilterSheet'), { ssr: false }) as unknown as <Row>(props: PhoneFilterProps<Row>) => ReactElement | null;

export function FilterBar<Row>(props: FilterBarProps<Row>) {
  const { d, state, counts, labelOf, shown, scope, scopeNoun, unchecked, gaps, searchRef, notes = [], smart, onState } = props;
  const [why, setWhy] = useState(false);
  const whyId = useId();
  const phone = useMediaQuery('(max-width: 639px)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetEver, setSheetEver] = useState(false);
  const { primary, more } = partitionFacets(d, state, counts);
  const waiting = waitingFacets(d, state);
  // while an age is chosen, the cards that are a stretch for it fade (filters.css reads this attribute)
  const kidAge = state.facets.kid?.[0];
  const hasAgeControl = d.facets.some((f) => f.control === 'age');
  useEffect(() => {
    const root = document.documentElement;
    if (hasAgeControl && kidAge && /^\d{1,2}$/.test(kidAge)) {
      root.dataset.kidAge = kidAge;
      root.style.setProperty('--kid-age-text', `"${kidAge}"`);
    } else {
      delete root.dataset.kidAge;
      root.style.removeProperty('--kid-age-text');
    }
    return () => {
      delete root.dataset.kidAge;
      root.style.removeProperty('--kid-age-text');
    };
  }, [hasAgeControl, kidAge]);
  // the phone summary's "More filters" opens the same sheet
  useEffect(() => {
    const open = () => {
      setSheetEver(true);
      setSheetOpen(true);
    };
    window.addEventListener(OPEN_FILTERS, open);
    return () => window.removeEventListener(OPEN_FILTERS, open);
  }, []);
  const chips = activeFilters(state, d, labelOf);
  // a filter that has its pill in the bar is shown once, as that pill; the chip row keeps the rest (and shows all of them on a phone)
  const pilled = new Set<string>(primary.map((f) => f.param));
  // while a reading shows, the list is held: the sentence is not a filter yet, so it adds no "of N" and no Clear all
  const filtered = chips.length > 0 || (!smart?.holding && state.q.trim().length > 0);
  const setFacet = (param: FacetParam, values: string[]) => {
    const next = { ...state, facets: { ...state.facets }, focus: null };
    if (values.length) next.facets[param] = values;
    else delete next.facets[param];
    // changing a parent facet resets what depends on it
    if (!values.length) dropDependents(next.facets, d, param);
    onState(next, 'push');
  };
  const changeView = (view: ViewName) => onState({ ...state, view, focus: null }, 'push');
  const activeCount = chips.length;
  // the notes behind "Why these?": everything the count line used to stack, minus the not-checked count that has its own link
  const whyNotes = notes.filter((n) => !/^\d+ not checked yet$/.test(n));
  // a list with no "Not checked yet" group (Trips) still says how many were left out, as plain words
  const leftOut = unchecked > 0 ? 0 : Number(notes.map((n) => /^(\d+) not checked yet$/.exec(n)?.[1]).find(Boolean) ?? 0);

  return (
    <div className="filter-bar" role="search" aria-label={`Filter ${d.noun.many}`}>
      <div className="filter-row">
        <SearchInput
          inputRef={searchRef}
          value={state.q}
          onChange={(q) => onState({ ...state, q, focus: null }, 'replace')}
          label={`Search ${d.noun.many}`}
          shortcut
        />

        {/* Both forms are in the server HTML and CSS shows one, so the bar has its final height before hydration (backlog 2.38, CLS). */}
        <span className="pill filters-btn" data-active={activeCount > 0 || undefined}>
          <button
            type="button"
            className="pill-trigger"
            aria-haspopup="dialog"
            onClick={() => {
              setSheetEver(true);
              setSheetOpen(true);
            }}
          >
            <Icon name="filter" size={16} />
            <span>{activeCount ? `Filters (${activeCount})` : 'Filters'}</span>
          </button>
        </span>
        {phone && sheetEver ? (
          <PhoneFilterSheet d={d} state={state} facets={primary} more={more} counts={counts} gaps={gaps} shown={shown} filtered={filtered} open={sheetOpen} onOpenChange={setSheetOpen} setFacet={setFacet} onState={onState} />
        ) : null}
        <div className="facet-group" role="group" aria-label="Filters">
          {primary.map((f) => (
            <FacetPopover key={f.param} facet={f} options={counts[f.param] ?? []} selected={state.facets[f.param] ?? []} onChange={(v) => setFacet(f.param, v)} gapN={gaps[f.param]} />
          ))}
          {more.length || waiting.length ? <LazyMoreFilters facets={more} waiting={waiting} counts={counts} gaps={gaps} state={state} setFacet={setFacet} /> : null}
        </div>

        <ViewSwitcher view={state.view} onChange={changeView} mapEnabled={Boolean(d.renderMap)} />
      </div>

      {smart ? <SmartRow d={d} state={state} onState={onState} searchRef={searchRef} applied={smart.applied} onApplied={smart.onApplied} onReading={smart.onReading} slot={smart.slot} /> : null}

      <div className="filter-row filter-row-2">
        <div className="count-block">
          <p className="count" role="status" aria-live="polite" aria-busy={shown === null || undefined}>
            <strong className="num">{shown ?? 'Counting\u2026'}</strong>
            {shown === null ? null : filtered ? (
              <span className="of">
                {' '}
                of {scope} {scope === 1 && scopeNoun === d.noun.many ? d.noun.one : scopeNoun}
              </span>
            ) : (
              <span> {shown === 1 ? d.noun.one : d.noun.many}</span>
            )}
            {kidAge && /^\d{1,2}$/.test(kidAge) && hasAgeControl ? <span className="count-qual"> &middot; for age {kidAge === '0' ? 'Baby' : kidAge}</span> : null}
          </p>
          {unchecked > 0 || leftOut > 0 || whyNotes.length ? (
            <p className="count-more">
              {unchecked > 0 ? (
                <button type="button" className="count-link" onClick={() => window.dispatchEvent(new Event(OPEN_UNCHECKED))}>
                  {unchecked} not checked yet
                </button>
              ) : null}
              {leftOut > 0 ? <span>{leftOut} not checked yet</span> : null}
              {whyNotes.length ? (
                <button type="button" className="count-link" aria-expanded={why} aria-controls={whyId} onClick={() => setWhy(!why)}>
                  Why these?
                  <Icon name="chevronDown" size={13} />
                </button>
              ) : null}
            </p>
          ) : null}
          {whyNotes.length ? (
            <div className="count-why" id={whyId} data-open={why || undefined} inert={!why}>
              <ul>
                {whyNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {chips.length || (filtered && !smart?.holding) ? (
          <ul className="chips" aria-label="Active filters">
            {chips.map((c) => (
              <li key={c.key} data-pilled={pilled.has(c.key.split(':')[0]!) || undefined}>
                <Chip kind="active" onRemove={() => onState(c.without, 'push')} removeLabel={`Remove filter ${c.label}`}>
                  {c.label}
                </Chip>
              </li>
            ))}
            {filtered ? (
              <li className="chips-clear">
                <button type="button" className="link-btn" onClick={() => onState(clearAll(state), 'push')}>
                  Clear all
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
        <div className="row-end">
          <ViewOptions d={d} state={state} onState={onState} />
        </div>
      </div>
    </div>
  );
}
