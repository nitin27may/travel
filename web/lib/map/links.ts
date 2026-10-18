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
