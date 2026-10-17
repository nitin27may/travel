'use client';

import { Dialog } from '@base-ui/react/dialog';
import { Icon } from '@/components/ui/Icon';
import type { FacetCount } from '@/lib/entities/filter';
import { clearAll } from '@/lib/entities/filter';
import type { EntityDescriptor, FacetDef, FacetParam, ListState } from '@/lib/entities/types';
import { FacetOptions } from './FacetMenu';
import { FacetLabel, ViewOptions } from './ViewOptions';

export interface PhoneFilterProps<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
  facets: FacetDef<Row>[];
  counts: Record<string, FacetCount[]>;
  shown: number;
  filtered: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setFacet: (param: FacetParam, values: string[]) => void;
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
}

/** Filters as a bottom sheet on phones. Loaded the first time it is opened. */
export default function PhoneFilterSheet<Row>({ d, state, facets, counts, shown, filtered, open, onOpenChange, setFacet, onState }: PhoneFilterProps<Row>) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="scrim" />
        <Dialog.Popup className="sheet sheet-bottom" aria-label="Filters">
          <header className="sheet-head">
            <Dialog.Title className="sheet-title">Filters</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="Close filters">
              <Icon name="close" size={18} />
            </Dialog.Close>
          </header>
          <div className="sheet-body">
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
            <ViewOptions d={d} state={state} onState={onState} />
          </div>
          <footer className="sheet-foot">
            <button type="button" className="btn" disabled={!filtered} onClick={() => onState(clearAll(state), 'push')}>
              Clear all
            </button>
            <Dialog.Close className="btn btn-primary">
              Show {shown} {shown === 1 ? d.noun.one : d.noun.many}
            </Dialog.Close>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
