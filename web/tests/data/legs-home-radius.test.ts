import { describe, expect, it } from 'vitest';
import { encodePolyline5 } from '@travel/core/schema/api/legs.ts';
import { checkLegsFile, LEG_SIMPLIFY_M, refusedGeometries } from '../../scripts/legs/lib';

// Split from legs-files.test.ts (WF-3b): this test needs the REAL home point (the CI decoy is open ocean, so no leg is within the
// household radius). tools/gate/map.json leaves only this file out of CI; the rest of the legs tests run there.
const good = (over: Record<string, unknown> = {}) => ({
  schema: 'trip-legs/2', trip: 't', fetched: '2026-10-23', attribution: 'x', simplifiedM: LEG_SIMPLIFY_M,
  legs: [{ from: 'a', to: 'b', profile: 'driving-car', mode: 'drive', km: 1, minutes: 2, geometry: encodePolyline5([[-116.1, 51.4], [-116.2, 51.5]]) }], ...over,
});

describe('checkLegsFile (household radius)', () => {
  it('counts a geometry within the household radius, and the file may not hold it', () => {
    const home = good({ legs: [{ ...good().legs[0]!, geometry: encodePolyline5([[-78.95, 43.87], [-78.9, 43.9]]) }] });
    expect(refusedGeometries(home.legs as { geometry?: string }[])).toBe(1);
    const rep = checkLegsFile(home, 't', null);
    expect(rep.refused).toBe(1);
    expect(rep.problems.join()).toMatch(/within the household radius/);
    expect(JSON.stringify(rep)).not.toMatch(/78\.9|43\.8/); // the report holds the count, never the leg
  });
});
