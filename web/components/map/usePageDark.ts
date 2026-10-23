'use client';

import { useEffect, useState } from 'react';
import { pageIsDark } from '@/lib/map/palette';

/** True while the page theme is dark; follows the theme control and the system setting. */
export function usePageDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(pageIsDark());
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', read);
    return () => { mo.disconnect(); mq.removeEventListener('change', read); };
  }, []);
  return dark;
}
