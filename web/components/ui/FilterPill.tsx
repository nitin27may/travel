'use client';

import { Popover } from '@base-ui/react/popover';
import { Fragment, useId, useState } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';

export interface PillOption {
  value: string;
  label: string;
  /** Live count of rows this option would show. */
  count?: number;
  /** Heading the option sits under; options with a group are listed group by group. */
  group?: string;
}

interface OptionsProps {
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
export function PillOptions({ label, options, selected, onChange, mode = 'multi', searchAbove = 8, groupLabel }: OptionsProps) {
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
                <span className="opt-label">{o.label}</span>
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

interface PillProps extends OptionsProps {
  className?: string;
}

/** "Kind · Trail, Lake +1": the label, then up to two chosen values and a count of the rest. */
export function pillSummary(label: string, options: PillOption[], selected: string[]): string {
  if (!selected.length) return label;
  const names = selected.map((v) => options.find((o) => o.value === v)?.label ?? v);
  return `${label} · ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`;
}

/** Filter pill with its menu (components 2.7). Active pills turn `--accent-soft` and carry an x that clears them. */
export function FilterPill({ className, ...opts }: PillProps) {
  const { label, options, selected, onChange } = opts;
  const active = selected.length > 0;
  return (
    <span className={cx('pill', className)} data-active={active || undefined}>
      <Popover.Root>
        <Popover.Trigger className="pill-trigger">
          <span className="pill-text">{pillSummary(label, options, selected)}</span>
          <Icon name="chevronDown" size={14} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="popover-pos">
            <Popover.Popup className="popover" aria-label={label}>
              <PillOptions {...opts} />
              {active ? (
                <div className="popover-foot">
                  <button type="button" className="link-btn" onClick={() => onChange([])}>
                    Clear
                  </button>
                </div>
              ) : null}
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
