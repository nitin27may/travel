'use client';

import { Menu } from '@base-ui/react/menu';
import type { Crumb } from './Breadcrumbs';

/** The phone "..." menu of earlier crumbs. Loaded after hydration by CrumbMore (backlog 2.27: base-ui stays out of the start bundle). */
export function CrumbMoreMenu({ hidden }: { hidden: Crumb[] }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="crumb-more-btn" aria-label="Earlier levels">
        &hellip;
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="popover-pos">
          <Menu.Popup className="menu">
            {hidden.map((c) => (
              <Menu.LinkItem key={c.label} className="menu-item" href={c.href ?? '#'}>
                {c.label}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
