// The base points of the public trips a person has copied (STEP2-PRV PR-001): a small device cache, so the trip picker can put the trip
// nearest a place first and say "Far from <place>" on the rest, without reading a trip document (P8, P9). Public data only: the towns a
// public plan sleeps in, [lon, lat] to 0.01 degree (about 1 km). It is not part of the copies envelope (an older build rejects a copy
// with a field it does not know), so a copy needs no change, and it can be rebuilt any time from the trip's own export.
import type { StorageLike } from '@travel/core/schema/copies.ts';

export const BASES_KEY = 'travel.copy-bases.local';
/** [lon, lat], 2 decimals */
export type BasePoint = [number, number];
/** at most this many trips and bases a trip are kept: 20 copies on a device, and no public trip sleeps in more than a dozen towns */
const MAX_TRIPS = 40;
const MAX_BASES = 12;

const round = (n: number): number => Math.round(n * 100) / 100;

const isPoint = (p: unknown): p is BasePoint =>
  Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number' && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;

/** The cache as stored; a damaged value reads as empty (it is only a cache). */
export function readBases(storage: StorageLike | null): Record<string, BasePoint[]> {
  try {
    const raw = storage?.getItem(BASES_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Record<string, BasePoint[]> = {};
    for (const [slug, pts] of Object.entries(v)) if (Array.isArray(pts) && pts.every(isPoint)) out[slug] = pts.slice(0, MAX_BASES);
    return out;
  } catch {
    return {};
  }
}

/** Keeps the base points of one public trip. Never throws: a full or blocked store only means the next open asks again. */
export function saveBases(storage: StorageLike | null, slug: string, points: readonly BasePoint[]): void {
  if (!storage || !points.length) return;
  try {
    const all = readBases(storage);
    delete all[slug];
    const next = { ...all, [slug]: points.slice(0, MAX_BASES) };
    const keys = Object.keys(next);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TRIPS))) delete next[k];
    storage.setItem(BASES_KEY, JSON.stringify(next));
  } catch {
    /* a cache: skip */
  }
}

/** The distinct base points of a trip's export (the waypoints with the role `base`), rounded. */
export function basesOfExport(d: { waypoints: readonly { role: string; point: { lat: number; lon: number } }[] }): BasePoint[] {
  const seen = new Set<string>();
  const out: BasePoint[] = [];
  for (const w of d.waypoints) {
    if (w.role !== 'base') continue;
    const p: BasePoint = [round(w.point.lon), round(w.point.lat)];
    const k = p.join(',');
    if (!seen.has(k) && isPoint(p)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out.slice(0, MAX_BASES);
}

/** Straight-line km between two [lon, lat] points. */
export function kmApart(a: readonly [number, number], b: readonly [number, number]): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The least distance from `at` to any of the bases; null with none. */
export function nearestBaseKm(at: readonly [number, number], bases: readonly BasePoint[] | undefined): number | null {
  return bases && bases.length ? Math.min(...bases.map((b) => kmApart(b, at))) : null;
}
