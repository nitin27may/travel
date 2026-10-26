'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { isCurrent } from './SiteHeader';

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/trips/', label: 'Trips', icon: 'cards' },
  { href: '/places/', label: 'Places', icon: 'pin' },
  { href: '/globe/', label: 'Globe', icon: 'globe' },
];

/** Phone bottom bar (components 1.4): Trips, Places, Globe, Search and, when the layout passes `account` (sign-in on), Sign in / Account (AccountItems, a server component; `html[data-signed-in]` swaps the two; the sign-in and account pages mark it current with AccountCurrent); 56 px items, 11.5 px labels. Search opens the header search. Hidden at 640 px and wider. */
export function BottomBar({ account }: { account?: ReactNode }) {
  const path = usePathname() ?? '/';
  const [U, setU] = useState<ComponentType | null>(null);
  // Back-to-top (S28) loads on the first phone scroll; this listener is all it costs at start.
  useEffect(() => {
    const on = () => {
      if (!matchMedia('(max-width: 639px)').matches) return;
      removeEventListener('scroll', on);
      void import('./ToTop').then((m) => setU(() => m.ToTop));
    };
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);
  return (
    <>
    <nav className="bottom-bar" aria-label="Main, bottom">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isCurrent(path, i.href) ? 'page' : undefined}>
          <Icon name={i.icon} size={22} />
          {i.label}
        </Link>
      ))}
      <button type="button" aria-haspopup="dialog" onClick={() => document.querySelector<HTMLButtonElement>('.site-header [aria-keyshortcuts="/"]')?.click()}>
        <Icon name="search" size={22} />
        Search
      </button>
      {account}
    </nav>
    {U && <U />}
    </>
  );
}
