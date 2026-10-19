import { describe, expect, it } from 'vitest';
import { buildKml } from '@/lib/export/kml';
import type { ExportLine, ExportWaypoint } from '@/lib/export/types';
import { kids, parseXml } from './helpers';

const geometry: [number, number][] = [[12.2046, 46.5562], [12.2, 46.55], [12.19, 46.526]];
const open: ExportLine = { ref: 'osm_relation:3985745', label: 'OpenStreetMap relation 3985745, read 19 Oct 2026', exportable: true, licence: 'ODbL', geometry };
const held: ExportLine = { ref: 'osm_relation:2', label: 'OpenStreetMap relation 2, read 19 Oct 2026', exportable: false, licence: 'ODbL', geometry };
const wpt = (over: Partial<ExportWaypoint> = {}): ExportWaypoint => ({ id: 'w', name: 'Passo Tre Croci', kind: 'trailhead', role: 'trailhead', day: null, note: null, url: 'https://example.test/places/sorapis/', point: { lat: 46.5562, lon: 12.2046, pointSource: 'osm_node:1', pointChecked: null, sourceLicence: 'ODbL' }, ...over });
const base = { title: 'Lago di Sorapis', url: 'https://example.test/places/lago-di-sorapis/', waypoints: [wpt()] };

describe('KML with a stored OSM track', () => {
  it('writes a LineString with the notice in the document and on the placemark', () => {
    const out = buildKml({ ...base, lines: [open] });
    expect(out.tracks).toBe(1);
    const kml = parseXml(out.xml);
    const doc = kids(kml, 'Document')[0];
    expect(kids(doc, 'description')[0].text).toContain('ODbL 1.0');
    expect(kids(doc, 'description')[0].text).toContain('relation 3985745');
    const routes = kids(doc, 'Folder').find((f) => kids(f, 'name')[0].text === 'Routes')!;
    const pm = kids(routes, 'Placemark')[0];
    expect(kids(pm, 'description')[0].text).toContain('read 19 Oct 2026');
    expect(kids(kids(pm, 'LineString')[0], 'coordinates')[0].text.trim().split(' ')).toHaveLength(3);
  });
  it('leaves out a line that is not confirmed', () => {
    const out = buildKml({ ...base, lines: [held] });
    expect(out.tracks).toBe(0);
    expect(out.xml).not.toContain('LineString');
  });
});
