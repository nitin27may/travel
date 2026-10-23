import { describe, expect, it } from 'vitest';
import { dayDirections, MAX_WAYPOINTS } from '@/components/trips/directions';
import type { DayMap } from '@/components/trips/mapPins';
import { dayFitIds, keyOf, KEY_NO_ROUTE, KEY_SOME_ROUTE, labelOf, legIds, routeSpec } from '@/components/trips/routeSpec';

const pin = (day: number, n: number, lng: number, lat: number, name = `S${n}`) => ({ n, id: `stop:${day}:s${n}`, at: { lng, lat }, name, entryIds: [`e${n}`] });
const day = (d: number, pts: [number, number][], missing = 0): DayMap => ({ day: d, pins: pts.map((p, i) => pin(d, i + 1, p[0], p[1])), entryPin: new Map(), unplaced: [], missing });
const bases = [
  { id: 'a', name: 'Alpha', lng: 10, lat: 40, days: [1, 2] },
  { id: 'b', name: 'Beta', lng: 11, lat: 41, days: [3] },
];
const models = [day(1, [[10.1, 40.1], [10.2, 40.2]]), day(2, [[10.3, 40.3]]), day(3, [[11.1, 41.1], [11.2, 41.2], [11.3, 41.3]], 2)];

describe('lines: each leg is its own estimate (map note 5.3)', () => {
  it('runs morning base, the stops in order, then the night base, one line per leg', () => {
    const s = routeSpec({ bases, models, picked: 3 });
    expect(s.lines.map((l) => l.id)).toEqual(['leg:3:1', 'leg:3:2', 'leg:3:3', 'leg:3:end']);
    expect(s.lines.every((l) => l.style === 'straight-estimate')).toBe(true);
  });
  it('day 2 starts at the base it slept at the night before and ends at its own night base', () => {
    const s = routeSpec({ bases, models, picked: 2 });
    expect(s.lines.map((l) => l.id)).toEqual(['leg:2:1', 'leg:2:end']);
    expect(s.lines[0]!.coords[0]).toEqual({ lng: 10, lat: 40 });
  });
  it('invents no base: with none, the line starts at the first stop', () => {
    const s = routeSpec({ bases: [], models, picked: 3 });
    expect(s.lines.map((l) => l.id)).toEqual(['leg:3:2', 'leg:3:3']);
    expect(legIds(models[2]!, false, false)).toEqual(['leg:3:2', 'leg:3:3']);
  });
  it('Day view draws only the picked day; All days draws every day', () => {
    expect(new Set(routeSpec({ bases, models, picked: 1 }).lines.map((l) => l.id.split(':')[1]))).toEqual(new Set(['1']));
    expect(new Set(routeSpec({ bases, models, picked: null }).lines.map((l) => l.id.split(':')[1]))).toEqual(new Set(['1', '2', '3']));
  });
  it('a leg with geometry is solid route-pick on the picked day, route in All days', () => {
    const geometry = { 'leg:1:2': [{ lng: 10.1, lat: 40.1 }, { lng: 10.15, lat: 40.12 }, { lng: 10.2, lat: 40.2 }] };
    const day1 = routeSpec({ bases, models, picked: 1, geometry });
    expect(day1.lines.find((l) => l.id === 'leg:1:2')).toMatchObject({ style: 'route-pick' });
    expect(day1.lines.find((l) => l.id === 'leg:1:2')!.coords).toHaveLength(3);
    expect(day1.lines.find((l) => l.id === 'leg:1:end')!.style).toBe('straight-estimate');
    expect(routeSpec({ bases, models, picked: null, geometry }).lines.find((l) => l.id === 'leg:1:2')!.style).toBe('route');
  });
});

describe('pins', () => {
  it('numbers the picked day, dims the other days, hides no base and labels only the night base', () => {
    const s = routeSpec({ bases, models, picked: 3 });
    expect(s.pins.filter((p) => p.style === 'stop-numbered').map((p) => p.number)).toEqual([1, 2, 3]);
    expect(s.pins.filter((p) => p.style === 'stop').every((p) => p.dim)).toBe(true);
    expect(s.pins.filter((p) => p.style === 'base' && !p.quiet).map((p) => p.label)).toEqual(['Beta']);
    expect(s.selectedId).toBe('base:b');
  });
  it('other days\' dots carry no name, so the keyboard list of pins (MapLibre) holds only the day\'s pins and the bases', () => {
    for (const picked of [null, 1, 3]) expect(routeSpec({ bases, models, picked }).pins.filter((p) => p.style === 'stop').every((p) => !p.label)).toBe(true);
  });
  it('All days has dots at full strength and no numbers', () => {
    const s = routeSpec({ bases, models, picked: null });
    expect(s.pins.some((p) => p.style === 'stop-numbered')).toBe(false);
    expect(s.pins.filter((p) => p.style === 'stop').every((p) => !p.dim)).toBe(true);
    expect(s.maxZoom).toBeUndefined();
  });
  it('carries the loading, padding and zoom fields of the note', () => {
    const s = routeSpec({ bases, models, picked: 1 });
    expect(s).toMatchObject({ load: 'visible', maxZoom: 13, fitPadding: { top: 56, right: 176, bottom: 48, left: 48 } });
    expect(routeSpec({ bases, models, picked: 1, wide: false }).fitPadding).toEqual({ top: 40, right: 60, bottom: 44, left: 28 });
  });
  it('a day fit covers its pins, legs and both bases', () => {
    expect(dayFitIds(models, bases, 2)).toEqual(['stop:2:s1', 'leg:2:1', 'leg:2:end', 'base:a']);
  });
});

describe('the key shows only what is drawn (map note 5.2)', () => {
  it('Day view with estimates: numbered stop, base, estimate, other days, and the sentence about missing routes', () => {
    const k = keyOf(routeSpec({ bases, models, picked: 3 }));
    expect(k.items.map((i) => i.label)).toEqual(["Stop, numbered in the day's order", 'Base for the night', 'Straight line, not a route', 'Other days']);
    expect(k.sentence).toBe(KEY_NO_ROUTE);
    expect(KEY_NO_ROUTE).toBe("Road routes are not drawn yet. Lines join each day's stops in order; use Directions for the drive.");
  });
  it('All days has no numbered stop and no "Other days"', () => {
    expect(keyOf(routeSpec({ bases, models, picked: null })).items.map((i) => i.id)).toEqual(['stops', 'base', 'estimate']);
  });
  it('the base swatch is the picked (amber) one when the picked base is drawn, ink when the day has none', () => {
    expect(keyOf(routeSpec({ bases, models, picked: 3 })).items.find((i) => i.id === 'base')!.pick).toBe(true);
    expect(keyOf(routeSpec({ bases, models, picked: null })).items.find((i) => i.id === 'base')!.pick).toBe(false);
  });
  it('a routed leg adds "Road route" and switches the sentence; all routed has none', () => {
    const geometry = { 'leg:2:1': [{ lng: 10, lat: 40 }, { lng: 10.3, lat: 40.3 }], 'leg:2:end': [{ lng: 10.3, lat: 40.3 }, { lng: 10, lat: 40 }] };
    const all = keyOf(routeSpec({ bases, models, picked: 2, geometry }));
    expect(all.items.map((i) => i.id)).toContain('road');
    expect(all.items.map((i) => i.id)).not.toContain('estimate');
    expect(all.sentence).toBeNull();
    const some = keyOf(routeSpec({ bases, models, picked: 1, geometry: { 'leg:1:2': [{ lng: 10.1, lat: 40.1 }, { lng: 10.2, lat: 40.2 }] } }));
    expect(some.items.map((i) => i.id)).toEqual(expect.arrayContaining(['road', 'estimate']));
    expect(some.sentence).toBe(KEY_SOME_ROUTE);
  });
});

describe('the label row counts what is drawn (map note 4.1, 6.3)', () => {
  const trip = { stops: 9, missing: 4 };
  it('a day: distinct pins and stops with no position', () => {
    expect(labelOf({ day: 3, baseName: 'Beta', baseOnMap: true, model: models[2]!, trip })).toEqual({ text: 'Day 3 · Beta · 3 stops on the map', missing: 2 });
    expect(labelOf({ day: 2, baseName: null, baseOnMap: false, model: models[1]!, trip }).text).toBe('Day 2 · 1 stop on the map');
  });
  it('the count equals the pins the spec draws', () => {
    for (const m of models) expect(labelOf({ day: m.day, baseName: null, baseOnMap: false, model: m, trip }).text).toContain(`${routeSpec({ bases, models, picked: m.day }).pins.filter((p) => p.style === 'stop-numbered').length} stop`);
  });
  it('a day with no placed stop says so, with the base or the whole trip', () => {
    const none: DayMap = { day: 5, pins: [], entryPin: new Map(), unplaced: [{ id: 'x', name: 'X' }], missing: 1 };
    expect(labelOf({ day: 5, baseName: 'Banff', baseOnMap: true, model: none, trip }).text).toBe('Day 5 · Banff · no stop has a map position · showing the base');
    expect(labelOf({ day: 5, baseName: 'Banff', baseOnMap: false, model: none, trip }).text).toBe('Day 5 · no stop has a map position yet · showing the whole trip');
  });
  it('compact (phone sheet) keeps the count and drops the words the segment already says', () => {
    expect(labelOf({ day: null, baseName: null, baseOnMap: false, model: null, trip, compact: true }).text).toBe('9 stops on the map');
  });
  it('All days', () => {
    expect(labelOf({ day: null, baseName: null, baseOnMap: false, model: null, trip }).text).toBe('All days · the whole trip · 9 stops on the map');
  });
});

describe('Directions for a day (map note 9)', () => {
  const p = (i: number) => ({ lng: 10 + i / 100, lat: 40 + i / 100 });
  it('origin is the morning base, destination the night base, the stops between as waypoints', () => {
    const d = dayDirections(3, [p(1), p(2), p(3)], { lng: 9, lat: 39 }, { lng: 12, lat: 42 })!;
    const u = new URL(d.url);
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/dir/');
    expect(u.searchParams.get('origin')).toBe('39.00000,9.00000');
    expect(u.searchParams.get('destination')).toBe('42.00000,12.00000');
    expect(u.searchParams.get('waypoints')).toBe('40.01000,10.01000|40.02000,10.02000|40.03000,10.03000');
    expect(d.label).toBe('Directions for Day 3');
  });
  it('with no base, the first and last stops are the ends', () => {
    const u = new URL(dayDirections(1, [p(1), p(2), p(3)], null, null)!.url);
    expect(u.searchParams.get('origin')).toBe('40.01000,10.01000');
    expect(u.searchParams.get('destination')).toBe('40.03000,10.03000');
    expect(u.searchParams.get('waypoints')).toBe('40.02000,10.02000');
  });
  it('at most nine waypoints, and the label says so', () => {
    const many = Array.from({ length: 14 }, (_, i) => p(i));
    const d = dayDirections(2, many, { lng: 9, lat: 39 }, { lng: 12, lat: 42 })!;
    expect(new URL(d.url).searchParams.get('waypoints')!.split('|')).toHaveLength(MAX_WAYPOINTS);
    expect(d.label).toBe('Directions for Day 2 (first 9 stops)');
  });
  it('is null when there is nowhere to go, and uses coordinates only', () => {
    expect(dayDirections(1, [p(1)], null, null)).toBeNull();
    expect(dayDirections(1, [p(1), p(2)], null, null)!.url).not.toMatch(/place_id|query=/);
  });
});
