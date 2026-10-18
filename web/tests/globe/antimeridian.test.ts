import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { adminFeatures } from '@/lib/globe/admin';
import { forRender, topoFeatures, type Feat, type Ring, type Topology } from '@/lib/globe/geometry';

const topo = JSON.parse(readFileSync(path.join(process.cwd(), 'public/globe/data/countries-50m.json'), 'utf8')) as Topology & { objects: { countries: { geometries: never[] } } };
const fc = topoFeatures(topo, topo.objects.countries);

const rings = (f: Feat): Ring[] => {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return g.coordinates;
  if (g.type === 'MultiPolygon') return g.coordinates.flat();
  return [];
};
const widest = (f: Feat): number => Math.max(0, ...rings(f).flatMap((r) => r.slice(1).map((p, i) => Math.abs(p[0] - r[i][0]))));

describe('antimeridian: the shapes that are drawn', () => {
  it('the source data does jump (Russia, Fiji, Antarctica), so the test means something', () => {
    expect(fc.features.filter((f) => widest(f) > 180).length).toBeGreaterThanOrEqual(3);
  });
  it('no drawn segment of any country spans more than 180 degrees of longitude', () => {
    const bad = forRender(fc).features.filter((f) => widest(f) > 180).map((f) => String(f.properties.name ?? f.id));
    expect(bad).toEqual([]);
  });
  it('Russia stays one continuous shape that reaches past 180 and has a copy that enters from -180', () => {
    const russia = forRender(fc).features.find((f) => f.properties.name === 'Russia')!;
    const xs = rings(russia).flat().map((p) => p[0]);
    expect(Math.max(...xs)).toBeGreaterThan(180);
    expect(Math.min(...xs)).toBeLessThan(-180);
  });
  it('Antarctica (a polar ring) is flagged, keeps one outer ring per polygon and never spans more than 180 degrees', () => {
    const ata = forRender(fc).features.find((f) => f.properties.name === 'Antarctica')!;
    expect(ata.properties.polar).toBe(true);
    const g = ata.geometry!;
    const polys = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
    expect(polys.every((p) => p.length === 1)).toBe(true);
    expect(widest(ata)).toBeLessThanOrEqual(180);
  });
  it('shapes that never jump are left as they were', () => {
    const italy = fc.features.find((f) => f.properties.name === 'Italy')!;
    expect(forRender({ type: 'FeatureCollection', features: [italy] }).features[0].geometry).toEqual(italy.geometry);
  });

  it('the same holds for every admin file (USA, Fiji, Kiribati, New Zealand, Antarctica and the rest)', () => {
    const dir = path.join(process.cwd(), 'public/globe/admin');
    const bad: string[] = [];
    for (const file of readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'manifest.json')) {
      const t = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Topology;
      if (!t.arcs) continue;
      for (const f of forRender(adminFeatures(t)).features) if (widest(f) > 180) bad.push(`${file}:${String(f.properties.name)}`);
    }
    expect(bad).toEqual([]);
  }, 120_000);
});
