import type { LngLat } from '@/lib/map/types';
import type { PlaceLine } from '@/lib/public/types';
import { trackOfLines } from './model';
import type { PlaceMapPoint } from './PlaceMap';
import { PlaceMapLazy } from './PlaceMapLazy';

/**
 * The trail's map (T5, honest maps): the stored OpenStreetMap line when we hold one, drawn dashed and labelled "Route not
 * confirmed yet" while a person has not confirmed it; otherwise the trailhead, parking and payoff pins with the straight guide,
 * labelled as a straight line. Every line says where it came from in the credit under the map.
 */
export function TrailMap({ name, points, guide, lines, selectedId }: { name: string; points: PlaceMapPoint[]; guide: { from: LngLat; to: LngLat } | null; lines: PlaceLine[]; selectedId?: string }) {
  const stored = trackOfLines(lines);
  return <PlaceMapLazy name={name} points={points} guide={guide} selectedId={selectedId} track={stored ? { lines: stored.lines, dashed: stored.dashed, credit: stored.credit } : null} />;
}
