// Web-Mercator pixel maths for the Google trip map: grouping pins that overlap on screen, and a camera for a set of points that does not need a
// map object (reduced motion jumps with moveCamera instead of the animated fitBounds). No constants of the earth: the world is 256 px at zoom 0.
import type { Bounds } from './geo';
import type { LngLat, Pin } from './types';

const TILE = 256;
const RAD = Math.PI / 180;

export function worldPx(p: LngLat, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  const s = Math.min(0.9999, Math.max(-0.9999, Math.sin(p.lat * RAD)));
  return { x: ((p.lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale };
}

export function fromWorldPx(x: number, y: number, zoom: number): LngLat {
  const scale = TILE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return { lng: (x / scale) * 360 - 180, lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI };
}

/**
 * The numbered pins of the picked day that sit closer than `thresholdPx` on screen at `zoom` become one pill ("2·3"). The pill keeps the first
 * member's place and its id is the members' ids joined with "+", so a hover on a row finds the pill that holds it.
 */
export function clusterNumbered(pins: Pin[], zoom: number, thresholdPx = 20): Pin[] {
  const nums = pins.filter((p) => p.style === 'stop-numbered' && p.number != null);
  const rest = pins.filter((p) => !(p.style === 'stop-numbered' && p.number != null));
  const px = nums.map((p) => worldPx(p.at, zoom));
  const parent = nums.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) {
    if (Math.hypot(px[i]!.x - px[j]!.x, px[i]!.y - px[j]!.y) < thresholdPx) parent[find(j)] = find(i);
  }
  const groups = new Map<number, Pin[]>();
  nums.forEach((p, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), p]));
  const merged = [...groups.values()].map((g): Pin => {
    if (g.length === 1) return g[0]!;
    const sorted = [...g].sort((a, b) => a.number! - b.number!);
    return { ...sorted[0]!, id: sorted.map((p) => p.id).join('+'), numbers: sorted.map((p) => p.number!), number: sorted[0]!.number, label: sorted.map((p) => p.label).filter(Boolean).join(' · ') };
  });
  return [...rest, ...merged];
}

export interface Padding { top: number; right: number; bottom: number; left: number }

/** The centre and zoom that fit `bounds` inside a `w` x `h` box once `pad` is kept clear, never closer than `maxZoom`. */
export function cameraFor(b: Bounds, size: { w: number; h: number }, pad: Padding, maxZoom = 21): { center: LngLat; zoom: number } {
  const availW = Math.max(1, size.w - pad.left - pad.right);
  const availH = Math.max(1, size.h - pad.top - pad.bottom);
  const nw = worldPx({ lng: b[0].lng, lat: b[1].lat }, 0);
  const se = worldPx({ lng: b[1].lng, lat: b[0].lat }, 0);
  const spanX = Math.max(1e-9, se.x - nw.x);
  const spanY = Math.max(1e-9, se.y - nw.y);
  const zoom = Math.min(maxZoom, Math.log2(availW / spanX), Math.log2(availH / spanY));
  const mid = worldPx({ lng: (b[0].lng + b[1].lng) / 2, lat: 0 }, zoom);
  const midY = (worldPx({ lng: 0, lat: b[0].lat }, zoom).y + worldPx({ lng: 0, lat: b[1].lat }, zoom).y) / 2;
  // the box is not centred on the screen when the padding is lopsided: move the centre the other way
  return { center: fromWorldPx(mid.x + (pad.right - pad.left) / 2, midY + (pad.bottom - pad.top) / 2, zoom), zoom };
}
