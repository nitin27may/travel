import type { Camera, View } from './types';

const BASE = '/globe';

/** Reads the globe state from a pathname such as `/globe/it/south-tyrol/` or `/globe/place/lago-di-braies/`. */
export function parseView(pathname: string): View {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  if (parts[0] !== 'globe') return { kind: 'area', path: [] };
  const rest = parts.slice(1);
  if (rest[0] === 'place' && rest[1]) return { kind: 'place', slug: rest[1] };
  if (rest[0] === 'trip' && rest[1]) return { kind: 'trip', slug: rest[1] };
  return { kind: 'area', path: rest.slice(0, 3).map((s, i) => (i === 0 ? s.toLowerCase() : s)) };
}

export function viewPath(v: View): string {
  if (v.kind === 'place') return `${BASE}/place/${encodeURIComponent(v.slug)}/`;
  if (v.kind === 'trip') return `${BASE}/trip/${encodeURIComponent(v.slug)}/`;
  return v.path.length ? `${BASE}/${v.path.map(encodeURIComponent).join('/')}/` : `${BASE}/`;
}

export function parseCamera(search: string): Camera | null {
  const raw = new URLSearchParams(search).get('c');
  if (!raw) return null;
  const [lng, lat, zoom] = raw.split(',').map(Number);
  if (![lng, lat, zoom].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 360 || zoom < 0 || zoom > 22) return null;
  return { lng, lat, zoom };
}

/** `?m=<name>`: the name of a search hit the globe was sent to, which gets a marker at the `?c=` camera. Null when absent or blank. */
export function parseHit(search: string): string | null {
  const m = new URLSearchParams(search).get('m')?.trim();
  return m ? m.slice(0, 80) : null;
}

/** `?c=lng,lat,zoom`: optional, never required to resolve a link (patterns 1.2). */
export function cameraQuery(c: Camera | null): string {
  if (!c) return '';
  return `?c=${c.lng.toFixed(3)},${c.lat.toFixed(3)},${c.zoom.toFixed(2)}`;
}

/** `&m=<name>` to carry on a camera query when the visit began at a search hit, so the camera writes keep the marker's name. */
export function hitSuffix(search: string): string {
  const m = parseHit(search);
  return m ? `&m=${encodeURIComponent(m)}` : '';
}

export const sameView = (a: View, b: View): boolean => viewPath(a) === viewPath(b);
