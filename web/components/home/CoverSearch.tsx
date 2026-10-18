'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { GlobalSearch as GlobalSearchType } from '@/components/search/GlobalSearch';
import { Icon } from '@/components/ui/Icon';

// the same lazy chunk the header uses; it loads the first time the field is used
const GlobalSearch = dynamic(() => import('@/components/search/GlobalSearch').then((m) => m.GlobalSearch), { ssr: false }) as typeof GlobalSearchType;

/**
 * The cover's search field. It looks like the 42 px field of components 2.10 and opens the global search.
 * It owns "/" on this page (aria-keyshortcuts tells the header to leave the key alone).
 */
export function CoverSearch() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <button type="button" className="search home-search" aria-keyshortcuts="/" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon name="search" size={16} />
        <span className="home-search-text">Search trips, places and countries</span>
        <kbd className="kbd" aria-hidden="true">/</kbd>
      </button>
      {open ? <GlobalSearch open={open} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
