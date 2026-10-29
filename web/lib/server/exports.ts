import { printText } from '@travel/core/catalogue/printText.ts';
import { EXPORT_FILE, type ExportFile, type ExportModel, type ExportQuery } from '@travel/core/schema/api/index.ts';
import { toCsv } from '@/lib/entities/csv';
import { tripCsv } from '@/lib/export/csv';
import { buildPlaceExport, buildTripExport } from '@/lib/export/build.server';
import { buildGpx } from '@/lib/export/gpx';
import { buildKml } from '@/lib/export/kml';
import { approxNote, attributionFor, checkPoint, lineExportable } from '@/lib/export/licence';
import type { PlaceExport, TripExport } from '@/lib/export/types';
import type { Point } from '@travel/core/export/publicTypes.ts';
import type { PublicPlace, PublicTrip } from '@/lib/public';

// One export file for one item, from the model the page's own export data is made of (lib/export/build.server.ts, whose licence guard
// every format passes). The files are the ones the browser builds today, so a download from the API and a download from the page agree.
//
// `json` is the export MODEL (store.ts A26, D-E6): the structured export (waypoints, stops, lines) the Export menu's counts and the browser's
// file builders read, with the licence guard inside it (a waypoint whose point is not ours is left out and counted in `skipped`; a stop keeps
// its row with `point: null`). `print` is the same model laid out as plain text for paper (core/src/catalogue/printText.ts).
/** The five fields of the contract's export point: a source point can carry more (a name, a note), and the model's schema is strict. */
const exportPoint = (p: Point) => ({ lat: p.lat, lon: p.lon, pointSource: p.pointSource, pointChecked: p.pointChecked ?? null, sourceLicence: p.sourceLicence });

/** The model as the contract has it: points cut to the contract's five fields, and a stop whose point fails the guard keeps its row with no point. */
function contractModel(model: TripExport | PlaceExport): ExportModel {
  const waypoints = model.waypoints.map((w) => ({ ...w, point: exportPoint(w.point) }));
  if (model.type === 'place') return { ...model, waypoints } as ExportModel;
  const stops = model.stops.map((s) => ({ ...s, point: s.point && checkPoint(s.point).ok ? exportPoint(s.point) : null }));
  return { ...model, waypoints, stops } as ExportModel;
}

/**
 * The model without stop addresses, for the two text bodies (`csv`, `print`). The privacy net reads a text body whole and cannot tell a
 * public place's street address from a household's (its street rule is the ES-012 rule and stays as it is), so the API's text files leave
 * the address out; the `json` model carries it as a typed field (the net knows that shape) and the browser's own CSV, print and calendar
 * are built from that model (LT-M).
 */
const withoutAddress = <T extends TripExport | PlaceExport>(d: T): T => (d.type === 'trip' ? ({ ...d, stops: d.stops.map(({ address: _a, ...s }) => (void _a, s)) } as T) : d);

const geo = (d: TripExport | PlaceExport) => ({ title: d.title, url: d.url, waypoints: d.waypoints, lines: d.lines, skipped: d.skipped });

/** A calendar with no events: a public trip has no dates and a place is not an event, so the file says what it is and holds nothing to import. */
const emptyCalendar = (title: string): string => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trip Plans//EN', `X-WR-CALNAME:${title.replace(/[\;,\r\n]/g, ' ')}`, 'END:VCALENDAR', ''].join('\r\n');

function placeCsv(d: PlaceExport): string {
  const rows = d.waypoints.filter((w) => checkPoint(w.point).ok).map((w) => [w.name, w.kind, w.role, w.point.lat, w.point.lon, approxNote(w.point) ? 'yes' : '']);
  return toCsv(['Name', 'Kind', 'Role', 'Lat', 'Lon', 'Approximate'], rows);
}

export function exportFileOf(q: ExportQuery, lookup: { place(slug: string): PublicPlace | null; trip(slug: string): PublicTrip | null }): ExportFile | null {
  const format = q.format;
  const place = q.type === 'place' ? lookup.place(q.slug) : null;
  const trip = q.type === 'trip' ? lookup.trip(q.slug) : null;
  if (!place && !trip) return null;
  const model: TripExport | PlaceExport = place ? buildPlaceExport(place) : buildTripExport(trip!, lookup.place);
  const ok = model.waypoints.filter((w) => checkPoint(w.point).ok);
  const skipped = model.skipped + (model.waypoints.length - ok.length);
  const approx = ok.filter((w) => approxNote(w.point)).length;
  const tracks = model.lines.filter((l) => lineExportable(l) && l.geometry.length >= 2);
  const source = attributionFor(ok.map((w) => w.point), tracks).join(' ');
  const { ext, mime } = EXPORT_FILE[format];
  const body: Record<ExportQuery['format'], () => string> = {
    gpx: () => buildGpx(geo(model)).xml,
    kml: () => buildKml(geo(model)).xml,
    csv: () => (model.type === 'trip' ? tripCsv(withoutAddress(model)) : placeCsv(model)),
    ics: () => emptyCalendar(model.title),
    json: () => JSON.stringify(contractModel(model)),
    print: () => printText(contractModel(withoutAddress(model)), { area: place?.areaLabel ?? null }),
  };
  return { filename: `${q.slug}.${ext}`, mime, body: body[format](), source, skipped, approx };
}
