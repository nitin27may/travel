'use client';

import { useEffect } from 'react';
import { convertNumber, unitWord } from '@/lib/format/convert';
import { PREFS_KEY, parsePrefs } from '@/lib/format/units';

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
      // close the row that holds focus, else the first open one, and return focus to its summary
      const active = document.activeElement instanceof Element ? document.activeElement.closest<HTMLDetailsElement>('details.su-prov[open]') : null;
      const open = active ?? document.querySelector<HTMLDetailsElement>('details.su-prov[open]');
      if (!open) return;
      open.open = false;
      open.querySelector<HTMLElement>('summary')?.focus();
    };
    // distances and heights follow the visitor's units (km or mi, m or ft)
    const applyUnits = (): void => {
      const prefs = parsePrefs(window.localStorage.getItem(PREFS_KEY), navigator.language);
      for (const el of document.querySelectorAll<HTMLElement>('data.ukm, data.um')) {
        const u = el.classList.contains('ukm') ? 'km' : 'm';
        el.textContent = `${(el.getAttribute('value') ?? '').split('–').map((v) => convertNumber(v, u, prefs)).join('–')} ${unitWord(u, prefs)}`;
      }
    };
    applyUnits();
    window.addEventListener('travel:prefs', applyUnits);
    window.addEventListener('storage', applyUnits);
    openAround();
    window.addEventListener('hashchange', openAround);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('hashchange', openAround);
      window.removeEventListener('travel:prefs', applyUnits);
      window.removeEventListener('storage', applyUnits);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return null;
}
