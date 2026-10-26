import { describe, it } from 'vitest';
import { realData } from './support';

describe('report', () => {
  it('prints the snapshot contents', () => {
    const d = realData();
    const trips = d.internals.trips;
    const byDepth: Record<string, number> = {};
    for (const t of trips) byDepth[t.depth] = (byDepth[t.depth] ?? 0) + 1;
    const byKind: Record<string, number> = {};
    const byCat: Record<string, number> = {};
    const levels: Record<string, number> = {};
    for (const p of d.internals.places) {
      byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
      byCat[p.category] = (byCat[p.category] ?? 0) + 1;
      levels[p.completeness.level] = (levels[p.completeness.level] ?? 0) + 1;
    }
    const photos = d.internals.places.reduce((n, p) => n + p.photos.length, 0);
    const gallery = trips.reduce((n, t) => n + t.gallery.length, 0);
    const lines = [
      'public data snapshot',
      `trips by depth     ${JSON.stringify(byDepth)}  (${trips.length} total)`,
      `places by kind     ${JSON.stringify(byKind)}  (${d.internals.places.length} total)`,
      `places by category ${JSON.stringify(byCat)}`,
      `completeness       ${JSON.stringify(levels)}`,
      `photos             ${photos} on places, ${gallery} in trip galleries, ${trips.filter((t) => t.cover).length}/${trips.length} trips with a cover`,
      `globe              ${d.globePaths().length} paths, ${d.globeIndex().pins.length} pins`,
      `dropped (dated)    ${d.internals.dropped.length} texts listed for a person`,
    ];
    console.log(lines.join('\n'));
  });
});
