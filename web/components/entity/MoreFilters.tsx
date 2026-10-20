'use client';

import { Popover } from '@base-ui/react/popover';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { FacetCount } from '@/lib/entities/filter';
import type { FacetDef, FacetParam, ListState } from '@/lib/entities/types';
import { FacetBodyControl, chosenText } from './FacetMenu';
import { FacetLabel } from './ViewOptions';

export interface MoreFiltersProps<Row> {
  /** The facets under "More filters" that can show now. */
  facets: FacetDef<Row>[];
  /** The ones whose parent has no value yet (region needs a country), named in a hint so they are findable. */
  waiting: { facet: FacetDef<Row>; parent: string }[];
  counts: Record<string, FacetCount[]>;
  gaps?: Record<string, number>;
  state: ListState;
  setFacet: (param: FacetParam, values: string[]) => void;
}

/** "More filters": the secondary facets in one menu (principle P4). The button shows how many values are on inside. */
export function MoreFilters<Row>({ facets, waiting, counts, gaps = {}, state, setFacet }: MoreFiltersProps<Row>) {
  const [open, setOpen] = useState(false);
  const active = facets.reduce((n, f) => n + (state.facets[f.param]?.length ?? 0), 0);
  // "Region appears once you choose a country; Area once you choose a region"
  const hint = waiting.length ? `${waiting.map((w, i) => `${w.facet.label}${i === 0 ? ' appears' : ''} once you choose a ${w.parent.toLowerCase()}`).join('; ')}.` : null;
  return (
    <span className="pill more-filters-pill" data-active={active > 0 || undefined}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className="pill-trigger">
          <span className="pill-text">{active ? `More filters · ${active}` : 'More filters'}</span>
          <Icon name="chevronDown" size={14} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="popover-pos">
            <Popover.Popup className="popover popover-wide more-filters" aria-label="More filters">
              {facets.map((f) => (
                <details key={f.param} className="sheet-facet" open={(state.facets[f.param]?.length ?? 0) > 0 || undefined}>
                  <summary>
                    <span className="summary-label">
                      <FacetLabel label={f.label} n={(state.facets[f.param] ?? []).length} value={chosenText(f, counts[f.param] ?? [], state.facets[f.param] ?? [])} />
                    </span>
                    <Icon name="chevronDown" size={16} />
                  </summary>
                  <FacetBodyControl facet={f} options={counts[f.param] ?? []} selected={state.facets[f.param] ?? []} onChange={(v) => setFacet(f.param, v)} gapN={gaps[f.param]} />
                </details>
              ))}
              {hint ? <p className="muted more-filters-hint">{hint}</p> : null}
              <div className="popover-foot">
                <span />
                <button type="button" className="btn pill-done" onClick={() => setOpen(false)}>
                  Done
                </button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}
