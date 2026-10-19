import { describe, expect, it } from 'vitest';
import { globeIndex } from '@/lib/public';
import { buildSearchParts } from '@/lib/search/build';

// Backlog 3.44: a country with trips and no places was named by its ISO code in the index. The gazetteer names it now, at source.

describe('country names in the index (backlog 3.44)', () => {
  it('Switzerland and Norway are named, not coded (Norway has trips and no places)', () => {
    const countries = globeIndex().continents.flatMap((c) => c.countries);
    for (const [cc, name] of [['ch', 'Switzerland'], ['no', 'Norway']] as const) {
      const node = countries.find((c) => c.slug === cc);
      expect(node, cc).toBeDefined();
      if (cc === 'no') expect(node!.places).toBe(0);
      expect(node!.name).toBe(name);
    }
    expect(countries.filter((c) => c.name === c.name.toUpperCase() && c.name.length <= 3)).toEqual([]);
  });

  it('the search index names them too, so no area record is a two-letter code', () => {
    const areas = Object.values(buildSearchParts().parts).flat().filter((r) => r.k === 'area' && /^\/globe\/[a-z]{2}\/$/.test(r.h));
    expect(areas.find((r) => r.h === '/globe/ch/')?.n).toBe('Switzerland');
    expect(areas.find((r) => r.h === '/globe/no/')?.n).toBe('Norway');
    expect(areas.filter((r) => r.n.length <= 3)).toEqual([]);
  });
});
