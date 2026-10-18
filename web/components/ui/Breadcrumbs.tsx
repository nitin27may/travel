import Link from 'next/link';
import { Menu } from '@base-ui/react/menu';
import { Icon } from './Icon';
import { cx } from './cx';

export interface Crumb {
  label: string;
  href?: string;
}

/** Mono 12.5 trail, " › " separators, current item in ink. On phones only the last two show, behind a "…" menu (components 1.5). */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const hidden = items.slice(0, Math.max(0, items.length - 2));
  return (
    <nav aria-label="Breadcrumb" className={cx('crumbs', className)}>
      <ol>
        {hidden.length ? (
          <li className="crumb-more">
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
            <span className="crumb-sep" aria-hidden="true">
              <Icon name="chevronRight" size={12} />
            </span>
          </li>
        ) : null}
        {items.map((c, i) => {
          const last = i === items.length - 1;
          const early = i < items.length - 2;
          return (
            <li key={`${c.label}-${i}`} className={cx(early && 'crumb-early')}>
              {last || !c.href ? (
                <span aria-current={last ? 'page' : undefined} className="crumb-current">
                  {c.label}
                </span>
              ) : (
                <Link href={c.href}>{c.label}</Link>
              )}
              {!last ? (
                <span className="crumb-sep" aria-hidden="true">
                  <Icon name="chevronRight" size={12} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
