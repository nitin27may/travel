import { describe, expect, it } from 'vitest';
import { buildGpx } from '@/lib/export/gpx';
import type { ExportLine, ExportWaypoint } from '@/lib/export/types';
import { kids, parseXml } from './helpers';

const geometry: [number, number][] = [[12.2046, 46.5562], [12.2, 46.55], [12.19, 46.526]];
const open: ExportLine = { ref: 'osm_relation:3985745', label: 'OpenStreetMap relation 3985745, read 19 Oct 2026', exportable: true, licence: 'ODbL', geometry };
const held: ExportLine = { ref: 'osm_relation:2', label: 'OpenStreetMap relation 2, read 19 Oct 2026', exportable: false, licence: 'ODbL', geometry };
const wpt = (over: Partial<ExportWaypoint> = {}): ExportWaypoint => ({ id: 'w', name: 'Passo Tre Croci', kind: 'trailhead', role: 'trailhead', day: null, note: null, url: 'https://example.test/places/sorapis/', point: { lat: 46.5562, lon: 12.2046, pointSource: 'osm_node:1', pointChecked: null, sourceLicence: 'ODbL' }, ...over });
const base = { title: 'Lago di Sorapis', url: 'https://example.test/places/lago-di-sorapis/', waypoints: [wpt()] };

describe('GPX with a stored OSM track', () => {
  it('writes the track with the ODbL notice, the relation id and the read date in the header and on the track', () => {
    const out = buildGpx({ ...base, lines: [open] });
    expect(out.tracks).toBe(1);
    const gpx = parseXml(out.xml);
    const meta = kids(gpx, 'metadata')[0];
    const desc = kids(meta, 'desc')[0].text;
    expect(desc).toContain('ODbL 1.0');
    expect(desc).toContain('relation 3985745');
    expect(desc).toContain('read 19 Oct 2026');
    expect(kids(meta, 'copyright')[0].attrs.author).toBe('OpenStreetMap contributors');
    const trk = kids(gpx, 'trk')[0];
    expect(kids(trk, 'cmt')[0].text).toContain('ODbL');
    expect(kids(kids(trk, 'trkseg')[0], 'trkpt')).toHaveLength(3);
  });
  it('leaves out a line that is not confirmed, and says nothing of it', () => {
    const out = buildGpx({ ...base, lines: [held] });
    expect(out.tracks).toBe(0);
    expect(out.xml).not.toContain('<trk>');
    expect(out.xml).not.toContain('relation 2');
  });
  it('drops a waypoint that fails the licence guard and counts it', () => {
    const bad = wpt({ id: 'g', name: 'From Google', point: { lat: 46.5, lon: 12.2, pointSource: 'google_maps', pointChecked: null, sourceLicence: 'Google' } });
    const out = buildGpx({ ...base, waypoints: [wpt(), bad], lines: [open] });
    expect(out.skipped).toBe(1);
    expect(out.xml).not.toContain('From Google');
    expect(out.xml).toContain('<!-- 1 point left out: source not ours to give -->');
  });
});

describe('the Sorapis place export carries its confirmed track (backlog 3.32)', () => {
  it('has geometry on the exported line and a track in the GPX', async () => {
    const { buildPlaceExport } = await import('@/lib/export/build.server');
    const { getPlace, placeSlugs } = await import('@/lib/public');
    const slug = placeSlugs().find((s) => /sorapis/.test(s))!;
    const place = getPlace(slug)!;
    const ex = buildPlaceExport(place);
    const confirmed = ex.lines.filter((l) => l.exportable);
    expect(confirmed.length).toBeGreaterThan(0);
    expect(confirmed.some((l) => l.geometry.length > 2)).toBe(true);
    const gpx = buildGpx({ title: ex.title, url: ex.url, waypoints: ex.waypoints, lines: ex.lines, skipped: ex.skipped });
    expect(gpx.tracks).toBeGreaterThan(0);
    expect(gpx.xml).toContain('<trk>');
  });
});
