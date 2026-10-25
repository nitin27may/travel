'use client';

import { useEffect, useRef, useState } from 'react';
import { keyboardUp, toTopVisible } from '@/lib/to-top';

// Blocked while any of these is rendered and visible (a mounted but hidden or inline listbox does not count), a toast is showing,
// or the non-modal trip map sheet is open (`.tl-mapcol[data-sheet]`; a later fixed bottom panel adds its own attribute here).
const OVERLAY = '[role="dialog"],[role="menu"],[role="listbox"],[aria-modal="true"],.toast-region .toast,.tl-mapcol[data-sheet]';
const SHEET_ATTRS = ['data-sheet', 'aria-modal', 'open', 'hidden'];

function overlayOpen(): boolean {
  for (const el of document.querySelectorAll<HTMLElement>(OVERLAY)) {
    if (typeof el.checkVisibility === 'function' ? el.checkVisibility({ visibilityProperty: true }) : el.offsetParent !== null || getComputedStyle(el).position === 'fixed') return true;
  }
  return false;
}

/** Phone back-to-top button (S28). Client-only and lazy: the server renders nothing; BottomBar loads this on the first phone scroll. */
export function ToTop() {
  const [show, setShow] = useState(false);
  const was = useRef(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const a = document.activeElement as HTMLElement | null;
      const blocked = keyboardUp(a) || overlayOpen();
      was.current = toTopVisible(was.current, scrollY, innerHeight);
      setShow(was.current && !blocked);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const mo = new MutationObserver(queue);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: SHEET_ATTRS });
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    document.addEventListener('focusin', queue);
    document.addEventListener('focusout', queue);
    visualViewport?.addEventListener('resize', queue);
    queue();
    return () => {
      mo.disconnect();
      removeEventListener('scroll', queue);
      removeEventListener('resize', queue);
      document.removeEventListener('focusin', queue);
      document.removeEventListener('focusout', queue);
      visualViewport?.removeEventListener('resize', queue);
      cancelAnimationFrame(raf);
    };
  }, []);

  const go = () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    const main = document.getElementById('main');
    if (main) {
      if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
      main.focus({ preventScroll: true });
    }
  };

  return (
    <button type="button" className="to-top" data-show={show ? '' : undefined} aria-label="Back to top" onClick={go}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M6 11l6-6 6 6" />
      </svg>
    </button>
  );
}
