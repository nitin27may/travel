'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { isCurrent } from './SiteHeader';

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/trips/', label: 'Trips', icon: 'cards' },
  { href: '/places/', label: 'Places', icon: 'pin' },
  { href: '/globe/', label: 'Globe', icon: 'globe' },
  { href: '/sign-in/', label: 'Sign in', icon: 'signin' },
];

/** Phone bottom bar (components 1.4): Trips, Places, Globe, Sign in; 56 px items, 11.5 px labels. Hidden at 640 px and wider. */
export function BottomBar() {
  const path = usePathname() ?? '/';
  return (
    <nav className="bottom-bar" aria-label="Main, bottom">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isCurrent(path, i.href) ? 'page' : undefined}>
          <Icon name={i.icon} size={22} />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
