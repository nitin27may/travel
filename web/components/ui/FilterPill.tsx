'use client';

import { Popover } from '@base-ui/react/popover';
import { Icon } from './Icon';
import { PillOptions, pillSummary } from './PillOptions';
import type { PillOption, PillOptionsProps } from './PillOptions';
import { cx } from './cx';

export { PillOptions, pillSummary };
export type { PillOption };

interface PillProps extends PillOptionsProps {
  className?: string;
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
