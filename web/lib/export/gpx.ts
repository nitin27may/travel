import { approxNote, attributionFor, checkPoint, lineExportable } from './licence';
import type { ExportLine, ExportWaypoint } from './types';
import { coord, x } from './xml';

// GPX 1.1. Element order follows the schema: wpt = ele, time, name, cmt, desc, src, link, sym, type.
// Waypoints that fail the licence guard are dropped and counted in a comment; tracks come only from lines that pass it.

export interface GpxSource {
  title: string;
  url: string;
  waypoints: ExportWaypoint[];
  lines: ExportLine[];
  /** Points already dropped upstream (the builder counts them too). */
  skipped?: number;
}

const typeOf = (w: ExportWaypoint) => (w.day ? `Day ${w.day} · ${w.kind}` : w.kind);

export function buildGpx(src: GpxSource): { xml: string; points: number; skipped: number; tracks: number } {
  const okWpts = src.waypoints.filter((w) => checkPoint(w.point).ok);
  const skipped = (src.skipped ?? 0) + (src.waypoints.length - okWpts.length);
  const tracks = src.lines.filter((l) => lineExportable(l) && l.geometry.length >= 2);
  const attribution = attributionFor(okWpts.map((w) => w.point), tracks);
  const desc = [`${src.title}: waypoints for stops, trailheads and parking.`, ...attribution].join(' ');
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="Trip Plans" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
    '<metadata>',
    `<name>${x(src.title)}</name>`,
    `<desc>${x(desc)}</desc>`,
    ...(attribution.some((a) => a.includes('OpenStreetMap'))
      ? ['<copyright author="OpenStreetMap contributors"><license>https://opendatacommons.org/licenses/odbl/1-0/</license></copyright>']
      : []),
    `<link href="${x(src.url)}"><text>${x(src.title)}</text></link>`,
    '</metadata>',
    `<!-- ${skipped} point${skipped === 1 ? '' : 's'} left out: source not ours to give -->`,
  ];
  for (const w of okWpts) {
    const note = [w.note, approxNote(w.point)].filter(Boolean).join('. ');
    out.push(
      `<wpt lat="${coord(w.point.lat)}" lon="${coord(w.point.lon)}">`,
      `<name>${x(w.name)}</name>`,
      ...(note ? [`<desc>${x(note)}</desc>`] : []),
      `<src>${x(w.point.pointSource)}</src>`,
      ...(w.url ? [`<link href="${x(w.url)}"><text>${x(w.name)}</text></link>`] : []),
      `<type>${x(typeOf(w))}</type>`,
      '</wpt>',
    );
  }
  for (const t of tracks) {
    out.push('<trk>', `<name>${x(t.label)}</name>`, `<src>${x(t.ref)}</src>`, '<trkseg>');
    for (const [lon, lat] of t.geometry) out.push(`<trkpt lat="${coord(lat)}" lon="${coord(lon)}"/>`);
    out.push('</trkseg>', '</trk>');
  }
  out.push('</gpx>');
  return { xml: out.join('\n') + '\n', points: okWpts.length, skipped, tracks: tracks.length };
}
