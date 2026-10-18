'use client';

import { Fragment, useId, useState } from 'react';

// The menu body of a filter pill. It has no popover of its own, so a page can show the pill's button at once and load the
// popover library (@base-ui) only when a menu is wanted (JS budget, backlog 2.7).

export interface PillOption {
  value: string;
  label: string;
  /** Live count of rows this option would show. */
  count?: number;
  /** Heading the option sits under; options with a group are listed group by group. */
  group?: string;
  /** What the option means, shown under its label. */
  hint?: string;
}

export interface PillOptionsProps {
  label: string;
  options: PillOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  mode?: 'single' | 'multi';
  /** Shows a find field once there are more options than this (components 2.7: 8). */
  searchAbove?: number;
  groupLabel?: (group: string) => string;
}

/** Checkbox (multi) or radio (single) list with live counts and an in-list search. Used in the pill menu and the phone sheet. */
export function PillOptions({ label, options, selected, onChange, mode = 'multi', searchAbove = 8, groupLabel }: PillOptionsProps) {
  const name = useId();
  const [find, setFind] = useState('');
  const shown = find ? options.filter((o) => o.label.toLowerCase().includes(find.toLowerCase())) : options;
  const single = mode === 'single';
  const toggle = (value: string) => {
    if (single) onChange(selected[0] === value ? [] : [value]);
    else onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <fieldset className="facet-options">
      <legend className="sr-only">{label}</legend>
      {options.length > searchAbove ? (
        <input type="search" className="facet-find" placeholder={`Find ${label.toLowerCase()}`} aria-label={`Find in ${label}`} value={find} onChange={(e) => setFind(e.target.value)} />
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
        {shown.map((o, i) => (
          <Fragment key={o.value}>
            {o.group && o.group !== shown[i - 1]?.group ? (
              <li className="opt-group" aria-hidden="true">
                {groupLabel ? groupLabel(o.group) : o.group}
              </li>
            ) : null}
            <li>
              <label className="opt" data-empty={o.count === 0 || undefined}>
                <input
                  type={single ? 'radio' : 'checkbox'}
                  name={single ? name : undefined}
                  checked={selected.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  onClick={single ? () => selected[0] === o.value && toggle(o.value) : undefined}
                />
                <span className="opt-label">
                  {o.label}
                  {o.hint ? <span className="opt-hint">{o.hint}</span> : null}
                </span>
                {o.count !== undefined ? <span className="opt-count num">{o.count}</span> : null}
              </label>
            </li>
          </Fragment>
        ))}
        {!shown.length ? <li className="muted opt-none">Nothing matches &ldquo;{find}&rdquo;</li> : null}
      </ul>
    </fieldset>
  );
}

/** "Kind · Trail, Lake +1": the label, then up to two chosen values and a count of the rest. */
export function pillSummary(label: string, options: PillOption[], selected: string[]): string {
  if (!selected.length) return label;
  const names = selected.map((v) => options.find((o) => o.value === v)?.label ?? v);
  return `${label} · ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`;
}
