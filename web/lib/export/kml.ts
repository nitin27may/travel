import type { GpxSource } from './gpx';
import { attributionFor, checkPoint, lineExportable } from './licence';
import { coord, x } from './xml';

// KML 2.2 for Google Earth and My Maps: one folder per day, then one for places without a day. Same guard as GPX.

export function buildKml(src: GpxSource): { xml: string; points: number; skipped: number; tracks: number } {
  const ok = src.waypoints.filter((w) => checkPoint(w.point).ok);
  const skipped = (src.skipped ?? 0) + (src.waypoints.length - ok.length);
  const tracks = src.lines.filter((l) => lineExportable(l) && l.geometry.length >= 2);
  const attribution = attributionFor(ok.map((w) => w.point), tracks);
  const days = [...new Set(ok.map((w) => w.day))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '<Document>',
    `<name>${x(src.title)}</name>`,
    `<description>${x([`${src.title}: ${src.url}`, ...attribution].join('\n'))}</description>`,
    `<!-- ${skipped} point${skipped === 1 ? '' : 's'} left out: source not ours to give -->`,
  ];
  for (const d of days) {
    out.push('<Folder>', `<name>${d ? `Day ${d}` : 'Places'}</name>`);
    for (const w of ok.filter((p) => p.day === d)) {
      out.push(
        '<Placemark>',
        `<name>${x(w.name)}</name>`,
        `<description>${x([w.kind, w.note, w.url].filter(Boolean).join(' · '))}</description>`,
        `<Point><coordinates>${coord(w.point.lon)},${coord(w.point.lat)},0</coordinates></Point>`,
        '</Placemark>',
      );
    }
    out.push('</Folder>');
  }
  if (tracks.length) {
    out.push('<Folder>', '<name>Routes</name>');
    for (const t of tracks) {
      out.push('<Placemark>', `<name>${x(t.label)}</name>`, `<LineString><coordinates>${t.geometry.map(([lo, la]) => `${coord(lo)},${coord(la)},0`).join(' ')}</coordinates></LineString>`, '</Placemark>');
    }
    out.push('</Folder>');
  }
  out.push('</Document>', '</kml>');
  return { xml: out.join('\n') + '\n', points: ok.length, skipped, tracks: tracks.length };
}
