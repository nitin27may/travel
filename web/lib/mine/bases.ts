// The base points of the public trips a person has copied (STEP2-PRV PR-001): a small device cache, so the trip picker can put the trip
// nearest a place first and say "Far from <place>" on the rest, without reading a trip document (P8, P9). Public data only: the towns a
// public plan sleeps in, [lon, lat] to 0.01 degree (about 1 km). It is not part of the copies envelope (an older build rejects a copy
// with a field it does not know), so a copy needs no change, and it can be rebuilt any time from the trip's own export.
import { haversineKm } from '@travel/core/geo/distance.ts';
import type { StorageLike } from '@travel/core/schema/copies.ts';

export const BASES_KEY = 'travel.copy-bases.local';
/** [lon, lat], 2 decimals */
export type BasePoint = [number, number];
/** at most this many trips and bases a trip are kept: 20 copies on a device, and no public trip sleeps in more than a dozen towns, and a plan with no base point keeps up to 24 places it visits */
const MAX_TRIPS = 40;
const MAX_BASES = 12;
const MAX_ANCHORS = 24;

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
    for (const [slug, pts] of Object.entries(v)) if (Array.isArray(pts) && pts.every(isPoint)) out[slug] = pts.slice(0, MAX_ANCHORS);
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
    const next = { ...all, [slug]: points.slice(0, MAX_ANCHORS) };
    const keys = Object.keys(next);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TRIPS))) delete next[k];
    storage.setItem(BASES_KEY, JSON.stringify(next));
  } catch {
    /* a cache: skip */
  }
}

/**
 * The anchor points of a trip's export: its bases (the waypoints with the role `base`) to 0.01 degree. Many plans name no base point, so
 * those fall back to the places their days visit (stops and trailheads), to 0.05 degree (about 5 km) and the first 24 distinct cells: a
 * place within 100 km of where the trip goes is as near as the trip's bases would say.
 */
export function basesOfExport(d: { waypoints: readonly { role: string; point: { lat: number; lon: number } }[] }): BasePoint[] {
  const pick = (roles: readonly string[], step: number, max: number): BasePoint[] => {
    const seen = new Set<string>();
    const out: BasePoint[] = [];
    for (const w of d.waypoints) {
      if (!roles.includes(w.role)) continue;
      const p: BasePoint = [Math.round(w.point.lon / step) * step, Math.round(w.point.lat / step) * step].map((n) => Math.round(n * 100) / 100) as BasePoint;
      const k = p.join(',');
      if (!seen.has(k) && isPoint(p)) {
        seen.add(k);
        out.push(p);
      }
      if (out.length >= max) break;
    }
    return out;
  };
  const bases = pick(['base'], 0.01, MAX_BASES);
  return bases.length ? bases : pick(['stop', 'trailhead'], 0.05, MAX_ANCHORS);
}

/** Straight-line km between two [lon, lat] points (core's one haversine). */
export const kmApart = (a: readonly [number, number], b: readonly [number, number]): number => haversineKm({ lat: a[1], lon: a[0] }, { lat: b[1], lon: b[0] });

/** The least distance from `at` to any of the bases; null with none. */
export function nearestBaseKm(at: readonly [number, number], bases: readonly BasePoint[] | undefined): number | null {
  return bases && bases.length ? Math.min(...bases.map((b) => kmApart(b, at))) : null;
}
