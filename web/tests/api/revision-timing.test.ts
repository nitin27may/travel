import { describe, expect, it } from 'vitest';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import type { JsonSource } from '@travel/core/catalogue/json/source.ts';
import { createJsonSource } from '@/lib/server/source';

// The first revision() at 10,000 places (D-E4, store.ts A30; acceptance check 4 of the API-3 brief), measured the way G-B measured it
// (verify-GB 16 B): the real source with its place rows cloned to 10,000 (slugs `<slug>-s<n>`, details mapped back to the base place).
// G-B's figure was 2.9 s, because the revision hashed every built detail. API-3b computes it from the inputs instead; until then this
// test AWAITS that step: it measures, prints the figure, and requires the old cost, so it turns red the day 3b lands and the assertion
// flips to the target.
const TARGET_MS = 300;
const PLACES = 10_000;

function cloned(base: JsonSource): JsonSource {
  const rows = Array.from({ length: PLACES }, (_, i) => {
    const r = base.placeRows[i % base.placeRows.length]!;
    const n = Math.floor(i / base.placeRows.length);
    return n === 0 ? r : { ...r, id: `${r.slug}-s${n}`, slug: `${r.slug}-s${n}`, ref: `${r.ref}-s${n}` };
  });
  return { ...base, placeRows: rows, placeDetail: (slug) => base.placeDetail(slug.replace(/-s\d+$/, '')) };
}

describe('revision() at 10,000 places (A30)', () => {
  it(`the first call [awaits API-3b step 11 (A30: revision from inputs): until then it takes at least ${TARGET_MS} ms]`, async () => {
    const base = createJsonSource();
    // build every base detail first, so the figure is the revision's own cost and not the first detail build
    for (const r of base.placeRows) base.placeDetail(r.slug);
    const store = new JsonStore(cloned(base));
    const t0 = performance.now();
    const rev = await store.revision();
    const ms = Math.round(performance.now() - t0);
    console.info(`first revision() at ${PLACES} places: ${ms} ms (target ${TARGET_MS} ms)`);
    expect(rev).toMatch(/^[0-9a-f]{64}$/);
    // API-3b: replace this line with expect(ms).toBeLessThan(TARGET_MS)
    expect(ms, `revision() is now under ${TARGET_MS} ms: remove the awaits branch (API-3b)`).toBeGreaterThanOrEqual(TARGET_MS);
  }, 120_000);
});
