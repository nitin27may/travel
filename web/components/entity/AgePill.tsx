'use client';

import { Popover } from '@base-ui/react/popover';
import { Icon } from '@/components/ui/Icon';
import { AgeControl } from './AgeControl';

const isAge = (v: string | undefined): v is string => v !== undefined && /^\d{1,2}$/.test(v);

interface ControlProps {
  selected: string[];
  onChange: (values: string[]) => void;
}

interface PillProps extends ControlProps {
  label: string;
  /** Text for the pill when an old kid-fit value is selected. */
  legacyLabel?: (value: string) => string;
}

export function AgePill({ label, selected, onChange, legacyLabel }: PillProps) {
  const active = selected.length > 0;
  const text = !active ? label : isAge(selected[0]) ? `${label} · ${selected[0] === '0' ? 'Baby' : selected[0]}` : `${label} · ${legacyLabel?.(selected[0]!) ?? selected[0]}`;
  return (
    <span className="pill" data-active={active || undefined}>
      <Popover.Root>
        <Popover.Trigger className="pill-trigger">
          <span className="pill-text">{text}</span>
          <Icon name="chevronDown" size={14} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="popover-pos">
            <Popover.Popup className="popover" aria-label={label}>
              <AgeControl selected={selected} onChange={onChange} />
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
