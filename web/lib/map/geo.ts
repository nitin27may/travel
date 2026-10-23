import { haversineKm } from '@travel/core/geo/distance.ts';
import type { Line, LngLat, MapSpec, Pin } from './types';

export type Bounds = [LngLat, LngLat];

export function boundsOf(points: LngLat[]): Bounds | null {
  if (!points.length) return null;
  let w = 180, e = -180, s = 90, n = -90;
  for (const p of points) { w = Math.min(w, p.lng); e = Math.max(e, p.lng); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
  return [{ lng: w, lat: s }, { lng: e, lat: n }];
}

/** Points the camera should cover: all pins and line vertices, or those of the listed ids. */
export function fitPoints(spec: Pick<MapSpec, 'pins' | 'lines'>, ids?: string[]): LngLat[] {
  const pick = (id: string) => !ids || ids.includes(id);
  const out: LngLat[] = [];
  for (const p of spec.pins) if (pick(p.id)) out.push(p.at);
  for (const l of spec.lines) if (pick(l.id)) out.push(...l.coords);
  return out;
}

/** Fly-to duration in ms, 600 to 900 by distance (patterns 6). */
export function flyDuration(km: number): number {
  return Math.round(600 + Math.min(1, Math.max(0, km / 400)) * 300);
}

export function distanceKm(a: LngLat, b: LngLat): number {
  return haversineKm({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng });
}

export interface PinGroup {
  id: string;
  at: LngLat;
  pins: Pin[];
  /** Badge text. One pin: its number or empty. Co-located stops: "3 · 5". */
  text: string;
  /** The style the group draws with: the strongest member. */
  style: Pin['style'];
}

const RANK: Pin['style'][] = ['base', 'stop-numbered', 'trailhead', 'parking', 'place', 'trip', 'stop'];

/** Pins within about 11 m share one group, so co-located stops draw as one pin with a "3 · 5" badge. */
export function groupPins(pins: Pin[]): PinGroup[] {
  const by = new Map<string, Pin[]>();
  for (const p of pins) {
    const k = `${p.at.lng.toFixed(4)},${p.at.lat.toFixed(4)}`;
    by.set(k, [...(by.get(k) ?? []), p]);
  }
  return [...by.values()].map((members) => {
    const sorted = [...members].sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9));
    const nums = sorted.map((p) => p.number).filter((n): n is number => n != null);
    const style = [...sorted].sort((a, b) => RANK.indexOf(a.style) - RANK.indexOf(b.style))[0].style;
    const first = sorted[0];
    return {
      id: sorted.length === 1 ? first.id : `group:${sorted.map((p) => p.id).join('+')}`,
      at: first.at,
      pins: sorted,
      text: sorted.length === 1 ? (first.number != null ? String(first.number) : '') : nums.length ? nums.join(' · ') : String(sorted.length),
      style,
    };
  });
}

export const lineFeatures = (lines: Line[]) => lines.map((l) => ({
  type: 'Feature' as const,
  properties: { id: l.id, style: l.style },
  geometry: { type: 'LineString' as const, coordinates: l.coords.map((c) => [c.lng, c.lat]) },
}));

export function parseCameraParam(c: string | null | undefined): { lng: number; lat: number; zoom: number } | undefined {
  if (!c) return undefined;
  const [lng, lat, zoom] = c.split(',').map(Number);
  if (![lng, lat, zoom].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lng, lat, zoom };
}
export const formatCameraParam = (c: { lng: number; lat: number; zoom: number }): string => `${c.lng.toFixed(4)},${c.lat.toFixed(4)},${c.zoom.toFixed(2)}`;
