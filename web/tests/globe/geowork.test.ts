import { describe, expect, it } from 'vitest';
import { buildAdmin, buildCountriesShapes } from '@/lib/globe/geoWork';
import { adminInWorker } from '@/lib/globe/geoClient';
import type { Topology } from '@/lib/globe/geometry';

// two unit squares side by side, as a quantised TopoJSON
const topo = (names: string[]): Topology => ({
  arcs: [[[0, 0], [10, 0], [0, 10], [-10, 0], [0, -10]], [[10, 0], [10, 0], [0, 10], [-10, 0], [0, -10]]],
  objects: { x: { geometries: names.map((name, i) => ({ type: 'Polygon', arcs: [[i]], properties: { name } })) } },
} as unknown as Topology);

describe('the shape work that runs in a worker (spec 8.3)', () => {
  it('builds sorted shapes with boxes, slugs and counts, and the GeoJSON MapLibre draws', () => {
    const r = buildAdmin({ topo: topo(['Zeta', 'Alpha']), pins: [{ id: 'a', lon: 5, lat: 5 }, { id: 'b', lon: 15, lat: 5 }, { id: 'c', lon: 16, lat: 6 }] });
    expect(r.fc.features.map((f) => f.properties.name)).toEqual(['Alpha', 'Zeta']);
    expect(r.fc.features.map((f) => f.id)).toEqual([0, 1]);
    expect(r.fc.features.map((f) => f.properties.slug)).toEqual(['alpha', 'zeta']);
    expect(r.fc.features.every((f) => f._bbox && f._c)).toBe(true);
    expect(r.fc.features.map((f) => f.properties.n)).toEqual([2, 1]); // Alpha is the right square, which holds b and c
    const drawn = JSON.parse(r.render) as { type: string; features: unknown[] };
    expect(drawn.type).toBe('FeatureCollection');
    expect(drawn.features).toHaveLength(2);
  });

  it('keeps only the districts whose centre is inside the state', () => {
    const state = buildAdmin({ topo: topo(['Left', 'Right']), pins: [] }).fc.features[0];
    const r = buildAdmin({ topo: topo(['Left', 'Right']), pins: [], within: state });
    expect(r.fc.features).toHaveLength(1);
    expect(r.fc.features[0].id).toBe(0);
  });

  it('answers the same inline as it would from a worker (no Worker in this environment)', async () => {
    const job = { topo: topo(['A', 'B']), pins: [{ id: 'a', lon: 5, lat: 5 }] };
    const viaClient = await adminInWorker(job);
    expect(viaClient.fc.features.map((f) => f.properties.n)).toEqual(buildAdmin(job).fc.features.map((f) => f.properties.n));
  });

  it('sends country shapes back without their points, with ids, codes, boxes and the drawn text', () => {
    const t = { arcs: topo(['x']).arcs, objects: { countries: { geometries: [{ type: 'Polygon', id: '380', arcs: [[0]], properties: { name: 'Italy' } }] } } } as unknown as Topology;
    const r = buildCountriesShapes({ topo: t, facts: {} });
    expect(r.fc.features[0].geometry).toBeNull();
    expect(r.fc.features[0].id).toBe(380);
    expect(r.fc.features[0].properties.ccn3).toBe('380');
    expect(r.fc.features[0]._bbox).toBeTruthy();
    expect(r.render.length).toBeGreaterThan(50);
  });
});
