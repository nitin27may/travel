// "Directions for Day N": a Google Maps URL (no key, no charge) built from OUR coordinates only, never a name or a Google place id (T5).
// The host and the coordinate format come from the one link builder in core/src/links; this adds the day's waypoints to its URL.
import { directionsUrl, formatPoint } from '@/lib/map/links';
import type { LngLat } from '@/lib/map/types';

/** Google Maps takes at most nine waypoints between the origin and the destination. */
export const MAX_WAYPOINTS = 9;

export interface DayDirections { url: string; label: string; truncated: boolean }

/**
 * Origin: the morning base, else the first stop. Destination: the night base, else the last stop. The stops in between are waypoints, in order.
 * Returns null when there is nowhere to go (fewer than two distinct points).
 */
export function dayDirections(day: number, stops: LngLat[], morning: LngLat | null, night: LngLat | null): DayDirections | null {
  const mid = [...stops];
  const origin = morning ?? mid.shift();
  const dest = night ?? mid.pop();
  if (!origin || !dest) return null;
  const used = mid.slice(0, MAX_WAYPOINTS);
  const url = new URL(directionsUrl(dest, { from: origin }));
  if (used.length) url.searchParams.set('waypoints', used.map(formatPoint).join('|'));
  const truncated = mid.length > MAX_WAYPOINTS;
  return { url: url.toString().replace(/%2C/g, ',').replace(/%7C/g, '|'), label: `Directions for Day ${day}${truncated ? ` (first ${MAX_WAYPOINTS} stops)` : ''}`, truncated };
}
