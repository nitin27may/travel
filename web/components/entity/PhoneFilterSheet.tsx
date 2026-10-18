'use client';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { clearAll } from '@/lib/entities/filter';
import type { FacetCount } from '@/lib/entities/filter';
import type { EntityDescriptor, FacetDef, FacetParam, ListState } from '@/lib/entities/types';
import { FacetOptions } from './FacetMenu';
import { FacetLabel, ViewOptions } from './ViewOptions';

export interface PhoneFilterProps<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
  /** The primary facets, open in the list. */
  facets: FacetDef<Row>[];
  /** The facets under "More filters": one collapsed group below the primary ones. */
  more?: FacetDef<Row>[];
  counts: Record<string, FacetCount[]>;
  shown: number;
  filtered: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setFacet: (param: FacetParam, values: string[]) => void;
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
}

/** Filters as a full-height bottom sheet on phones (components 2.7); "Show N" is the Apply. Loaded the first time it is opened. */
export default function PhoneFilterSheet<Row>({ d, state, facets, more = [], counts, shown, filtered, open, onOpenChange, setFacet, onState }: PhoneFilterProps<Row>) {
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
            Show {shown} {shown === 1 ? d.noun.one : d.noun.many}
          </Button>
        </>
      }
    >
      {facets.map((f) => (
        <details key={f.param} className="sheet-facet" open={(state.facets[f.param]?.length ?? 0) > 0 || undefined}>
          <summary>
            <span className="summary-label">
              <FacetLabel label={f.label} n={(state.facets[f.param] ?? []).length} />
            </span>
            <Icon name="chevronDown" size={16} />
          </summary>
          <FacetOptions facet={f} options={counts[f.param] ?? []} selected={state.facets[f.param] ?? []} onChange={(v) => setFacet(f.param, v)} />
        </details>
      ))}
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
                  <FacetLabel label={f.label} n={(state.facets[f.param] ?? []).length} />
                </span>
                <Icon name="chevronDown" size={16} />
              </summary>
              <FacetOptions facet={f} options={counts[f.param] ?? []} selected={state.facets[f.param] ?? []} onChange={(v) => setFacet(f.param, v)} />
            </details>
          ))}
        </details>
      ) : null}
      <ViewOptions d={d} state={state} onState={onState} />
    </BottomSheet>
  );
}
