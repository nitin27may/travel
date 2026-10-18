'use client';

import { buildGpx } from './gpx';
import type { GpxSource } from './gpx';
import { buildKml } from './kml';
import { tripCsv } from './csv';
import { buildIcs, icsEventCount, NoCalendarError } from './ics';
import { fileName, saveFile } from './download';
import type { PlaceExport, TripExport } from './types';

// Where the export data comes from is the client data module's business (lib/client/data.ts); this file only turns it into files.
export { loadExport } from '@/lib/client/data';

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
export function downloadIcs(d: TripExport, startDate: string): Generated {
  const name = fileName(d.slug, 'ics');
  saveFile(name, 'ics', buildIcs(d, startDate));
  const c = icsEventCount(d);
  return { name, summary: `${c.allDay} all-day events${c.timed ? `, ${c.timed} timed` : ''}` };
}
export { NoCalendarError };
