// Share links follow the URL table (patterns 1.2): the canonical page, with the anchor for a day or the list state.
// `c=` (camera) rides along only on a map view.

const origin = (): string => (typeof window !== 'undefined' ? window.location.origin : (process.env.SITE_ORIGIN ?? 'https://nks-travel.pages.dev').replace(/\/+$/, ''));

/** Link to a trip, or to one day of it: `/trips/dolomites-2027/#day-3`. */
export function shareUrl(trip: { slug: string }, day?: number | null): string {
  return `${origin()}/trips/${trip.slug}/${day ? `#day-${day}` : ''}`;
}

const ORDER = ['q', 'when', 'source', 'country', 'kind', 'status', 'kids', 'season', 'tag', 'plan', 'view', 'group', 'sort', 'dir', 'page'];

/** Link to a list with its state: keys in the table's order, empty values dropped, `c=` only when the view is the map. */
export function listShareUrl(path: string, state: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  const keys = [...ORDER, ...(state.view === 'map' ? ['c'] : [])];
  for (const k of keys) {
    const v = state[k];
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return `${origin()}${path.replace(/\/?$/, '/')}${s ? `?${s}` : ''}`;
}

/** The URL a share button should copy: the page URL with whatever hash the visitor is on (a day anchor) and no camera unless on a map view. */
export function currentShareUrl(): string {
  const u = new URL(window.location.href);
  if (u.searchParams.get('view') !== 'map') u.searchParams.delete('c');
  return u.toString();
}
