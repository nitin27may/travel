import { describe, expect, it } from 'vitest';
import { memoryStorage } from '@travel/core/schema/copies.ts';
import { BASES_KEY, basesOfExport, kmApart, nearestBaseKm, readBases, saveBases } from '@/lib/mine/bases';

describe('the kept base points of copied trips (PR-001)', () => {
  it('takes the distinct base waypoints of an export, rounded to 0.01 degree', () => {
    const wp = (role: string, lon: number, lat: number) => ({ role, point: { lon, lat } });
    expect(basesOfExport({ waypoints: [wp('base', -116.1812, 51.4254), wp('base', -116.1799, 51.4261), wp('stop', -117, 51), wp('base', -117.08, 51.18)] })).toEqual([[-116.18, 51.43], [-117.08, 51.18]]);
  });
  it('falls back to the places the days visit when the plan names no base, to 0.05 degree, at most 24 cells', () => {
    const wp = (role: string, lon: number, lat: number) => ({ role, point: { lon, lat } });
    expect(basesOfExport({ waypoints: [wp('stop', -116.181, 51.321), wp('stop', -116.19, 51.31), wp('trailhead', -117.08, 51.18), wp('parking', 10, 10)] })).toEqual([[-116.2, 51.3], [-117.1, 51.2]]);
    const many = Array.from({ length: 60 }, (_, i) => wp('stop', i, 0));
    expect(basesOfExport({ waypoints: many })).toHaveLength(24);
  });
  it('saves and reads them, keeps the newest 40 trips, and reads a damaged value as empty', () => {
    const s = memoryStorage();
    expect(readBases(s)).toEqual({});
    saveBases(s, 'rockies-2029', [[-116.18, 51.42]]);
    expect(readBases(s)).toEqual({ 'rockies-2029': [[-116.18, 51.42]] });
    for (let i = 0; i < 45; i++) saveBases(s, `trip-${i}`, [[1, 2]]);
    const kept = Object.keys(readBases(s));
    expect(kept).toHaveLength(40);
    expect(kept).not.toContain('rockies-2029');
    s.setItem(BASES_KEY, '{bad');
    expect(readBases(s)).toEqual({});
    s.setItem(BASES_KEY, JSON.stringify({ a: [[1, 2]], b: 'x', c: [[1]] }));
    expect(readBases(s)).toEqual({ a: [[1, 2]] });
  });
  it('measures the nearest base in km, and says nothing without bases', () => {
    expect(kmApart([0, 0], [0, 1])).toBeCloseTo(111.2, 0);
    expect(nearestBaseKm([-116.18, 51.32], [[-116.18, 51.42], [11.85, 46.54]])).toBeCloseTo(11.1, 0);
    expect(nearestBaseKm([0, 0], [])).toBeNull();
    expect(nearestBaseKm([0, 0], undefined)).toBeNull();
  });
});
