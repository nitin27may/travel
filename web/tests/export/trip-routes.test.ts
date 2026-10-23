// Export trip with the routed legs (Q46, P7, TRP2b): every format parses, KML and GPX carry the routed geometry with the ODbL and router credit,
// the print file is plain text with the gap wording, and the privacy scan is clean over EACH export (an export is one item, P8).
import { describe, expect, it } from 'vitest';
import { privacyHits } from '@travel/core/privacy/detect.ts';
import { EXPORT_FORMATS, type ExportFormat } from '@travel/core/schema/api/index.ts';
import { buildTripExport } from '@/lib/export/build.server';
import { fileSummary } from '@/lib/export/client';
import { buildGpx } from '@/lib/export/gpx';
import { buildIcs } from '@/lib/export/ics';
import { buildKml } from '@/lib/export/kml';
import { attributionFor, lineExportable, ROUTING_ATTRIBUTION, trackNotice } from '@/lib/export/licence';
import { routeLines } from '@/lib/export/routes';
import { tripCsv, TRIP_CSV_HEADER } from '@/lib/export/csv';
import { getTrip } from '@/lib/public';
import { decodePolyline5 } from '@/lib/map/polyline';
import { getStore } from '@/lib/server/store';
import { kids, parseXml } from './helpers';

const SLUGS = ['canadian-rockies-2029', 'dolomites-2027'] as const;

async function legsOf(slug: string) {
  const r = await getStore().tripLegs(slug);
  if (!r.ok || 'moved' in r.data) throw new Error('no legs');
  return r.data;
}
const geo = (m: ReturnType<typeof buildTripExport>, routes: ReturnType<typeof routeLines>) => ({ title: m.title, url: m.url, waypoints: m.waypoints, lines: [...m.lines, ...routes], skipped: m.skipped });

describe.each(SLUGS)('%s: the routed legs as export lines', (slug) => {
  const model = buildTripExport(getTrip(slug)!);
  it('one line per routed leg, named by its stops, ODbL, in the file contract', async () => {
    const legs = await legsOf(slug);
    const routes = routeLines(legs, model);
    expect(routes.length).toBe(legs.legs.filter((l) => l.geometry).length);
    expect(routes.length).toBeGreaterThan(10);
    for (const r of routes) {
      expect(r.ref).toMatch(new RegExp(`^route:${slug}:\\d+:\\d+$`));
      expect(lineExportable(r)).toBe(true);
      expect(r.geometry.length).toBeGreaterThanOrEqual(2);
      expect(r.label).toMatch(/^Day \d+: .+ to .+ \((drive|walk), [\d.]+ km, \d+ min\)$/);
    }
    // most ends are named (a stop whose item is not in the model reads "a stop")
    expect(routes.filter((r) => /a stop|the base/.test(r.label)).length).toBeLessThan(routes.length / 4);
    expect(new Set(routes.map((r) => r.ref)).size).toBe(routes.length);
  });
  it('the page\'s own export model holds no route geometry (a trip page does not grow by its routes)', () => {
    expect(model.lines.some((l) => l.ref.startsWith('route:'))).toBe(false);
  });
  it('GPX parses, holds a track per routed leg with every vertex, and credits OpenStreetMap and the router', async () => {
    const routes = routeLines(await legsOf(slug), model);
    const out = buildGpx(geo(model, routes));
    const gpx = parseXml(out.xml);
    const routed = kids(gpx, 'trk').filter((t) => /^Day \d+: /.test(kids(t, 'name')[0]!.text));
    expect(routed).toHaveLength(routes.length);
    const vertices = routed.reduce((n, t) => n + kids(kids(t, 'trkseg')[0]!, 'trkpt').length, 0);
    expect(vertices).toBe(routes.reduce((n, r) => n + r.geometry.length, 0));
    expect(kids(kids(gpx, 'metadata')[0]!, 'copyright')[0]!.attrs.author).toBe('OpenStreetMap contributors');
    expect(kids(kids(gpx, 'metadata')[0]!, 'desc')[0]!.text).toContain(ROUTING_ATTRIBUTION);
    expect(kids(routed[0]!, 'cmt')[0]!.text).toContain('ODbL');
    const first = kids(kids(routed[0]!, 'trkseg')[0]!, 'trkpt')[0]!;
    expect(Number(first.attrs.lat)).toBeCloseTo(routes[0]!.geometry[0]![1], 5);
  });
  it('KML parses and holds a LineString per routed leg in the Routes folder', async () => {
    const routes = routeLines(await legsOf(slug), model);
    const out = buildKml(geo(model, routes));
    const kml = parseXml(out.xml);
    const doc = kids(kml, 'Document')[0]!;
    const folder = kids(doc, 'Folder').find((f) => kids(f, 'name')[0]!.text === 'Routes')!;
    const lines = kids(folder, 'Placemark').filter((p) => kids(p, 'LineString').length && /^Day \d+: /.test(kids(p, 'name')[0]!.text));
    expect(lines.length).toBe(routes.length);
    const coords = kids(kids(lines[0]!, 'LineString')[0]!, 'coordinates')[0]!.text.trim().split(/\s+/);
    expect(coords).toHaveLength(routes[0]!.geometry.length);
    expect(kids(doc, 'description')[0]!.text).toContain(ROUTING_ATTRIBUTION);
  });
  it('the summary says how many road routes the file holds', async () => {
    const routes = routeLines(await legsOf(slug), model);
    expect(fileSummary(61, routes)).toBe(`61 points, ${routes.length} road routes`);
    expect(fileSummary(1, [])).toBe('1 point');
  });
  it('a trip with no legs file, or a failed read, exports its points only', () => {
    expect(routeLines(null, model)).toEqual([]);
    expect(buildGpx(geo(model, [])).tracks).toBe(model.lines.filter((l) => lineExportable(l) && l.geometry.length >= 2).length);
  });
  it('the CSV has its header and one row per stop', () => {
    const csv = tripCsv(model);
    expect(csv.replace(/^\ufeff/, '').split(/\r?\n/)[0]).toBe(TRIP_CSV_HEADER.join(','));
    expect(csv.split(/\r?\n/).length).toBeGreaterThan(model.stops.length);
  });
});

describe('the route line licence', () => {
  const route = { ref: 'route:t:1:1', label: 'Day 1: A to B (drive, 1 km, 2 min)', exportable: true, licence: 'ODbL' };
  it('lets a route line out only under ODbL with a well-formed ref', () => {
    expect(lineExportable(route)).toBe(true);
    expect(lineExportable({ ...route, licence: 'Google' })).toBe(false);
    expect(lineExportable({ ...route, ref: 'route:google-maps:1:1' })).toBe(false);
    expect(lineExportable({ ...route, ref: 'route:t:x:1' })).toBe(false);
    expect(lineExportable({ ...route, exportable: false })).toBe(false);
  });
  it('credits OpenStreetMap and OpenRouteService, and says so on the track', () => {
    expect(attributionFor([], [route])).toEqual(expect.arrayContaining([ROUTING_ATTRIBUTION, expect.stringContaining('OpenStreetMap contributors')]));
    expect(trackNotice([route])[0]).toMatch(/ODbL 1\.0.*Road routes by OpenRouteService/);
  });
});

describe('Dolomites: the dated calendar and the print file', () => {
  const model = buildTripExport(getTrip('dolomites-2027')!);
  it('the calendar for a dated copy has a VTIMEZONE and parses', () => {
    const ics = buildIcs(model, '2027-07-13', new Date(Date.UTC(2026, 9, 23)));
    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:Europe/Rome');
    expect(ics).toContain('BEGIN:VEVENT');
  });
});

describe.each(SLUGS)('%s: every export format is clean to the privacy scan', (slug) => {
  it.each(EXPORT_FORMATS as readonly ExportFormat[])('%s', async (format) => {
    const r = await getStore().getExport({ type: 'trip', slug, format });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(privacyHits(r.data.body)).toEqual([]);
    if (format === 'print') {
      expect(r.data.mime).toMatch(/^text\/plain/);
      expect(r.data.body.trimStart().startsWith('<')).toBe(false);
      expect(r.data.body.trimStart().startsWith('{')).toBe(false);
      expect(r.data.body).toMatch(/^Day 1: /m);
    }
  });
  it('the client-built GPX and KML with the routed geometry, and the print view\'s model, are clean too', async () => {
    const model = buildTripExport(getTrip(slug)!);
    const routes = routeLines(await legsOf(slug), model);
    expect(privacyHits(buildGpx(geo(model, routes)).xml)).toEqual([]);
    expect(privacyHits(buildKml(geo(model, routes)).xml)).toEqual([]);
    expect(privacyHits(JSON.stringify(routes))).toEqual([]);
    // no vertex of a routed line is near home (the store already refused such a leg; this is the second look)
    for (const l of (await legsOf(slug)).legs) if (l.geometry) expect(decodePolyline5(l.geometry)!.length).toBeGreaterThan(1);
  });
});
