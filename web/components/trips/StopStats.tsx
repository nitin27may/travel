'use client';

import { usePrefs } from '@/lib/format/prefs';
import { formatDistance, formatElevation } from '@/lib/format/units';
import type { StopModel } from './model';

/** Distance, climb and time in the viewer's units: "10 km · 450 m up · 3.5-4.5 h". */
export function StopStats({ stats }: { stats: NonNullable<StopModel['stats']> }) {
  const [prefs] = usePrefs();
  const parts = [
    stats.distanceKm !== null ? formatDistance(stats.distanceKm, prefs.distance) : null,
    stats.gainM !== null ? `${formatElevation(stats.gainM, prefs.elevation)} up` : null,
    stats.hours ? (/[a-z]/i.test(stats.hours) ? stats.hours : `${stats.hours} h`) : null,
  ].filter(Boolean);
  return <span className="num stop-stats">{parts.join(' · ')}</span>;
}
