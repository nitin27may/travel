import { describe, expect, it } from 'vitest';
import { attributionFor, checkPoint, lineExportable, OSM_ATTRIBUTION } from '@/lib/export/licence';

const p = (pointSource: string, sourceLicence: string) => ({ pointSource, sourceLicence });

describe('licence guard: points', () => {
  it('lets an OSM point out with the ODbL attribution', () => {
    const v = checkPoint(p('osm_node:9812786780', 'ODbL'));
    expect(v).toEqual({ ok: true, attribution: OSM_ATTRIBUTION, approximate: false });
  });
  it('refuses an OSM point whose licence is not ODbL', () => {
    expect(checkPoint(p('osm_way:1', 'unknown')).ok).toBe(false);
  });
  it('lets an official Parks Canada point out under an open licence, and keeps the source in the attribution', () => {
    const v = checkPoint(p('official:https://open.canada.ca/data/parks-canada-trails', 'OGL-Canada'));
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.attribution).toContain('open.canada.ca');
  });
  it('refuses an official source with no open licence', () => {
    expect(checkPoint(p('official:https://example.org/trails', 'unknown')).ok).toBe(false);
    expect(checkPoint(p('official:https://example.org/trails', 'all rights reserved')).ok).toBe(false);
  });
  it('refuses a Commons-only photo location: a geotag carries the photo licence, not a place coordinate', () => {
    expect(checkPoint(p('commons:File:Lago_di_Braies.jpg', 'CC-BY-SA-4.0')).ok).toBe(false);
  });
  it('refuses a Google-sourced point, however it is spelled, and an empty or unknown source', () => {
    for (const src of ['google_maps', 'google:place_id:ChIJxyz', 'gmaps_pin', 'https://maps.google.com/?q=1,2', 'bing:1', 'apple_maps', '', 'whatever']) {
      expect(checkPoint(p(src, 'own')).ok, src).toBe(false);
    }
    expect(checkPoint(p('osm_node:1', 'Google Maps Platform Terms')).ok).toBe(false);
    expect(checkPoint(null).ok).toBe(false);
  });
  it('lets our own pins out, and flags the approximate ones', () => {
    expect(checkPoint(p('manual_pin', 'own'))).toMatchObject({ ok: true, approximate: false });
    expect(checkPoint(p('prototype_approx', 'own'))).toMatchObject({ ok: true, approximate: true });
  });
  it('credits OSM once, never credits approximate pins, and lists official sources', () => {
    const list = attributionFor([p('osm_node:1', 'ODbL'), p('osm_way:2', 'ODbL'), p('prototype_approx', 'own'), p('google', 'own')]);
    expect(list).toEqual([OSM_ATTRIBUTION]);
  });
});

describe('licence guard: lines', () => {
  it('exports an OSM-derived line LD marked exportable', () => {
    expect(lineExportable({ ref: 'osm_relation:2442695', exportable: true, licence: 'ODbL' })).toBe(true);
  });
  it('never exports a line LD did not mark exportable', () => {
    expect(lineExportable({ ref: 'osm_relation:2442695', exportable: false, licence: 'ODbL' })).toBe(false);
  });
  it('refuses Google-derived and unknown-source lines even when marked exportable', () => {
    expect(lineExportable({ ref: 'google_directions:abc', exportable: true, licence: 'unknown' })).toBe(false);
    expect(lineExportable({ ref: 'alltrails:123', exportable: true, licence: 'unknown' })).toBe(false);
    expect(lineExportable({ ref: 'osm_relation:1', exportable: true, licence: 'Google' })).toBe(false);
  });
});
