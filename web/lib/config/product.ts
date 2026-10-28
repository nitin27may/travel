import { OWN_HOSTS as CORE_OWN_HOSTS } from '@travel/core/privacy/detect.ts';

/**
 * Product settings that are not secrets. CONS-1 extends this file.
 *
 * `reportUrl` is the public feedback repo's new-issue URL with its form chosen (Q70). It is `null` until the repo exists, and
 * while it is `null` no "Report a problem" link is rendered anywhere. To turn the link on, replace `null` with
 * 'https://github.com/nitin27may/travel-feedback/issues/new?template=report.yml'. No email address goes here.
 */
export const reportUrl: string | null = null;

/** The issue-form URL with the page path added as `page` (path only, no query, no hash, nothing else about the visitor). The value is component-encoded, so `&`, `=`, `+` and `%` in a path cannot add or change a key of the form URL; only `/` stays literal. */
export function reportLink(base: string | null, page: string): string | null {
  if (!base) return null;
  const path = page.split(/[?#]/)[0] ?? '';
  const clean = path.startsWith('/') ? path : '/';
  return `${base}${base.includes('?') ? '&' : '?'}page=${encodeURIComponent(clean).replace(/%2F/g, '/')}`;
}

/**
 * CONS-1: product thresholds that were literals in more than one place. These are the single source; `components/ui/Pager.tsx`,
 * `lib/entities/shards.ts` and `tests/budget.test.ts` still hold their own copies until their owners switch to these imports, and
 * `tests/cons/product.test.ts` fails if a copy drifts from the value here.
 */

/** Rows per page for each list view (P8: the page size is capped in one place, so a server can cap it too). */
export const PAGE_SIZE = { cards: 48, list: 48, table: 100, map: 48 } as const;

/** Rows in the first, always-loaded head of a list shard. */
export const HEAD_ROWS = 48;

/** Gzipped first-load JavaScript ceilings, in KB, and the largest globe page's HTML (budget.test.ts holds the checks). */
export const LIST_JS_BUDGET_KB = 200;
export const PLACE_JS_BUDGET_KB = 180;
export const GLOBE_HTML_BUDGET_KB = 200;
/** Gzipped KB of the scripts `/t/<id>/` loads at start (STEP2-T1, measured 321.4 KB on 28 Oct 2026: the page paints its plan on the client, so its start JS holds the whole trip page; edit mode lazy-loads, edit-mode-spec 3). */
export const TRIP_EDIT_JS_BUDGET_KB = 325;

/** How long a toast stays, in ms (components 5.3): with an Undo, without one, and the first-save note. */
export const TOAST_TIMES = { undo: 6000, plain: 4000, first: 8000 } as const;
/** How long a favourites toast stays, in ms: the first-save note, and a toast with an Undo (components 5.3). */
export const FAVOURITES_TOAST_TIMES = { first: TOAST_TIMES.first, undo: TOAST_TIMES.undo } as const;

/**
 * Edit mode on `/t/<id>/` (edit-mode-spec 5.2, 12, 18). Drag thresholds and the long-press belong to STEP2-E2 and are kept here so the
 * numbers have one home: long-press 300 ms on the handle, 4 px on the handle or 8 px on the row, autoscroll in the outer 64 px.
 */
export const TRIP_EDIT_UI = {
  longPressMs: 300,
  dragHandlePx: 4,
  dragRowPx: 8,
  autoscrollEdgePx: 64,
  /** "Changed on another device" stays on a row this long */
  changedMarkMs: 6000,
  /** the sync word says Syncing only after this long pending */
  syncWordDelayMs: 1000,
  /** the live region clears its message after this long, so the same words can be said twice */
  announceClearMs: 1500,
} as const;

/**
 * The hosts that are ours, for the privacy detector's dated-folder rule (public-ref-aliases 6.1): a link to any other host (a third
 * party's page named `Bench-July-2022.html`) is not read as a dated trip folder of ours, a link to one of ours is. Core's default list
 * (`OWN_HOSTS`: the old site and the beta host) plus the host of the configured `SITE_ORIGIN` and any hosts in the comma-separated
 * `OWN_HOSTS_EXTRA` env value (read at call time, so a new host needs no code change).
 */
export function ownHosts(env: Record<string, string | undefined> = process.env): string[] {
  const hostOf = (v: string | undefined): string | null => {
    const raw = (v ?? '').trim();
    if (!raw) return null;
    try {
      return new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase();
    } catch {
      return null;
    }
  };
  const extra = (env.OWN_HOSTS_EXTRA ?? '').split(',').map(hostOf);
  return [...new Set([...CORE_OWN_HOSTS, hostOf(env.SITE_ORIGIN), ...extra].filter((h): h is string => !!h))];
}

/** The longest trip name a person can give a copy (SW-012), and the length past which the cover steps its display size down. */
export const TRIP_NAME_MAX = 60;
export const TITLE_LONG_CHARS = 26;

/** SW-003: numbered stop pins that sit closer than this many screen pixels draw as one pill ("2 · 3") that fans out on hover or tap, as on the Google map. */
export const MAP_PIN_NEAR_PX = 20;
