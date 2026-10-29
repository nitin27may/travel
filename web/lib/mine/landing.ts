// Where a person lands on a trip page after a copy or an add (STEP2-PRV PR-008; P5: context kept). Client only. The trip page's address is its
// state (patterns 1.2): `?view=day#day-N` shows the Days tab with the day in view, and the page reads the address again on this event
// (components/trips/useTripUrl.ts), so a day is shown by writing the address, with no new reach into the page.
const URL_EVENT = 'travel:trip-url';

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Shows Day `n`: the Days tab, scrolled to that day (the page's own anchor handling does the scroll). */
export function showDay(n: number): void {
  const u = new URL(window.location.href);
  u.searchParams.set('view', 'day');
  u.hash = `day-${n}`;
  const next = `${u.pathname}${u.search}${u.hash}`;
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  window.history.pushState(null, '', next);
  window.dispatchEvent(new Event(URL_EVENT));
}

/**
 * After a copy opens its page: the tab bar at its sticky line, so the Days under it are what the person sees, not the cover alone. The page
 * loads the copy's document after it paints, so this waits for the first day to exist (about 4 s at most) and gives up the moment the
 * person scrolls, taps or types, so it never fights them.
 */
export function landOnDays(): () => void {
  let live = true;
  let tries = 0;
  const stop = () => {
    live = false;
    for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.removeEventListener(e, stop);
  };
  for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.addEventListener(e, stop, { passive: true, once: true });
  const step = () => {
    if (!live) return;
    const bar = document.querySelector<HTMLElement>('.trip-tabbar');
    const day = document.querySelector('.tl-day');
    if (bar && day && bar.getBoundingClientRect().height > 0) {
      const head = document.querySelector<HTMLElement>('.site-header');
      const line = head ? Math.max(0, head.getBoundingClientRect().bottom) : 0;
      const by = bar.getBoundingClientRect().top - line;
      if (by > 1) window.scrollBy({ top: by, behavior: reducedMotion() ? 'auto' : 'smooth' });
      stop();
      return;
    }
    if (++tries < 40) window.setTimeout(step, 100);
    else stop();
  };
  step();
  return stop;
}
