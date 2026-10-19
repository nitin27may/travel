import { describe, expect, it } from 'vitest';
import {
  checkTracks, collectInputs, decodeTerrarium, formatTrack, haversine, lengthConsistent, lengthM, osmRefsOf, resample, simplifyLine, stitchWays, totalsFromSamples, unconfirmedIds, waysFromOsmApi, waysFromOverpass,
  type TrackFile,
} from '../../scripts/tracks-osm.mjs';

type P = [number, number];
const way = (...pts: P[]) => pts;

describe('stitching the ways of a relation', () => {
  it('joins three ways in mixed directions into one ordered line', () => {
    const a = way([0, 0], [0.001, 0], [0.002, 0]);
    const b = way([0.004, 0], [0.003, 0], [0.002, 0]); // runs towards a's end
    const c = way([0.004, 0], [0.005, 0], [0.006, 0]);
    const { lines, stitched } = stitchWays([b, a, c]);
    expect(stitched).toBe(true);
    expect(lines).toHaveLength(1);
    const line = lines[0];
    const ends = [line[0], line[line.length - 1]].sort((p, q) => p[0] - q[0]);
    expect(ends[0]).toEqual([0, 0]);
    expect(ends[1]).toEqual([0.006, 0]);
    // monotone along x: nothing doubled back
    const xs = line.map((p) => p[0]);
    const sorted = [...xs].sort((p, q) => p - q);
    expect([sorted.join(), [...sorted].reverse().join()]).toContain(xs.join());
  });
  it('reports stitched: false when a gap splits the relation', () => {
    const { lines, stitched } = stitchWays([way([0, 0], [0.001, 0]), way([0.5, 0], [0.501, 0])]);
    expect(stitched).toBe(false);
    expect(lines).toHaveLength(2);
  });
  it('walks a loop as one line', () => {
    const { stitched, lines } = stitchWays([way([0, 0], [0.001, 0], [0.001, 0.001]), way([0.001, 0.001], [0, 0.001], [0, 0])]);
    expect(stitched).toBe(true);
    expect(lines[0][0]).toEqual(lines[0][lines[0].length - 1]);
  });
});

describe('elevation totals', () => {
  it('counts the climb of a noisy profile within 5% of the hand-computed value', () => {
    // 100 samples climbing 2 m each (200 m up, hand-computed), with plus or minus 2 m of DEM noise on top
    const noise = [0, 2, -2, 1, -1, 2, -2, 0, 1, -1];
    const samples: [number, number][] = Array.from({ length: 101 }, (_, i) => [i * 25, 1000 + i * 2 + noise[i % 10]]);
    const t = totalsFromSamples(samples);
    expect(Math.abs((t.gain_m ?? 0) - 200) / 200).toBeLessThan(0.05);
    expect(t.loss_m ?? 99).toBeLessThanOrEqual(8);
    expect(t.high_m ?? 0).toBeGreaterThan(t.low_m ?? 0);
    expect(t.km).toBeCloseTo(2.5, 2);
  });
  it('counts a real down-and-up, not the noise inside it', () => {
    const samples: [number, number][] = [[0, 100], [25, 103], [50, 98], [75, 100], [100, 140], [125, 142], [150, 90]];
    const t = totalsFromSamples(samples);
    expect(t.gain_m ?? 0).toBeGreaterThanOrEqual(42);
    expect(t.gain_m ?? 99).toBeLessThanOrEqual(45);
    expect(t.loss_m ?? 0).toBeGreaterThanOrEqual(52);
    expect(t.loss_m ?? 99).toBeLessThanOrEqual(55);
  });
  it('decodes a Terrarium pixel', () => {
    expect(decodeTerrarium(128, 0, 0)).toBe(0);
    expect(decodeTerrarium(134, 100, 128)).toBeCloseTo(1636.5, 1);
  });
});

describe('simplification and sampling', () => {
  const wiggle: P[] = Array.from({ length: 200 }, (_, i) => [i * 0.0001, i === 100 ? 0.0003 : 0]); // a 33 m bump in a flat line
  it('keeps the start, the end and every point that moves the line more than 5 m', () => {
    const out = simplifyLine(wiggle, 5);
    expect(out[0]).toEqual(wiggle[0]);
    expect(out[out.length - 1]).toEqual(wiggle[wiggle.length - 1]);
    expect(out).toContainEqual(wiggle[100]);
    expect(out.length).toBeLessThan(10);
  });
  it('drops points within 5 m of the line', () => {
    const flat: P[] = Array.from({ length: 50 }, (_, i) => [i * 0.0001, i % 2 ? 0.00001 : 0]); // 1 m wobble
    expect(simplifyLine(flat, 5)).toHaveLength(2);
  });
  it('samples every 25 m, first and last included', () => {
    const line: P[] = [[11, 46], [11.01, 46]];
    const total = lengthM(line);
    const s = resample(line, 25);
    expect(s[0].d).toBe(0);
    expect(s[s.length - 1].d).toBeCloseTo(total, 3);
    expect(s[1].d).toBe(25);
    expect(haversine(s[1].at, s[0].at)).toBeCloseTo(25, 0);
  });
});

describe('reading OSM responses', () => {
  it('turns Overpass out geom and OSM API full.json into the same ways', () => {
    const op = waysFromOverpass({ elements: [{ type: 'way', id: 7, geometry: [{ lat: 46, lon: 11 }, { lat: 46.1, lon: 11.1 }] }, { type: 'relation', id: 1 }] });
    const api = waysFromOsmApi({ elements: [{ type: 'node', id: 1, lat: 46, lon: 11 }, { type: 'node', id: 2, lat: 46.1, lon: 11.1 }, { type: 'way', id: 7, nodes: [1, 2] }] });
    expect(op).toEqual([{ id: 7, line: [[11, 46], [11.1, 46.1]] }]);
    expect(api).toEqual(op);
  });
  it('reads relation and way ids from the prototype fact', () => {
    expect(osmRefsOf('osm_relation', '1657839 (path 122, 4.8 km to Capanna Carducci)')).toEqual(['relation:1657839']);
    expect(osmRefsOf('osm_ways', 'ways 229103971, 318733621, 363006574')).toEqual(['way:229103971', 'way:318733621', 'way:363006574']);
    expect(osmRefsOf('none', '123456')).toEqual([]);
  });
  it('reads the unconfirmed list from the adapter file', () => {
    const ids = unconfirmedIds("export const UNCONFIRMED_TRAIL_DATA: Record<string, string> = {\n  braies: 'x',\n  'monte-piana': 'y',\n};");
    expect([...ids]).toEqual(['braies', 'monte-piana']);
  });
  it('accepts a track whose length is near the researched figure, as a round trip or one way', () => {
    expect(lengthConsistent(10.9, 11)).toBe(true);
    expect(lengthConsistent(5.4, 11)).toBe(true);
    expect(lengthConsistent(21.7, 10)).toBe(false);
    expect(lengthConsistent(21.7, null)).toBe(true);
  });
});

describe('--check', () => {
  const inputs = collectInputs({
    places: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    trails: {
      a: { facts: { geometry_source: { v: 'osm_relation' }, geometry_ids: { v: '111111' } } },
      b: { facts: { geometry_source: { v: 'osm_relation' }, geometry_ids: { v: '222222' } } },
      c: { facts: { geometry_source: { v: 'none' } } },
    },
    access: {},
  });
  const file = (place: string, osm: string[], over: Partial<TrackFile> = {}): TrackFile => ({
    schema: 'trail-track/1', place, refs: [], osm, fetched: '2026-10-19', source: 'overpass', licence: 'ODbL-1.0', attribution: '© OpenStreetMap contributors',
    stitched: true, confirmed: true, start_offset_m: 0, simplify_m: 5, step_m: 25, totals: { km: 1, gain_m: 1, loss_m: 1, high_m: 1, low_m: 1 }, dem: 'x', geometry: [[0, 0], [1, 1]], elevation: [], ...over,
  });
  it('passes when every trail with an OSM id has a matching file', () => {
    expect(checkTracks(inputs, new Map([['a', file('a', ['relation:111111'])], ['b', file('b', ['relation:222222'])]]))).toEqual([]);
  });
  it('fails on a missing track', () => {
    expect(checkTracks(inputs, new Map([['a', file('a', ['relation:111111'])]]))).toEqual([{ place: 'b', problem: 'no track file' }]);
  });
  it('fails on an osm list that differs', () => {
    const p = checkTracks(inputs, new Map([['a', file('a', ['relation:999999'])], ['b', file('b', ['relation:222222'])]]));
    expect(p).toHaveLength(1);
    expect(p[0].problem).toMatch(/osm list differs/);
  });
  it('fails on a file for a trail that lost its OSM id, and on a confirmed track that the adapter lists as unconfirmed', () => {
    const files = new Map([['a', file('a', ['relation:111111'])], ['b', file('b', ['relation:222222'])], ['z', file('z', ['relation:3'])]]);
    expect(checkTracks(inputs, files, new Set(['a'])).map((x) => x.place).sort()).toEqual(['a', 'z']);
  });
  it('formats a track as text that parses back', () => {
    const t = file('a', ['relation:111111'], { geometry: Array.from({ length: 20 }, (_, i) => [11 + i / 1000, 46] as [number, number]), elevation: [[0, 1500], [25, 1501.5]] });
    expect(JSON.parse(formatTrack(t))).toEqual({ ...t, held_back: undefined });
  });
});
