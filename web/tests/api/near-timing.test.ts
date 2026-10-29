import { describe, expect, it } from 'vitest';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import { toNearCell } from '@travel/core/config/nearby.ts';
import { createJsonSource } from '@/lib/server/source';

// The near budget (N2, store.ts A41): one `near` over the real places (about 440 today) under 20 ms once the store is warm, for a place
// centre and for coordinate cells across the catalogue. The median of five runs per centre decides, so one GC pause does not.
const BUDGET_MS = 20;

describe('near over the real places (A41)', () => {
  it(`answers under ${BUDGET_MS} ms per query (warm)`, async () => {
    const src = createJsonSource();
    const a = src.placeRows.find((x) => !x.approx && x.lat !== null)!;
    const store = new JsonStore(src);
    const centres = [`place:${a.slug}`, `point:${toNearCell(a.lat!)},${toNearCell(a.lon!)}`, 'point:46.5,11.35', 'point:64.15,-21.94'];
    for (const near of centres) await store.near({ near, r: 100 });
    for (const near of centres) {
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        const r = await store.near({ near, r: 100 }, { pageSize: 100 });
        times.push(performance.now() - t0);
        expect(r.ok).toBe(true);
      }
      times.sort((x, y) => x - y);
      console.info(`near ${near.startsWith('place:') ? 'place' : 'point'} over ${src.placeRows.length} places: median ${times[2]!.toFixed(2)} ms`);
      expect(times[2]!, near.startsWith('place:') ? 'place centre' : 'point centre').toBeLessThan(BUDGET_MS);
    }
  }, 60_000);
});
