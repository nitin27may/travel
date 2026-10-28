/**
 * The names `/t/<id>/` reads from its address and fires on the window. Literals: the page's start code needs no schema code to build a link.
 */
/** The query key of edit mode (STEP2-E1 turns it on; read mode ignores it). */
export const EDIT_KEY = 'edit';
/** The query key a bookmarked copy link carries on `/trips/<slug>/`: `mine=<id>` (`mine=1` is the older marker and stays on the public page). */
export const MINE_KEY = 'mine';
/** Dispatched on `window` after a document write in this tab, so the page reads it again. */
export const DOC_CHANGED_EVENT = 'travel:trip-doc-changed';

/** A copy id: the UUID v4 `randomUUID()` makes. `mine=1` and any other value are not ids. */
export const isTripId = (s: string | null | undefined): s is string => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);

/** The trip's own address. `query` is without the '?'. */
export const tripHref = (id: string, query = ''): string => `/t/${id}/${query ? `?${query}` : ''}`;

/** Mine's Open link: the trip on its days (edit-mode-spec 2.3). */
export const openTripHref = (id: string): string => tripHref(id, 'view=day');
