import type { LngLat } from '@/lib/map/types';
import type { PlaceLine } from '@/lib/public/types';
import { ElevationProfile } from './ElevationProfile';
import { trackOfLines } from './model';

/**
 * The elevation profile of a trail: sampled along the stored OpenStreetMap line when there is one (the map marker then follows
 * that line), otherwise the sketch from the published distance and climb, labelled as an estimate.
 */
export function TrailProfile({ km, gainM, startM, loop, highM, guide, lines }: { km: number | null; gainM: number | null; startM: number; loop: boolean; highM: number | null; guide: { from: LngLat; to: LngLat } | null; lines: PlaceLine[] }) {
  const stored = trackOfLines(lines);
  const profile = stored?.profile ?? null;
  const track = profile && stored ? stored.lines[0] : null;
  return <ElevationProfile km={profile?.km ?? km ?? 0} gainM={profile?.gainM ?? gainM ?? 0} startM={startM} loop={loop} highM={profile?.highM ?? highM} guide={guide} profile={profile} track={track} />;
}
