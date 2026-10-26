/**
 * The storage keys and the change event the shell reads (NAV-1). Literals on purpose: the phone bar imports this file at start, and
 * `@travel/core/schema/copies.ts` pulls in Zod, which must stay out of the shell chunk. `tests/mine/keys.test.ts` pins each literal to
 * the core constant, so they cannot drift.
 */
export const COPIES_KEY = 'travel.copies.local';
export const FAV_KEY = 'travel.fav.local';
/** When the visitor last opened Mine; the dot shows while an item is newer than this. */
export const SEEN_KEY = 'travel.mine.seen';
/** Dispatched on `window` after a copy or a favourite is added or removed in this tab (the `storage` event covers other tabs). */
export const CHANGED_EVENT = 'travel:mine-changed';
/** The one-shot print hand-off (sessionStorage, spec 5.2): Mine writes the trip's slug, the trip page's export menu reads it once and removes it. */
export const PRINT_KEY = 'travel.mine.print';
