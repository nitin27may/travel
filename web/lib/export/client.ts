'use client';

import { buildGpx } from './gpx';
import type { GpxSource } from './gpx';
import { buildKml } from './kml';
import { tripCsv, listCsv } from './csv';
import { buildIcs, icsEventCount, NoCalendarError } from './ics';
import { fileName, saveFile } from './download';
import type { PlaceExport, TripExport } from './types';

const cache = new Map<string, Promise<TripExport | PlaceExport>>();

/** The export data of a public trip or place, from the static file the build wrote. Cached per page view. */
export function loadExport(type: 'trip', slug: string): Promise<TripExport>;
export function loadExport(type: 'place', slug: string): Promise<PlaceExport>;
export function loadExport(type: 'trip' | 'place', slug: string): Promise<TripExport | PlaceExport> {
  const key = `${type}:${slug}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/export-data/${type}s/${encodeURIComponent(slug)}/data.json`).then((r) => {
      if (!r.ok) throw new Error(`No export data for ${slug}`);
      return r.json();
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export interface Generated {
  name: string;
  /** What the toast says: "61 points". */
  summary: string;
}

const geo = (d: TripExport | PlaceExport): GpxSource => ({ title: d.title, url: d.url, waypoints: d.waypoints, lines: d.lines, skipped: d.skipped });

export function downloadGpx(d: TripExport | PlaceExport): Generated {
  const r = buildGpx(geo(d));
  const name = fileName(d.slug, 'gpx');
  saveFile(name, 'gpx', r.xml);
  return { name, summary: `${r.points} point${r.points === 1 ? '' : 's'}` };
}
export function downloadKml(d: TripExport | PlaceExport): Generated {
  const r = buildKml(geo(d));
  const name = fileName(d.slug, 'kml');
  saveFile(name, 'kml', r.xml);
  return { name, summary: `${r.points} point${r.points === 1 ? '' : 's'}` };
}
export function downloadTripCsv(d: TripExport): Generated {
  const name = fileName(d.slug, 'csv');
  saveFile(name, 'csv', tripCsv(d));
  return { name, summary: `${d.stops.length} stops` };
}
export function downloadListCsv(slug: string, rows: unknown[]): Generated {
  const name = fileName(slug, 'csv');
  saveFile(name, 'csv', listCsv(rows));
  return { name, summary: `${Math.max(0, rows.length - (Array.isArray(rows[0]) ? 1 : 0))} rows` };
}
export function downloadIcs(d: TripExport, startDate: string): Generated {
  const name = fileName(d.slug, 'ics');
  saveFile(name, 'ics', buildIcs(d, startDate));
  const c = icsEventCount(d);
  return { name, summary: `${c.allDay} all-day events${c.timed ? `, ${c.timed} timed` : ''}` };
}
export { NoCalendarError };
