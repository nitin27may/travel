'use client';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SearchInput } from '@/components/ui/Input';
import { clearAll } from '@/lib/entities/filter';
import type { FacetCount } from '@/lib/entities/filter';
import type { EntityDescriptor, FacetDef, FacetParam, ListState } from '@/lib/entities/types';
import { FacetBodyControl, chosenText } from './FacetMenu';
import { WhereBody } from './WhereMenu';
import { selectionOf, whereSummary, withWhere } from './whereModel';
import type { WhereParam } from './whereModel';
import { FacetLabel, ViewOptions } from './ViewOptions';

export interface PhoneFilterProps<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
  /** The primary facets, open in the list. */
  facets: FacetDef<Row>[];
  /** The facets under "More filters": one collapsed group below the primary ones. */
  more?: FacetDef<Row>[];
  counts: Record<string, FacetCount[]>;
  gaps?: Record<string, number>;
  shown: number | null;
  filtered: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setFacet: (param: FacetParam, values: string[]) => void;
  /** Value to name, for the Where group's summary and rows. */
  labelOf: (param: WhereParam, value: string) => string;
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
}

/** One facet's options with a Done button: it folds the group so the next facet is a tap away (backlog 2.41; the target is 44 px). */
function FacetBody<Row>({ facet, counts, gapN, selected, setFacet }: { facet: FacetDef<Row>; counts: FacetCount[]; gapN?: number; selected: string[]; setFacet: (param: FacetParam, values: string[]) => void }) {
  return (
    <>
      <FacetBodyControl facet={facet} options={counts} selected={selected} onChange={(v) => setFacet(facet.param, v)} gapN={gapN} />
      <div className="sheet-facet-done">
        <button
          type="button"
          className="btn sheet-done"
          onClick={(e) => {
            const details = e.currentTarget.closest('details');
            if (!details) return;
            details.open = false;
            details.querySelector('summary')?.focus();
          }}
        >
          Done
        </button>
      </div>
    </>
  );
}

/** Filters as a full-height bottom sheet on phones (components 2.7); "Show N" is the Apply. Loaded the first time it is opened. */
export default function PhoneFilterSheet<Row>({ d, state, facets, more = [], counts, gaps = {}, shown, filtered, open, onOpenChange, setFacet, labelOf, onState }: PhoneFilterProps<Row>) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filters"
      snaps={['full']}
      initial="full"
      footer={
        <>
          <Button disabled={!filtered} onClick={() => onState(clearAll(state), 'push')}>
            Clear all
          </Button>
          <Button variant="primary" className="sheet-apply" onClick={() => onOpenChange(false)}>
            {shown === null ? 'Counting\u2026' : `Show ${shown} ${shown === 1 ? d.noun.one : d.noun.many}`}
          </Button>
        </>
      }
    >
      <SearchInput value={state.q} onChange={(q) => onState({ ...state, q, focus: null }, 'replace')} label={`Filter ${d.noun.many} by name`} placeholder={`Search ${d.noun.many}`} className="sheet-search" />
      {facets.map((f) =>
        f.control === 'where' ? (
          <details key={f.param} className="sheet-facet where-sheet" open={(state.facets.country?.length ?? 0) > 0 || undefined}>
            <summary>
              <span className="summary-label">
                <FacetLabel label={f.label} n={selectionOf(state.facets).country.length ? 1 : 0} value={whereSummary('', selectionOf(state.facets), labelOf).replace(/^\s*\u00b7\s*/, '') || undefined} />
              </span>
              <Icon name="chevronDown" size={16} />
            </summary>
            <WhereBody mode="drill" state={state} counts={counts} loading={shown === null} shown={shown} labelOf={labelOf} onPick={(facets) => onState(withWhere(state, facets), 'push')} onSearch={(q) => onState({ ...state, q, focus: null }, 'replace')} onDone={() => undefined} hideFoot />
          </details>
        ) : (
        <details key={f.param} className="sheet-facet" open={(state.facets[f.param]?.length ?? 0) > 0 || undefined}>
          <summary>
            <span className="summary-label">
              <FacetLabel label={f.label} n={(state.facets[f.param] ?? []).length} value={chosenText(f, counts[f.param] ?? [], state.facets[f.param] ?? [])} />
            </span>
            <Icon name="chevronDown" size={16} />
          </summary>
          <FacetBody facet={f} counts={counts[f.param] ?? []} gapN={gaps[f.param]} selected={state.facets[f.param] ?? []} setFacet={setFacet} />
        </details>
        ),
      )}
      {more.length ? (
        <details className="sheet-more" open={more.some((f) => (state.facets[f.param]?.length ?? 0) > 0) || undefined}>
          <summary>
            <span className="summary-label">
              <FacetLabel label="More filters" n={more.reduce((n, f) => n + (state.facets[f.param]?.length ?? 0), 0)} />
            </span>
            <Icon name="chevronDown" size={16} />
          </summary>
          {more.map((f) => (
            <details key={f.param} className="sheet-facet" open={(state.facets[f.param]?.length ?? 0) > 0 || undefined}>
              <summary>
                <span className="summary-label">
                  <FacetLabel label={f.label} n={(state.facets[f.param] ?? []).length} value={chosenText(f, counts[f.param] ?? [], state.facets[f.param] ?? [])} />
                </span>
                <Icon name="chevronDown" size={16} />
              </summary>
              <FacetBody facet={f} counts={counts[f.param] ?? []} gapN={gaps[f.param]} selected={state.facets[f.param] ?? []} setFacet={setFacet} />
            </details>
          ))}
        </details>
      ) : null}
      <ViewOptions d={d} state={state} onState={onState} />
    </BottomSheet>
  );
}
