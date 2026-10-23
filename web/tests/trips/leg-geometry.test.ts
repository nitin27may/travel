import { describe, expect, it } from 'vitest';
import { encodePolyline5 } from '@travel/core/schema/api/legs.ts';
import { legGeometry, hasRoutedLegs } from '@/components/trips/legGeometry';
import type { DayMap } from '@/components/trips/mapPins';
import { keyOf, routeSpec } from '@/components/trips/routeSpec';

const pin = (day: number, n: number, lng: number, lat: number, entry: string) => ({ n, id: `stop:${day}:s${n}`, at: { lng, lat }, name: `S${n}`, entryIds: [entry] });
const model = (d: number, pts: [number, number, string][]): DayMap => ({ day: d, pins: pts.map((p, i) => pin(d, i + 1, p[0], p[1], p[2])), entryPin: new Map(), unplaced: [], missing: 0 });
const bases = [{ id: 'a', name: 'Alpha', lng: 10, lat: 40, days: [1, 2] }];
const models = [model(1, [[10.1, 40.1, 'i1'], [10.2, 40.2, 'i2']]), model(2, [[10.3, 40.3, 'i3']])];
const line = (pts: [number, number][]) => encodePolyline5(pts);
const leg = (day: number, from: string, to: string, geometry: string | null) => ({ day, from, to, mode: 'drive' as const, km: 5, minutes: 9, geometry });

describe('routed legs onto the map\'s lines (D-E5)', () => {
  it('a leg between two pins fills that step, and the step draws solid', () => {
    const g = legGeometry([leg(1, 'i1', 'i2', line([[10.1, 40.1], [10.15, 40.12], [10.2, 40.2]]))], models, bases);
    expect(Object.keys(g)).toEqual(['leg:1:2']);
    expect(g['leg:1:2']!.path).toHaveLength(3);
    expect(g['leg:1:2']!.mode).toBe('drive');
    expect(g['leg:1:2']!.path[1]).toEqual({ lng: 10.15, lat: 40.12 });
    const spec = routeSpec({ bases, models, picked: 1, geometry: g });
    expect(spec.lines.map((l) => [l.id, l.style])).toEqual([['leg:1:2', 'route-pick'], ['leg:1:end', 'straight-estimate']]);
    expect(keyOf(spec).items.map((i) => i.label)).toContain('Road route');
    expect(keyOf(spec).sentence).toMatch(/^Road routes from OpenStreetMap/);
  });
  it('the legs of the base are found by their base: key, in either direction (reversed to the step\'s direction)', () => {
    // day 2 slept at base a the night before: morning base, then stop i3, then back to the night base
    const g = legGeometry([leg(2, 'base:a', 'i3', line([[10, 40], [10.15, 40.15], [10.3, 40.3]]))], models, bases);
    expect(g['leg:2:1']!.path[0]).toEqual({ lng: 10, lat: 40 }); // morning base to the first stop: the file's line runs the same way
    const back = legGeometry([leg(1, 'i2', 'i1', line([[10.2, 40.2], [10.1, 40.1]]))], models, bases);
    expect(back['leg:1:2']!.path[0]).toEqual({ lng: 10.1, lat: 40.1 }); // asked the other way round: reversed
  });
  it('a leg of another day, a leg without geometry and a pair that is not a step draw nothing; the map stays dashed and says routes are not drawn', () => {
    const g = legGeometry([leg(2, 'i1', 'i2', line([[10.1, 40.1], [10.2, 40.2]])), leg(1, 'i1', 'i2', null), leg(1, 'i1', 'zz', line([[0, 0], [1, 1]]))], models, bases);
    expect(g).toEqual({});
    expect(hasRoutedLegs(g)).toBe(false);
    const spec = routeSpec({ bases, models, picked: 1, geometry: g });
    expect(spec.lines.every((l) => l.style === 'straight-estimate')).toBe(true);
    expect(keyOf(spec).items.map((i) => i.label)).not.toContain('Road route');
    expect(keyOf(spec).sentence).toMatch(/^Road routes are not drawn yet/);
  });
  it('the scheduler\'s own entry ids are matched by place: the detail item ids name the same places', () => {
    const ms = [model(1, [[10.1, 40.1, 'sched-a'], [10.2, 40.2, 'sched-b']])];
    ms[0]!.pins[0]!.id = 'stop:1:falls';
    ms[0]!.pins[1]!.id = 'stop:1:lake';
    const slugs: Record<string, string> = { '8-B-1': 'falls', '8-B-2': 'lake' };
    const g = legGeometry([leg(1, '8-B-2', '8-B-1', line([[10.2, 40.2], [10.15, 40.12], [10.1, 40.1]]))], ms, bases, (k) => slugs[k] ?? null);
    expect(g['leg:1:2']!.path.map((p) => p.lng)).toEqual([10.1, 10.15, 10.2]); // the file runs lake to falls; the step runs falls to lake
    expect(legGeometry([leg(1, '8-B-2', '8-B-1', line([[10.2, 40.2], [10.1, 40.1]]))], ms, bases)).toEqual({}); // without the place map the ids do not meet
  });
  it('All days draws routed steps as plain routes, not the picked-day amber', () => {
    const g = legGeometry([leg(1, 'i1', 'i2', line([[10.1, 40.1], [10.2, 40.2]]))], models, bases);
    expect(routeSpec({ bases, models, picked: null, geometry: g }).lines.find((l) => l.id === 'leg:1:2')!.style).toBe('route');
  });
});
