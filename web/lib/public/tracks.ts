import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { PlaceLine, PlaceProfile } from './types';

// The stored OSM tracks (data/tracks, trail-track/1; schema in data/tracks/README.md). Read at build time only: the site
// never calls Overpass, the OSM API or the tile server. Keyed by prototype place id.

export interface TrackFile {
  schema: string;
  place: string;
  osm: string[];
  fetched: string;
  source: string;
  licence: string;
  attribution: string;
  stitched: boolean;
  confirmed: boolean;
  held_back?: string[];
  start_offset_m: number | null;
  totals: { km: number; gain_m: number | null; loss_m: number | null; high_m: number | null; low_m: number | null };
  dem: string | null;
  geometry: [number, number][];
  segments?: [number, number][][];
  elevation: [number, number][];
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-19" -> "19 Oct 2026": the read date as the rest of the public pages write it (never an ISO date). */
export function readDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}` : iso;
}

export function loadTracks(root: string): Map<string, TrackFile> {
  const dir = path.join(root, 'data', 'tracks');
  const out = new Map<string, TrackFile>();
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const t = JSON.parse(readFileSync(path.join(dir, n), 'utf8')) as TrackFile;
    if (t.schema === 'trail-track/1') out.set(t.place, t);
  }
  return out;
}

export const profileOf = (t: TrackFile): PlaceProfile | null =>
  t.stitched && t.elevation.length >= 2 && t.totals.gain_m !== null
    ? { samples: t.elevation.map(([d, m]) => [Math.round(d) / 1000, m]), km: t.totals.km, gainM: t.totals.gain_m, lossM: t.totals.loss_m ?? 0, highM: t.totals.high_m ?? 0, lowM: t.totals.low_m ?? 0, dem: t.dem ?? '' }
    : null;

/**
 * Puts a stored track on the place's first OSM line. `unconfirmed` is the adapter's own list (honesty-overrides): it wins over
 * the flag stored in the file, so removing a trail from the list is enough to confirm it.
 */
export function withTrack(lines: PlaceLine[], t: TrackFile | undefined, unconfirmed: boolean): PlaceLine[] {
  if (!t || !lines.length) return lines;
  const confirmed = t.confirmed && !unconfirmed;
  const [first, ...more] = lines;
  const credit = `${t.attribution} (ODbL), read ${readDate(t.fetched)}${t.dem ? `; elevation ${t.dem}` : ''}`;
  return [
    {
      ...first,
      label: `OpenStreetMap ${t.osm.map((o) => o.replace(':', ' ')).join(', ')}, read ${readDate(t.fetched)}`,
      geometry: t.stitched ? t.geometry : undefined,
      segments: t.stitched ? undefined : t.segments,
      dashed: !confirmed || !t.stitched,
      profile: profileOf(t),
      credit,
      exportable: first.exportable && confirmed && t.stitched,
    },
    ...more.map((l) => ({ ...l, exportable: l.exportable && confirmed && t.stitched })),
  ];
}

/** True when the track's length differs from the researched value by more than 10%: both are then shown with their sources (T3). */
export function totalsDiffer(trackKm: number, trackGain: number | null, km: number | null, gain: number | null): boolean {
  const off = (a: number | null, b: number | null) => a !== null && b !== null && b > 0 && Math.abs(a - b) / b > 0.1;
  return off(trackKm, km) || off(trackGain, gain);
}
