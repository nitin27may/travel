import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB } from '../helpers';

// R4-H2: the home cover and /globe/ merge discs by the same rule. Both draw through PinLayer, which is the only caller of clusterItems, with
// one radius table and one gap, so one view cannot cluster differently on the two pages.
describe('one cluster radius for the cover and the globe page', () => {
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const src = ['components', 'lib'].flatMap((d) => files(path.join(WEB, d))).filter((f) => /\.tsx?$/.test(f));
  it('has PinLayer as the only caller of clusterItems', () => {
    const callers = src.filter((f) => /\bclusterItems\(/.test(readFileSync(f, 'utf8')) && !f.endsWith(path.join('lib', 'globe', 'cluster.ts')));
    expect(callers.map((f) => path.basename(f))).toEqual(['PinLayer.tsx']);
  });
  it('mounts PinLayer from the cover canvas and from the globe page', () => {
    expect(readFileSync(path.join(WEB, 'components/globe/GlobeCanvas.tsx'), 'utf8')).toContain('<PinLayer');
    expect(readFileSync(path.join(WEB, 'components/globe/GlobeShell.tsx'), 'utf8')).toContain('<PinLayer');
  });
});
