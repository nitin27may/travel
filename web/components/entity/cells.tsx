'use client';

import { usePrefs } from '@/lib/format/prefs';
import { formatDistance, formatElevation } from '@/lib/format/units';

export function Elevation({ m }: { m: number | null }) {
  const [prefs] = usePrefs();
  if (m === null) return <span className="dash">&ndash;</span>;
  return <span className="num">{formatElevation(m, prefs.elevation)}</span>;
}

const STAT_LABEL: Record<string, string> = { km: 'Length', gain_m: 'Climb', hours: 'Time', minutes: 'Time', level: 'Level', miles: 'Length' };

/** One key stat in the viewer's units: km and gain_m convert, everything else prints as stored. */
export function Stat({ k, v, bare }: { k: string; v: string | number; bare?: boolean }) {
  const [prefs] = usePrefs();
  let text: string;
  if (k === 'km' && typeof v === 'number') text = formatDistance(v, prefs.distance);
  else if (k === 'gain_m' && typeof v === 'number') text = formatElevation(v, prefs.elevation);
  else if (k === 'hours') text = `${v} h`;
  else if (k === 'minutes') text = `${v} min`;
  else text = String(v);
  return (
    <span className="stat">
      {bare ? null : <span className="stat-k">{STAT_LABEL[k] ?? k}</span>} {text}
    </span>
  );
}

export function Stats({ stats }: { stats: Record<string, string | number> }) {
  const keys = Object.keys(stats);
  if (!keys.length) return null;
  return (
    <span className="stats">
      {keys.map((k) => (
        <Stat key={k} k={k} v={stats[k]} />
      ))}
    </span>
  );
}
