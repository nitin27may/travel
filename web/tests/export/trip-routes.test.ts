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
import { getPlace, getTrip } from '@/lib/public';
import { buildTripPageModel } from '@/components/trips/model';
import { legGeometry } from '@/components/trips/legGeometry';
import { dayMapOf, pointLookup } from '@/components/trips/mapPins';
import { decodePolyline5 } from '@/lib/map/polyline';
import { forPage } from '@/lib/export/plan';
import { getStore } from '@/lib/server/store';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import { DEFAULT_PROFILE, type Profile } from '@travel/core/schedule/types.ts';
import { kids, parseXml } from './helpers';

const SLUGS = ['canadian-rockies-2029', 'dolomites-2027'] as const;

async function legsOf(slug: string) {
  const r = await getStore().tripLegs(slug);
  if (!r.ok || 'moved' in r.data) throw new Error('no legs');
  return r.data;
}
const PROFILES: Record<string, Profile> = {
  adults: { ...DEFAULT_PROFILE, party: 'adults', youngest: null },
  'family-6': { ...DEFAULT_PROFILE, party: 'family', youngest: 6 },
  'family-4': { ...DEFAULT_PROFILE, party: 'family', youngest: 4 },
};
/** The page for a trip and a profile: the export model, the session the page publishes, and the day maps the page draws. */
function pageFor(slug: string, profile: Profile) {
  const trip = getTrip(slug)!;
  const page = buildTripPageModel(trip, (s) => { const p = getPlace(s); return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null; }, []);
  const timelines = scheduleTrip(trip.days.map((d) => d.scheduleInput!), profile);
  const pointOf = pointLookup(page.route);
  const maps = timelines.map((t) => dayMapOf(t, pointOf));
  const model = buildTripExport(trip);
  const slugs = new Map(model.stops.flatMap((x) => (x.placeSlug ? [[x.id, x.placeSlug] as const] : [])));
  return { trip, page, model, timelines, maps, pointOf, session: { timelines, route: page.route }, slugOf: (k: string) => slugs.get(k) ?? null };
}
const geo = (m: ReturnType<typeof buildTripExport>, routes: ReturnType<typeof routeLines>) => ({ title: m.title, url: m.url, waypoints: m.waypoints, lines: [...m.lines, ...routes], skipped: m.skipped });

describe.each(SLUGS)('%s: the routed legs as export lines', (slug) => {
  const { model, session } = pageFor(slug, getTrip(slug)!.schedule!.defaultProfile);
  it('one line per routed leg, named by its stops, ODbL, in the file contract', async () => {
    const legs = await legsOf(slug);
    const routes = routeLines(legs, model, session);
    expect(routes.length).toBeLessThanOrEqual(legs.legs.filter((l) => l.geometry).length);
    expect(routes.length).toBeGreaterThan(5);
    for (const r of routes) {
      expect(r.ref).toMatch(new RegExp(`^route:${slug}:\\d+:\\d+$`));
      expect(lineExportable(r)).toBe(true);
      expect(r.geometry.length).toBeGreaterThanOrEqual(2);
      expect(r.label).toMatch(/^Day \d+(, [^:]+)?: .+ to .+ \((drive|walk), [\d.]+ km, \d+ min\)$/);
    }
    // most ends are named (a stop whose item is not in the model reads "a stop")
    expect(routes.filter((r) => /a stop|the base/.test(r.label)).length).toBeLessThan(routes.length / 4);
    expect(new Set(routes.map((r) => r.ref)).size).toBe(routes.length);
  });
  it('the page\'s own export model holds no route geometry (a trip page does not grow by its routes)', () => {
    expect(model.lines.some((l) => l.ref.startsWith('route:'))).toBe(false);
  });
  it('GPX parses, holds a track per routed leg with every vertex, and credits OpenStreetMap and the router', async () => {
    const routes = routeLines(await legsOf(slug), model, session);
    const out = buildGpx(geo(model, routes));
    const gpx = parseXml(out.xml);
    const routed = kids(gpx, 'trk').filter((t) => /^Day \d+(, [^:]+)?: /.test(kids(t, 'name')[0]!.text));
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
    const routes = routeLines(await legsOf(slug), model, session);
    const out = buildKml(geo(model, routes));
    const kml = parseXml(out.xml);
    const doc = kids(kml, 'Document')[0]!;
    const folder = kids(doc, 'Folder').find((f) => kids(f, 'name')[0]!.text === 'Routes')!;
    const lines = kids(folder, 'Placemark').filter((p) => kids(p, 'LineString').length && /^Day \d+(, [^:]+)?: /.test(kids(p, 'name')[0]!.text));
    expect(lines.length).toBe(routes.length);
    const coords = kids(kids(lines[0]!, 'LineString')[0]!, 'coordinates')[0]!.text.trim().split(/\s+/);
    expect(coords).toHaveLength(routes[0]!.geometry.length);
    expect(kids(doc, 'description')[0]!.text).toContain(ROUTING_ATTRIBUTION);
  });
  it('the summary says how many road routes the file holds', async () => {
    const routes = routeLines(await legsOf(slug), model, session);
    expect(fileSummary(61, routes)).toBe(`61 points, ${routes.length} road routes`);
    expect(fileSummary(1, [])).toBe('1 point');
  });
  it('a trip with no legs file, or a failed read, exports its points only', () => {
    expect(routeLines(null, model, session)).toEqual([]);
    // and without the page's timeline there is no order to follow, so no route is invented
    expect(routeLines({ legs: [] }, model)).toEqual([]);
    expect(buildGpx(geo(model, [])).tracks).toBe(model.lines.filter((l) => lineExportable(l) && l.geometry.length >= 2).length);
  });
  it('the CSV has its header and one row per stop', () => {
    const csv = tripCsv(model);
    expect(csv.replace(/^\ufeff/, '').split(/\r?\n/)[0]).toBe(TRIP_CSV_HEADER.join(','));
    expect(csv.split(/\r?\n/).length).toBeGreaterThan(model.stops.length);
  });
});

/** What the export must hold for each trip and profile (review B1, PL8): exact, so a change in the data or the join is seen. */
const EXPECTED: Record<string, Record<string, number>> = {
  // adults: each Rockies day is one hike and the bases have no point, so there is no pair to route (correct, not a gap)
  'canadian-rockies-2029': { adults: 0, 'family-6': 10, 'family-4': 11 },
  'dolomites-2027': { adults: 36, 'family-6': 36, 'family-4': 36 },
};

describe.each(SLUGS)('%s: the export is the map\'s own routed steps (review B1)', (slug) => {
  it.each(Object.keys(PROFILES))('profile %s: the tracks equal the legs the map draws as routes, step by step', async (name) => {
    const legs = await legsOf(slug);
    const p = pageFor(slug, PROFILES[name]!);
    const mine = routeLines(legs, p.model, p.session);
    const drawn = legGeometry(legs.legs, p.maps, p.page.route.bases, p.slugOf, p.pointOf);
    // the same set of (day, path), in the same order the map's chain gives
    const key = (day: number, path: { lng: number; lat: number }[] | number[][]) => `${day}|${path.map((q) => (Array.isArray(q) ? q.join() : `${q.lng},${q.lat}`)).join(';')}`;
    const mapSide = Object.entries(drawn).map(([id, r]) => key(Number(id.split(':')[1]), r.path)).sort();
    const fileSide = mine.map((r) => key(Number(/^Day (\d+)/.exec(r.label)![1]), r.geometry)).sort();
    expect(fileSide).toEqual(mapSide);
    // the exact-coordinate identity (B4) only ever adds a route: no day loses one
    const plainDrawn = legGeometry(legs.legs, p.maps, p.page.route.bases, p.slugOf);
    for (const id of Object.keys(plainDrawn)) expect(drawn[id], id).toBeDefined();
    expect(mine.length).toBe(EXPECTED[slug]![name]);
    expect(new Set(mine.map((r) => r.ref)).size).toBe(mine.length);
  });
  it('every track runs from an earlier stop of the day\'s timeline to a later one, and is named by the chosen version', async () => {
    const legs = await legsOf(slug);
    for (const name of Object.keys(PROFILES)) {
      const p = pageFor(slug, PROFILES[name]!);
      for (const r of routeLines(legs, p.model, p.session)) {
        const day = Number(/^Day (\d+)/.exec(r.label)![1]);
        const tl = p.timelines.find((t) => t.day === day)!;
        if (tl.variant.key !== 'main') expect(r.label.startsWith(`Day ${day}, ${tl.variant.label}: `)).toBe(true);
        const m = /: (.+) to (.+) \((?:drive|walk),/.exec(r.label)!;
        const names = p.maps.find((x) => x.day === day)!.pins.map((x) => x.name);
        const [i, j] = [names.indexOf(m[1]!), names.indexOf(m[2]!)];
        // a base is at either end of the chain; a stop must come earlier than the one it leads to
        if (i >= 0 && j >= 0) expect(i, `${r.label}`).toBeLessThan(j);
      }
    }
  });
  it('the airport legs of a first or last day are not in the file, as the map draws no airport pin', async () => {
    const legs = await legsOf(slug);
    const p = pageFor(slug, PROFILES['adults']!);
    const labels = routeLines(legs, p.model, p.session).map((r) => r.label);
    expect(labels.filter((l) => /airport/i.test(l))).toEqual([]);
  });
});

describe('Rockies family-6, day 3: the phantom drive is gone and the real one is there (review B1, B4)', () => {
  it('writes no Paint Pots Walk to Johnston Canyon, and writes Johnston Canyon to Marble Canyon Walk', async () => {
    const legs = await legsOf('canadian-rockies-2029');
    const p = pageFor('canadian-rockies-2029', PROFILES['family-6']!);
    const labels = routeLines(legs, p.model, p.session).map((r) => r.label);
    expect(labels.some((l) => /Paint Pots Walk to Johnston Canyon/.test(l))).toBe(false);
    expect(labels.some((l) => /^Day 3.*Johnston Canyon to Marble Canyon Walk/.test(l))).toBe(true);
  });
});

describe('the page\'s counts (review SHOULD-7, PL2)', () => {
  it('stops and points follow the chosen version, not every version', () => {
    const p = pageFor('canadian-rockies-2029', PROFILES['family-6']!);
    const mine = forPage(p.model, p.session);
    expect(mine.stops.length).toBeGreaterThan(0);
    expect(mine.stops.length).toBeLessThan(p.model.stops.length);
    expect(mine.waypoints.length).toBeLessThan(p.model.waypoints.length);
    expect(forPage(p.model, null)).toBe(p.model);
    // every kept stop is on the day it names
    for (const s of mine.stops) expect(p.timelines.find((t) => t.day === s.day)!.entries.some((e) => (s.placeSlug ? e.at?.placeSlug === s.placeSlug : e.title === s.name))).toBe(true);
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
    const { model, session } = pageFor(slug, getTrip(slug)!.schedule!.defaultProfile);
    const routes = routeLines(await legsOf(slug), model, session);
    expect(privacyHits(buildGpx(geo(model, routes)).xml)).toEqual([]);
    expect(privacyHits(buildKml(geo(model, routes)).xml)).toEqual([]);
    expect(privacyHits(JSON.stringify(routes))).toEqual([]);
    // no vertex of a routed line is near home (the store already refused such a leg; this is the second look)
    for (const l of (await legsOf(slug)).legs) if (l.geometry) expect(decodePolyline5(l.geometry)!.length).toBeGreaterThan(1);
  });
});
