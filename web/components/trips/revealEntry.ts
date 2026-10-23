// A pin click, a number on the map's list of unplaced stops, or a dot in All days leads to a row of the day list (map note 7.2).
// The row scrolls to the focus line, takes a fill for 1.5 s and its title takes focus. It is NOT expanded: expanding pushes every later row
// down under the reader's eye (note section 14, change 3).

const flashMs = 1500;

/** `key` is "<day>:<entry id>", the value of the row's data-entry. */
export function revealEntry(key: string): void {
  const li = document.querySelector<HTMLElement>(`[data-entry="${CSS.escape(key)}"]`);
  if (!li) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-flash]').forEach((e) => e.removeAttribute('data-flash'));
  li.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  li.setAttribute('data-flash', '');
  if (reduced) {
    // no fade: the fill stays until the reader does something else
    const clear = () => { li.removeAttribute('data-flash'); };
    window.addEventListener('pointerdown', clear, { once: true });
    window.addEventListener('keydown', clear, { once: true });
  } else {
    window.setTimeout(() => li.removeAttribute('data-flash'), flashMs);
  }
  const title = li.querySelector<HTMLElement>('.tl-title a') ?? li.querySelector<HTMLElement>('.tl-title');
  if (title) {
    if (title.tagName !== 'A') title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}
