import type { LngLat, Pin } from '@/lib/map/types';

export interface PointLike {
  id: string;
  at: LngLat;
  label: string;
  kind?: string;
}

export interface ClusterResult {
  pins: Pin[];
  /** cluster pin id -> member ids, so a click can fit them */
  members: Map<string, string[]>;
}

/** Grid cell in degrees that is about `px` screen pixels wide at `zoom` (a 256 px tile spans 360 / 2^zoom degrees). */
export const cellDegrees = (zoom: number, px = 44): number => (px / 256) * (360 / 2 ** zoom);

/**
 * Groups points that would draw within about 44 px of each other into one numbered pin. The selected point is never
 * folded into a cluster, so its card never loses its pin. Deterministic: the same points and zoom give the same pins.
 */
export function clusterPins(points: readonly PointLike[], zoom: number, selectedId?: string | null): ClusterResult {
  const cell = cellDegrees(zoom);
  const cells = new Map<string, PointLike[]>();
  const pins: Pin[] = [];
  for (const p of points) {
    if (p.id === selectedId || zoom >= 13) {
      pins.push({ id: p.id, at: p.at, style: 'place', label: p.label, kind: p.kind });
      continue;
    }
    const key = `${Math.floor(p.at.lng / cell)}:${Math.floor(p.at.lat / cell)}`;
    cells.set(key, [...(cells.get(key) ?? []), p]);
  }
  const members = new Map<string, string[]>();
  for (const [key, list] of cells) {
    if (list.length === 1) {
      const p = list[0];
      pins.push({ id: p.id, at: p.at, style: 'place', label: p.label, kind: p.kind });
      continue;
    }
    const lng = list.reduce((n, p) => n + p.at.lng, 0) / list.length;
    const lat = list.reduce((n, p) => n + p.at.lat, 0) / list.length;
    const id = `cluster:${key}`;
    members.set(id, list.map((p) => p.id));
    pins.push({ id, at: { lng, lat }, style: 'stop-numbered', number: list.length, label: `${list.length} places` });
  }
  return { pins, members };
}

/** `c=lon,lat,zoom` (patterns 1.2). Returns null for anything that is not three finite numbers in range. */
export function parseCamera(value: string | null): { lng: number; lat: number; zoom: number } | null {
  if (!value) return null;
  const n = value.split(',').map(Number);
  if (n.length !== 3 || n.some((x) => !Number.isFinite(x))) return null;
  const [lng, lat, zoom] = n;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90 || zoom < 0 || zoom > 22) return null;
  return { lng, lat, zoom };
}

export function formatCamera(c: { lng: number; lat: number; zoom: number }): string {
  return `${c.lng.toFixed(3)},${c.lat.toFixed(3)},${c.zoom.toFixed(1)}`;
}
