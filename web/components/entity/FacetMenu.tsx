'use client';

import { Popover } from '@base-ui/react/popover';
import { useId, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { FacetCount } from '@/lib/entities/filter';
import type { FacetDef } from '@/lib/entities/types';

interface OptionsProps<Row> {
  facet: FacetDef<Row>;
  options: FacetCount[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** Show an in-list filter once there are more options than this. */
  searchAbove?: number;
}

/** Checkbox list (multi) or radio list (single) with live counts. Used in popovers and the phone sheet. */
export function FacetOptions<Row>({ facet, options, selected, onChange, searchAbove = 12 }: OptionsProps<Row>) {
  const name = useId();
  const [find, setFind] = useState('');
  const shown = find ? options.filter((o) => o.label.toLowerCase().includes(find.toLowerCase())) : options;
  const single = facet.type === 'single';
  const toggle = (value: string) => {
    if (single) onChange(selected[0] === value ? [] : [value]);
    else onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <fieldset className="facet-options">
      <legend className="sr-only">{facet.label}</legend>
      {options.length > searchAbove ? (
        <input type="search" className="facet-find" placeholder={`Find ${facet.label.toLowerCase()}`} aria-label={`Find in ${facet.label}`} value={find} onChange={(e) => setFind(e.target.value)} />
      ) : null}
      <ul>
        {single ? (
          <li>
            <label className="opt">
              <input type="radio" name={name} checked={selected.length === 0} onChange={() => onChange([])} />
              <span className="opt-label">Any</span>
            </label>
          </li>
        ) : null}
        {shown.map((o) => (
          <li key={o.value}>
            <label className="opt" data-empty={o.count === 0 || undefined}>
              <input
                type={single ? 'radio' : 'checkbox'}
                name={single ? name : undefined}
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                onClick={single ? () => selected[0] === o.value && toggle(o.value) : undefined}
              />
              <span className="opt-label">{o.label}</span>
              <span className="opt-count num">{o.count}</span>
            </label>
          </li>
        ))}
        {!shown.length ? <li className="muted opt-none">Nothing matches &ldquo;{find}&rdquo;</li> : null}
      </ul>
    </fieldset>
  );
}

interface PopoverProps<Row> extends OptionsProps<Row> {
  summary: string;
}

/** A facet as a filter-bar button that opens its options. */
export function FacetPopover<Row>({ summary, ...rest }: PopoverProps<Row>) {
  const active = rest.selected.length > 0;
  return (
    <Popover.Root>
      <Popover.Trigger className="facet-btn" data-active={active || undefined}>
        <span>{summary}</span>
        <Icon name="chevronDown" size={14} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="popover-pos">
          <Popover.Popup className="popover" aria-label={rest.facet.label}>
            <FacetOptions {...rest} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
