import type { ExportFile, ExportQuery } from '@travel/core/schema/api/index.ts';
import { toCsv } from '@/lib/entities/csv';
import { tripCsv } from '@/lib/export/csv';
import { buildPlaceExport, buildTripExport } from '@/lib/export/build.server';
import { buildGpx } from '@/lib/export/gpx';
import { buildKml } from '@/lib/export/kml';
import { approxNote, attributionFor, checkPoint, lineExportable } from '@/lib/export/licence';
import type { PlaceExport, TripExport } from '@/lib/export/types';
import type { PublicPlace, PublicTrip } from '@/lib/public';

// One export file for one item, from the model the page's own export data is made of (lib/export/build.server.ts, whose licence guard
// every format passes). The files are the ones the browser builds today, so a download from the API and a download from the page agree.
//
// `print` is still the printable MODEL here: the structured export (waypoints, stops, lines) as JSON, which is what the browser's file
// builders and the Export menu's counts read. The contract now has `json` for the model and makes `print` a plain-text file (store.ts
// A26, D-E6); API-3b moves the model to `json` (JsonStore answers not_available for it until then), writes the print file, and the
// client switches with it, so this file and web/lib/client/api.ts change in one commit.
export const EXPORT_MODEL_FORMAT = 'print' as const;

/** The formats this builder writes before API-3b: every format but the `json` model. */
type FileFormat = Exclude<ExportQuery['format'], 'json'>;

const EXT: Record<FileFormat, [ext: string, mime: string]> = {
  gpx: ['gpx', 'application/gpx+xml'],
  kml: ['kml', 'application/vnd.google-earth.kml+xml'],
  csv: ['csv', 'text/csv'],
  ics: ['ics', 'text/calendar'],
  print: ['print.json', 'application/json'],
};

const geo = (d: TripExport | PlaceExport) => ({ title: d.title, url: d.url, waypoints: d.waypoints, lines: d.lines, skipped: d.skipped });

/** A calendar with no events: a public trip has no dates and a place is not an event, so the file says what it is and holds nothing to import. */
const emptyCalendar = (title: string): string => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trip Plans//EN', `X-WR-CALNAME:${title.replace(/[\;,\r\n]/g, ' ')}`, 'END:VCALENDAR', ''].join('\r\n');

function placeCsv(d: PlaceExport): string {
  const rows = d.waypoints.filter((w) => checkPoint(w.point).ok).map((w) => [w.name, w.kind, w.role, w.point.lat, w.point.lon, approxNote(w.point) ? 'yes' : '']);
  return toCsv(['Name', 'Kind', 'Role', 'Lat', 'Lon', 'Approximate'], rows);
}

export function exportFileOf(q: ExportQuery, lookup: { place(slug: string): PublicPlace | null; trip(slug: string): PublicTrip | null }): ExportFile | null {
  if (q.format === 'json') return null;
  const format: FileFormat = q.format;
  const place = q.type === 'place' ? lookup.place(q.slug) : null;
  const trip = q.type === 'trip' ? lookup.trip(q.slug) : null;
  if (!place && !trip) return null;
  const model: TripExport | PlaceExport = place ? buildPlaceExport(place) : buildTripExport(trip!, lookup.place);
  const ok = model.waypoints.filter((w) => checkPoint(w.point).ok);
  const skipped = model.skipped + (model.waypoints.length - ok.length);
  const approx = ok.filter((w) => approxNote(w.point)).length;
  const tracks = model.lines.filter((l) => lineExportable(l) && l.geometry.length >= 2);
  const source = attributionFor(ok.map((w) => w.point), tracks).join(' ');
  const [ext, mime] = EXT[format];
  const body: Record<FileFormat, () => string> = {
    gpx: () => buildGpx(geo(model)).xml,
    kml: () => buildKml(geo(model)).xml,
    csv: () => (model.type === 'trip' ? tripCsv(model) : placeCsv(model)),
    ics: () => emptyCalendar(model.title),
    print: () => JSON.stringify(model),
  };
  return { filename: `${q.slug}.${ext}`, mime, body: body[format](), source, skipped, approx };
}
