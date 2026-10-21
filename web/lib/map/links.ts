import type { LngLat } from './types';

/**
 * Outbound map links, built from OUR stored point. No API key, no Google call, and nothing Google returns
 * is ever stored (Google Maps Platform terms 3.2.3). Coordinates are written with 5 decimals (about 1 m).
 */
const c5 = (n: number): string => n.toFixed(5);
const pair = (p: LngLat): string => `${c5(p.lat)},${c5(p.lng)}`;

export type TravelMode = 'driving' | 'walking' | 'transit';

export function directionsUrl(to: LngLat, opts: { from?: LngLat; mode?: TravelMode } = {}): string {
  const q = new URLSearchParams({ api: '1', destination: pair(to), travelmode: opts.mode ?? 'driving' });
  if (opts.from) q.set('origin', pair(opts.from));
  return `https://www.google.com/maps/dir/?${q.toString().replace(/%2C/g, ',')}`;
}

export function searchUrl(name: string, at: LngLat, placeId?: string): string {
  const q = new URLSearchParams({ api: '1', query: placeId ? name : pair(at) });
  if (placeId) q.set('query_place_id', placeId);
  return `https://www.google.com/maps/search/?${q.toString().replace(/%2C/g, ',')}`;
}

export function appleMapsUrl(at: LngLat, name?: string, mode: 'd' | 'w' = 'd'): string {
  const q = new URLSearchParams({ daddr: pair(at), dirflg: mode });
  if (name) q.set('q', name);
  return `https://maps.apple.com/?${q.toString().replace(/%2C/g, ',')}`;
}

export function formatPoint(p: LngLat): string {
  return pair(p);
}

/* ---------- third-party trail sites: links only, never data ---------- */

export interface AllTrailsInput {
  name: string;
  /** the nearest named area (park, district or town): narrows the search, never stored as data */
  area?: string | null;
  /** the record's links; a filled `alltrails` link is used as it is */
  links?: ReadonlyArray<{ kind: string; url: string }>;
}

export interface AllTrailsLink {
  url: string;
  /** true when the record holds the AllTrails page itself, false for the search link */
  direct: boolean;
  /** the accessible name: "Open on AllTrails" for a stored page, "Search AllTrails" for a search. A link-only platform's name is never page text (privacy test), so it lives in aria-label only */
  label: string;
  /** the visible link text, with no platform name */
  text: string;
}

const siteQuery = (name: string, area?: string | null): string => [name, area].filter((s) => s && s.trim()).join(' ').replace(/\s+/g, ' ').trim();

/** AllTrails on every trail: the stored page when the record has one, else a labelled search built from name and area. No fetch, ever. */
export function allTrailsLink(p: AllTrailsInput): AllTrailsLink {
  const stored = p.links?.find((l) => l.kind === 'alltrails' && /^https:\/\/(?:www\.)?alltrails\.com\//.test(l.url));
  if (stored) return { url: stored.url, direct: true, label: 'Open on AllTrails', text: 'Open trail page' };
  return { url: `https://www.alltrails.com/search?${new URLSearchParams({ q: siteQuery(p.name, p.area) }).toString()}`, direct: false, label: 'Search AllTrails', text: 'Search for this trail' };
}

/** Komoot search, the same way: a link, never data. */
export function komootSearchUrl(name: string, area?: string | null): string {
  return `https://www.komoot.com/discover?${new URLSearchParams({ q: siteQuery(name, area) }).toString()}`;
}
