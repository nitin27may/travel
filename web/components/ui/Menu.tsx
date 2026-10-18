'use client';

import { Menu as BaseMenu } from '@base-ui/react/menu';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { cx } from './cx';

export interface MenuEntry {
  label: string;
  icon?: IconName;
  /** Mono hint on the right, e.g. a key. */
  shortcut?: string;
  onSelect?: () => void;
  href?: string;
  disabled?: boolean;
  /** Destructive entries are `--crit` and belong last, after a divider. */
  destructive?: boolean;
  /** Draw a divider above this entry. */
  separatorBefore?: boolean;
}

interface Props {
  trigger: ReactNode;
  triggerClassName?: string;
  /** Accessible name for the trigger when it is an icon. */
  triggerLabel?: string;
  entries: MenuEntry[];
  align?: 'start' | 'center' | 'end';
}

/** `role="menu"`: arrows, Home/End, type-ahead and Esc come from the primitive; 40 px items, 48 on phone (components 5.2). */
export function Menu({ trigger, triggerClassName, triggerLabel, entries, align = 'start' }: Props) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger className={triggerClassName} aria-label={triggerLabel}>
        {trigger}
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={8} align={align} className="popover-pos">
          <BaseMenu.Popup className="menu">
            {entries.map((e) => (
              <Fragment key={e.label}>
                {e.separatorBefore ? <BaseMenu.Separator className="menu-sep" /> : null}
                {e.href ? (
                  <BaseMenu.LinkItem className={cx('menu-item', e.destructive && 'menu-crit')} href={e.href}>
                    {e.icon ? <Icon name={e.icon} size={16} /> : null}
                    {e.label}
                    {e.shortcut ? <span className="menu-key">{e.shortcut}</span> : null}
                  </BaseMenu.LinkItem>
                ) : (
                  <BaseMenu.Item className={cx('menu-item', e.destructive && 'menu-crit')} disabled={e.disabled} onClick={e.onSelect}>
                    {e.icon ? <Icon name={e.icon} size={16} /> : null}
                    {e.label}
                    {e.shortcut ? <span className="menu-key">{e.shortcut}</span> : null}
                  </BaseMenu.Item>
                )}
              </Fragment>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
