import { distanceKm } from '@/lib/map/geo';
import type { PlaceMapPoint } from './PlaceMap';

/** Two points closer than this read as one spot on a place map. */
export const SAME_SPOT_M = 25;
/** A pin label this close to another label is dropped: they would sit on top of each other at the fitted zoom. */
export const LABEL_CLASH_M = 250;

const metres = (a: PlaceMapPoint, b: PlaceMapPoint) => distanceKm(a.at, b.at) * 1000;

/**
 * The destination pin is dropped when the trailhead is the same spot (a loop that starts and ends at its trailhead,
 * Tre Cime): drawn together they merge into a "2" disc that hides the trailhead triangle.
 */
export function dedupeMapPoints(points: PlaceMapPoint[]): PlaceMapPoint[] {
  const th = points.find((p) => p.style === 'trailhead');
  return th ? points.filter((p) => p.style !== 'place' || metres(p, th) > SAME_SPOT_M) : points;
}

/**
 * Ids of the pins that carry a name on the map: the selected pin and the trailhead, but when those two sit within
 * LABEL_CLASH_M of each other only the trailhead is named, below its triangle, and the ring marks the selection (Braies:
 * P4's label sat on the hotel trailhead's triangle).
 * Every other lot keeps its name for assistive technology only.
 */
export function labelledIds(points: PlaceMapPoint[], selectedId?: string): Set<string> {
  const sel = points.find((p) => p.id === selectedId);
  const th = points.find((p) => p.style === 'trailhead');
  const out = new Set<string>();
  const clash = !!sel && !!th && sel.id !== th.id && metres(sel, th) <= LABEL_CLASH_M;
  if (sel && !clash) out.add(sel.id);
  if (th) out.add(th.id);
  return out;
}
