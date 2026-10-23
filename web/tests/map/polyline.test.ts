import { describe, expect, it } from 'vitest';
import { decodePolyline5 as contract, encodePolyline5 } from '@travel/core/schema/api/legs.ts';
import { decodePolyline5 } from '@/lib/map/polyline';

describe('the map decoder agrees with the contract decoder', () => {
  it('decodes what the contract encodes, vertex for vertex', () => {
    const line: [number, number][] = [[-116.1782, 51.4254], [-116.18, 51.43], [-116.2, 51.5], [12.20461, 46.55621], [-0.00001, -0.00002]];
    const s = encodePolyline5(line);
    const want = contract(s)!;
    expect(decodePolyline5(s)).toEqual(want.map(([lng, lat]) => ({ lng, lat })));
  });
  it('answers null for what is not a polyline', () => {
    expect(decodePolyline5('not a line!')).toBeNull();
    expect(decodePolyline5('_p~iF')).toBeNull(); // a truncated pair
    expect(decodePolyline5('')).toEqual([]);
  });
  it('follows the committed legs files exactly', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const dir = new URL('../../../data/schedules/legs/', import.meta.url);
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.json') && !n.endsWith('.unrouted.json'))) {
      const file = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { legs: { geometry?: string }[] };
      for (const l of file.legs) if (l.geometry) expect(decodePolyline5(l.geometry)).toEqual(contract(l.geometry)!.map(([lng, lat]) => ({ lng, lat })));
    }
  });
});
