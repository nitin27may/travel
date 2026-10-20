'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { GlobalSearch as GlobalSearchType } from '@/components/search/GlobalSearch';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { startBuffer } from '@/lib/search/typeahead';
import { ThemeToggle } from './ThemeToggle';

// the search dialog (and its dialog code) loads the first time it opens
const GlobalSearch = dynamic(() => import('@/components/search/GlobalSearch').then((m) => m.GlobalSearch), { ssr: false }) as typeof GlobalSearchType;

export const PUBLIC_TABS = [
  { href: '/trips/', label: 'Trips' },
  { href: '/places/', label: 'Places' },
  { href: '/globe/', label: 'Globe' },
] as const;

/** `/trips/` is current on `/trips/` and on every `/trips/<slug>/`. */
export const isCurrent = (path: string, href: string) => path === href || path.startsWith(href);

/**
 * Public header (components 1.1): brand, three tabs, search, theme toggle, Sign in. 60 px navy with the 2 px amber rule;
 * 56 px on phone, where the tabs move to the bottom bar. Search opens with the icon or with "/" on pages that have no list search.
 */
export function SiteHeader() {
  const path = usePathname() ?? '/';
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // list pages own "/" for their in-page search
      if (document.querySelector('main [aria-keyshortcuts="/"]')) return;
      e.preventDefault();
      startBuffer();
      setSearchOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/">
          Trip Plans
        </Link>
        <nav className="site-nav" aria-label="Main">
          {PUBLIC_TABS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={isCurrent(path, t.href) ? 'page' : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="header-tools">
          <Button variant="ghost" icon aria-label="Search" aria-keyshortcuts="/" onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={18} />
          </Button>
          <ThemeToggle />
          <ButtonLink variant="ghost" href="/sign-in/" className="header-signin">
            Sign in
          </ButtonLink>
        </div>
      </div>
      {searchOpen ? <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} /> : null}
    </header>
  );
}
