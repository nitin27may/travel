import { FAVOURITES_ON } from './flag';
import { HEART_PATH } from './glyph';
import { heartedHandles, watchHearts } from './light';
import './heart.css';

/**
 * Card badges (mine-and-bar-spec 6, D9): after first paint a favourited card gains a small filled heart at its photo's top right and its
 * link's name gains ", in your favourites". Cards carry no heart markup of their own (0 B of HTML), and the badge is a mark, never a
 * toggle and never a count (48 more toggles on a page would be 48 more tab stops). The handle comes from the card's own link, which is
 * `/places/<slug>/` or `/trips/<slug>/` on the home strips, Places and Trips. One observer for the page's life: the list pages redraw their
 * cards when a filter changes, and the badges follow. Imported by the pages' existing client islands after they mount.
 */
const LINK = /^\/(places|trips)\/([^/?#]+)\/?$/;
const NOTE = 'data-fav-note';
const SVG = 'http://www.w3.org/2000/svg';

let started = false;

/** `place:<slug>` or `trip:<slug>` for a card link's path (`/places/<slug>/`, `/trips/<slug>/`); null for anything else (a `?focus=` link, a country). */
export function handleOfPath(path: string): string | null {
  const m = LINK.exec(path);
  if (!m) return null;
  try {
    return `${m[1] === 'trips' ? 'trip' : 'place'}:${decodeURIComponent(m[2]!)}`;
  } catch {
    return null;
  }
}

function handleOfCard(card: Element): string | null {
  const a = card.querySelector<HTMLAnchorElement>('a.card-open');
  return a ? handleOfPath(new URL(a.href, location.href).pathname) : null;
}

function badge(): HTMLElement {
  const el = document.createElement('span');
  el.className = 'fav-badge';
  el.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', HEART_PATH);
  svg.append(path);
  el.append(svg);
  return el;
}

/** Brings every card on the page in line with the device's list. Idempotent. */
export function applyBadges(): void {
  const set = heartedHandles();
  if (set.size === 0 && !document.querySelector('.fav-badge')) return;
  for (const card of document.querySelectorAll('.card')) {
    const h = handleOfCard(card);
    const has = card.querySelector('.fav-badge') !== null;
    const want = h !== null && set.has(h);
    if (want === has) continue;
    const link = card.querySelector('a.card-open');
    if (want) {
      card.querySelector('.card-media')?.append(badge());
      if (link) {
        const note = document.createElement('span');
        note.className = 'sr-only';
        note.setAttribute(NOTE, '');
        note.textContent = ', in your favourites';
        link.append(note);
      }
    } else {
      card.querySelector('.fav-badge')?.remove();
      card.querySelector(`[${NOTE}]`)?.remove();
    }
  }
}

const ours = (n: Node): boolean => !(n instanceof Element) || n.classList.contains('fav-badge') || n.hasAttribute(NOTE);

/** Starts the one observer (a second call does nothing) and draws the badges now. */
export function watchBadges(): void {
  if (started || !FAVOURITES_ON) return;
  started = true;
  let queued = false;
  const later = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyBadges();
    });
  };
  new MutationObserver((records) => {
    if (records.some((r) => [...r.addedNodes].some((n) => !ours(n)))) later();
  }).observe(document.body, { childList: true, subtree: true });
  watchHearts(later);
  applyBadges();
}
