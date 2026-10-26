'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import { isCurrent } from './SiteHeader';

const ITEMS = [
  { href: '/trips/', label: 'Trips', icon: 'cards' },
  { href: '/places/', label: 'Places', icon: 'pin' },
  { href: '/globe/', label: 'Globe', icon: 'globe' },
] as const;

/** Mine is the current item on its own page ("page") and in the account flow it holds ("true": same look, not the page itself). */
export function mineCurrent(path: string): 'page' | 'true' | undefined {
  if (path.startsWith('/mine/')) return 'page';
  return /^\/(account|sign-in|sign-up)\//.test(path) ? 'true' : undefined;
}

/**
 * Phone bottom bar (components 1.4): Trips, Places, Globe, Search, Mine; 56 px items, 11.5 px labels, icons drawn by CSS masks so the
 * markup stays small (app.css `.mi`). Mine's label never changes with the session: sign-in lives in the header icon and the Mine page.
 * The Mine dot (spec 3.2) is set on this item by `MineLink`, the header's lazy Mine module, so the bar itself carries no storage code. Hidden at 640 px and wider.
 */
export function BottomBar() {
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
          <i className={`mi mi-${i.icon}`} />
          {i.label}
        </Link>
      ))}
      <button type="button" aria-haspopup="dialog" onClick={() => document.querySelector<HTMLButtonElement>('.site-header [aria-keyshortcuts="/"]')?.click()}>
        <i className="mi mi-search" />
        Search
      </button>
      <Link href="/mine/" aria-current={mineCurrent(path)}>
        <i className="mi mi-layers" />
        Mine
      </Link>
    </nav>
    {U && <U />}
    </>
  );
}
