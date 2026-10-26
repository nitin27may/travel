'use client';

import { Popover } from '@base-ui/react/popover';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { PillOptions, pillSummary } from '@/components/ui/PillOptions';
import type { PillOption } from '@/components/ui/PillOptions';

export interface FacetPillProps {
  label: string;
  options: PillOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  mode?: 'single' | 'multi';
  groupLabel?: (group: string) => string;
  /** Rows with no answer for this facet that match every other filter: the menu says how many are hidden once a value is picked. */
  gapN?: number;
}

/**
 * A filter pill whose menu closes on Done (backlog 2.41), as the phone sheet's groups do: Done keeps the choice and returns focus to the
 * pill. A facet with a "not known" state says so in a muted last row, so a hidden group is never a silent loss.
 */
export function FacetPill({ label, options, selected, onChange, mode, groupLabel, gapN = 0 }: FacetPillProps) {
  const [open, setOpen] = useState(false);
  const active = selected.length > 0;
  return (
    <span className="pill" data-active={active || undefined}>
      <Popover.Root open={open} onOpenChange={setOpen} modal="trap-focus">
        <Popover.Trigger className="pill-trigger">
          <span className="pill-text">{pillSummary(label, options, selected)}</span>
          <Icon name="chevronDown" size={14} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="popover-pos">
            <Popover.Popup className="popover" aria-label={label}>
              {/* phone only (CSS): which facet this is and how many are on, beside the options that scroll under it */}
              <div className="popover-head" aria-hidden="true">
                <span className="popover-head-title">{label}</span>
                <span className="popover-head-n num">{active ? `${selected.length} selected` : 'None selected'}</span>
              </div>
              <PillOptions label={label} options={options} selected={selected} onChange={onChange} mode={mode} groupLabel={groupLabel} />
              {gapN > 0 ? <p className="opt-gap muted">{gapN} not known yet &middot; hidden when you pick one</p> : null}
              <div className="popover-foot">
                {active ? (
                  <button type="button" className="link-btn" onClick={() => onChange([])}>
                    Clear
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" className="btn pill-done" onClick={() => setOpen(false)}>
                  Done
                </button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {active ? (
        <button type="button" className="pill-x" aria-label={`Clear ${label} filter`} onClick={() => onChange([])}>
          <Icon name="close" size={13} />
        </button>
      ) : null}
    </span>
  );
}
