'use client';

import { useEffect } from 'react';

/**
 * The only script of the suitability and section blocks. Esc closes an open provenance row and returns focus to it; a link to a
 * row that sits inside a collapsed group (a glance slot, a warning line) opens the groups around it first. Everything else is
 * native <details> and :target, so the blocks add no payload (P8).
 */
export function Interactions() {
  useEffect(() => {
    const openAround = (): void => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      let changed = false;
      for (let n: Element | null = el; n; n = n.parentElement) {
        if (n instanceof HTMLDetailsElement && !n.open) {
          n.open = true;
          changed = true;
        }
      }
      if (changed) el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const open = document.querySelector<HTMLDetailsElement>('details.su-prov[open]');
      if (!open) return;
      open.open = false;
      open.querySelector<HTMLElement>('summary')?.focus();
    };
    openAround();
    window.addEventListener('hashchange', openAround);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('hashchange', openAround);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return null;
}
