import { describe, expect, it } from 'vitest';
import { createPublicData } from '@/lib/public';
import { loadSources } from '@/lib/public/sources';
import { loadTracks, profileOf, totalsDiffer, withTrack, type TrackFile } from '@/lib/public/tracks';
import { trailSeeds } from '@/lib/public/trail-places';
import type { PlaceLine } from '@/lib/public/types';
import { REPO, fixtureRoot, manifestWith, realData } from '../data/support';

const line = (over: Partial<PlaceLine> = {}): PlaceLine => ({ ref: 'osm_relation:1', label: 'rel 1', source: 'x', exportable: true, ...over });
const track = (over: Partial<TrackFile> = {}): TrackFile => ({
  schema: 'trail-track/1', place: 'x', osm: ['relation:1'], fetched: '2026-10-19', source: 'overpass', licence: 'ODbL-1.0', attribution: '© OpenStreetMap contributors',
  stitched: true, confirmed: true, start_offset_m: 10, totals: { km: 1, gain_m: 20, loss_m: 5, high_m: 1600, low_m: 1500 }, dem: 'AWS Terrain Tiles',
  geometry: [[11, 46], [11.01, 46.01]], elevation: [[0, 1500], [25, 1510], [1000, 1600]], ...over,
});

describe('a stored track on a place line', () => {
  it('puts geometry, the profile and the credit on the first line and keeps it exportable when confirmed', () => {
    const [l] = withTrack([line()], track(), false);
    expect(l.geometry).toHaveLength(2);
    expect(l.dashed).toBe(false);
    expect(l.exportable).toBe(true);
    expect(l.profile?.samples[1]).toEqual([0.025, 1510]);
    expect(l.credit).toContain('© OpenStreetMap contributors');
    expect(l.credit).toContain('19 Oct 2026');
    expect(l.label).toBe('OpenStreetMap relation 1, read 19 Oct 2026');
  });
  it('draws a held-back track dashed and keeps it out of the export', () => {
    const [l] = withTrack([line()], track({ confirmed: false, held_back: ['starts 900 m from our trailhead'] }), false);
    expect(l.dashed).toBe(true);
    expect(l.exportable).toBe(false);
    expect(l.geometry).toHaveLength(2);
  });
  it('lets the adapter list win over the stored flag', () => {
    expect(withTrack([line()], track({ confirmed: true }), true)[0].exportable).toBe(false);
  });
  it('draws pieces of a relation that did not stitch and gives no profile', () => {
    const [l] = withTrack([line()], track({ stitched: false, confirmed: false, geometry: [], segments: [[[11, 46], [11.1, 46]], [[11.2, 46], [11.3, 46]]], elevation: [], totals: { km: 2, gain_m: null, loss_m: null, high_m: null, low_m: null } }), false);
    expect(l.geometry).toBeUndefined();
    expect(l.segments).toHaveLength(2);
    expect(l.dashed).toBe(true);
    expect(l.profile).toBeNull();
  });
  it('leaves a place with no track alone', () => {
    const lines = [line()];
    expect(withTrack(lines, undefined, false)).toBe(lines);
    expect(profileOf(track({ elevation: [] }))).toBeNull();
  });
  it('flags totals that differ from the researched ones by more than 10%', () => {
    expect(totalsDiffer(8.1, 640, 8, 700)).toBe(false);
    expect(totalsDiffer(11, 1388, 11, 550)).toBe(true);
    expect(totalsDiffer(11, null, 7.5, null)).toBe(true);
    expect(totalsDiffer(5, 100, null, null)).toBe(false);
  });
});

describe('the committed tracks', () => {
  const tracks = loadTracks(REPO);
  const data = realData();
  it('are all trail-track/1 with the ODbL credit and at most 2,000 points', () => {
    expect(tracks.size).toBeGreaterThanOrEqual(17);
    for (const [id, t] of tracks) {
      expect(t.licence, id).toBe('ODbL-1.0');
      expect(t.attribution, id).toMatch(/OpenStreetMap/);
      expect(t.geometry.length, id).toBeLessThanOrEqual(2000);
      if (t.stitched) expect(t.elevation.length, id).toBeGreaterThan(2);
    }
  });
  it('reach the place pages as lines with geometry, and a page shows both figures when they differ', () => {
    const withGeometry = data.internals.places.filter((p) => p.lines.some((l) => l.geometry || l.segments));
    expect(withGeometry.length).toBe(tracks.size);
    const sorapis = data.getPlace('lago-di-sorapis')!;
    const l = sorapis.lines[0];
    expect(l.exportable).toBe(true);
    expect(l.dashed).toBe(false);
    expect(sorapis.facts.find((f) => f.label === 'Track')?.provenance).toMatch(/OpenStreetMap/);
  });
  it('hold back what the unconfirmed list names, dashed and out of export', () => {
    for (const slug of ['seceda-ridge', 'cascate-di-fanes']) {
      const p = data.getPlace(slug);
      if (!p) continue;
      for (const l of p.lines) expect(l.exportable, slug).toBe(false);
    }
  });
  it('are never in a list card or search row (P8)', () => {
    for (const c of data.listPlaces()) {
      expect(c, c.slug).not.toHaveProperty('lines');
      expect(JSON.stringify(c)).not.toContain('"geometry"');
    }
  });
});

describe('trail pages for every trail of a public trip', () => {
  const data = realData();
  it('has a page for every trail route of every public trip, built from the capture records', () => {
    const src = loadSources();
    const seeds = trailSeeds(src);
    const names = new Set(data.internals.places.map((p) => p.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim()));
    expect(seeds.length).toBeGreaterThan(90);
    for (const s of seeds) expect(names.has(s.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim()), s.name).toBe(true);
    const trips = new Set(seeds.map((s) => s.tripFolder));
    for (const f of ['canadian-rockies-sept-2029', 'patagonia-feb-mar-2027', 'iceland-ring-road', 'chamonix-mont-blanc-sept-2028', 'dolomites-july-2027', 'usa-southwest-rockies', 'vermont-fall-2026', 'algonquin-muskoka-oct-2026']) expect(trips.has(f), f).toBe(true);
  });
  it('builds no trail page for a trip marked private (fails closed)', () => {
    const root = fixtureRoot(manifestWith({ 'patagonia-feb-mar-2027': { private: true }, 'vermont-fall-2026': { visibility: 'private' } }));
    const seeds = trailSeeds(loadSources({ root }));
    expect(seeds.some((s) => s.tripFolder === 'patagonia-feb-mar-2027')).toBe(false);
    expect(seeds.some((s) => s.tripFolder === 'vermont-fall-2026')).toBe(false);
    expect(seeds.some((s) => s.tripFolder === 'canadian-rockies-sept-2029')).toBe(true);
    const names = createPublicData({ root }).internals.places.map((p) => p.name);
    expect(names).not.toContain('Laguna de los Tres');
    expect(names).not.toContain('Stowe Recreation Path');
  });
  it('keeps slugs unique and stable across two builds, and leaves existing slugs alone', () => {
    const again = createPublicData();
    const a = data.placeSlugs();
    expect(again.placeSlugs()).toEqual(a);
    expect(new Set(a).size).toBe(a.length);
    for (const slug of ['lago-di-braies', 'seceda-ridge', 'tre-cime-di-lavaredo-loop']) expect(a).toContain(slug);
  });
  it('links the Rockies trails named in the itinerary to their pages, except where a sight or adventure has the same name', () => {
    const t = data.getTrip('canadian-rockies-2029')!;
    const items = t.days.flatMap((d) => d.items).filter((i) => i.kind === 'trail');
    expect(items.length).toBeGreaterThan(20);
    const ambiguous = new Set(trailSeeds(loadSources()).filter((s) => s.ambiguous).map((s) => s.name));
    const unlinked = items.filter((i) => !i.placeSlug).map((i) => i.name);
    for (const n of unlinked) expect(ambiguous.has(n), n).toBe(true);
    expect(items.length - unlinked.length).toBeGreaterThan(20);
  });
  it('gives a trail its full link list and says "none found" only where the research recorded it', () => {
    const p = data.getPlace('larch-valley-to-sentinel-pass')!;
    const kinds = p.links.flatMap((g) => g.links.map((l) => l.kind));
    expect(kinds).toContain('official');
    expect(kinds).toContain('alltrails');
    expect(p.links.flatMap((g) => g.links).find((l) => l.kind === 'alltrails')?.linkOnly).toBe(true);
    expect(p.facts.find((f) => f.label === 'Distance')?.value).toBe('11.2 km');
    expect(p.point).toBeNull();
  });
  it('carries no date, household value or link-only value on the new pages', () => {
    const DATE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/;
    for (const p of data.internals.places.filter((x) => x.sources.length === 1 && x.sources[0] === 'trail' && x.kind === 'trail')) {
      for (const f of p.facts) {
        expect(f.value, `${p.slug}: ${f.label}`).not.toMatch(DATE);
        expect(`${f.value} ${f.provenance}`, `${p.slug}: ${f.label}`).not.toMatch(/alltrails|komoot|google|tripadvisor|wikiloc|strava/i);
      }
      expect(p.seasonNote ?? '', p.slug).not.toMatch(DATE);
    }
  });
});
