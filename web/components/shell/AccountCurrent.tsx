'use client';

import { useEffect } from 'react';

/**
 * Marks the phone bar's account links `aria-current` while the visitor is on the sign-in or account pages (ACCT-PH).
 * Only those two route layouts mount it, so the cost is in their chunks and not in the shell every page loads.
 */
export function AccountCurrent() {
  useEffect(() => {
    const links = document.querySelectorAll<HTMLElement>('.bottom-bar [data-acct]');
    links.forEach((a) => (a.ariaCurrent = 'page'));
    return () => links.forEach((a) => (a.ariaCurrent = null));
  }, []);
  return null;
}
