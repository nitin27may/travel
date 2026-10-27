'use client';

import { bookingCounts } from '@travel/core/export/bookings.ts';
import { buildGpx } from './gpx';
import type { GpxSource } from './gpx';
import { buildKml } from './kml';
import { tripCsv } from './csv';
import { buildIcs, icsEventCount, NoCalendarError } from './ics';
import type { IcsTimeline } from './ics';
import { fileName, saveFile } from './download';
import { lineExportable } from './licence';
import type { ExportLine, PlaceExport, TripExport } from './types';

// Where the export data comes from is the client data module's business (lib/client/data.ts); this file only turns it into files.
export { loadExport } from '@/lib/client/data';

export interface Generated {
  name: string;
  /** What the toast says: "61 points". */
  summary: string;
}

const geo = (d: TripExport | PlaceExport, routes: ExportLine[]): GpxSource => ({ title: d.title, url: d.url, waypoints: d.waypoints, lines: [...d.lines, ...routes], skipped: d.skipped });

/** "61 points, 27 road routes": what the file holds, in the toast and the menu. */
export function fileSummary(points: number, routes: ExportLine[]): string {
  const n = routes.filter(lineExportable).length;
  return `${points} point${points === 1 ? '' : 's'}${n ? `, ${n} road route${n === 1 ? '' : 's'}` : ''}`;
}

/** `routes` are the trip's routed legs as lines (lib/export/routes.ts); a place has none. */
export function downloadGpx(d: TripExport | PlaceExport, routes: ExportLine[] = []): Generated {
  const r = buildGpx(geo(d, routes));
  const name = fileName(d.slug, 'gpx');
  saveFile(name, 'gpx', r.xml);
  return { name, summary: fileSummary(r.points, routes) };
}
export function downloadKml(d: TripExport | PlaceExport, routes: ExportLine[] = []): Generated {
  const r = buildKml(geo(d, routes));
  const name = fileName(d.slug, 'kml');
  saveFile(name, 'kml', r.xml);
  return { name, summary: fileSummary(r.points, routes) };
}
export function downloadTripCsv(d: TripExport): Generated {
  const name = fileName(d.slug, 'csv');
  saveFile(name, 'csv', tripCsv(d));
  // the file's own rows: its stops, and the trip's bookings when it has any (MUST-6)
  const toBook = bookingCounts(d.bookings).toBook;
  return { name, summary: `${d.stops.length} stops${toBook ? `, ${toBook} to book ahead` : ''}` };
}
export function downloadIcs(d: TripExport, startDate: string, timeline?: IcsTimeline): Generated {
  const name = fileName(d.slug, 'ics');
  saveFile(name, 'ics', buildIcs(d, startDate, new Date(), timeline));
  const c = icsEventCount(d, timeline);
  return { name, summary: `${c.allDay} all-day events${c.timed ? `, ${c.timed} timed` : ''}` };
}
export { NoCalendarError };
