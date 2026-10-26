// The tab a deep link opens, decided before the first paint (UXB-1F M3; spec 3.4, component note 1.8 "selected before paint where the server
// knows it"). The page is static, so the server cannot know the URL's `view` or fragment; a few hundred bytes of inline script can. It sets
// `data-trip-tab` on <html> while the parser is still reading the page, and `trip-tabs.css` shows that panel and hides the Summary, so a
// `#day-11` link paints the days at once instead of the Summary and a jump after hydration. It costs no start JS (it is HTML), and without
// script nothing changes: every panel is in the page and the stylesheet's `noscript` rule un-hides them.
//
// Only the panels whose content the server renders are pre-selected: Days and Bookings. Stops and Photos mount on their first visit (lazy
// chunks), so a Summary that stays until hydration is better than an empty panel. The remembered tab needs storage and keeps its switch.
// `useTripTabs` removes the attribute as soon as React shows the same tab, so a later tab press is not overruled by the CSS.
import { parseTripView, STOP_FRAGMENTS, type TripTab } from '@travel/core/trips/tabs.ts';

/** The tabs the script may pre-select. */
export const PREPAINT_TABS: readonly TripTab[] = ['days', 'bookings'];

/** Every `view` value the page reads (the keys of core's `VIEWS`), mapped through core's own parser so the two cannot disagree. */
const VIEW_KEYS = ['summary', 'day', 'days', 'table', 'all', 'stops', 'category', 'bookings', 'photos'];

/** The inline script for a trip that draws `available` tabs. Same precedence as `resolveTripTab`: `view`, then the fragment. */
export function prepaintScript(available: readonly TripTab[]): string {
  const views = Object.fromEntries(VIEW_KEYS.map((k) => [k, parseTripView(k)!.tab]));
  return (
    `(function(){try{var A=${JSON.stringify(available)},M=${JSON.stringify(views)},P=${JSON.stringify(PREPAINT_TABS)},` +
    `v=/[?&]view=([^&#]*)/.exec(location.search),t=v&&Object.prototype.hasOwnProperty.call(M,v[1])?M[v[1]]:null,h=location.hash;` +
    `if(!t||A.indexOf(t)<0)t=/^#day-\\d{1,2}$/.test(h)?"days":/^#(?:${STOP_FRAGMENTS.join('|')})$/.test(h)?"stops":null;` +
    `if(t&&A.indexOf(t)>=0&&P.indexOf(t)>=0)document.documentElement.setAttribute("data-trip-tab",t)}catch(e){}})()`
  );
}
