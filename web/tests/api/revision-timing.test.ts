import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonStore } from '@travel/core/catalogue/json/index.ts';
import type { JsonSource } from '@travel/core/catalogue/json/source.ts';
import { createJsonSource } from '@/lib/server/source';

// The first revision() at 10,000 places (D-E4, store.ts A30; acceptance check 4 of the API-3 brief), measured the way G-B measured it
// (verify-GB 16 B): the real source with its place rows cloned to 10,000 (slugs `<slug>-s<n>`, details mapped back to the base place).
// G-B's figure was 2.9 s, because the revision hashed every built detail; it is now the hash of the input files (web/lib/server/inputs.ts).
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

mkdirSync(path.join(process.cwd(), 'test-results'), { recursive: true });

describe('revision() at 10,000 places (A30)', () => {
  it(`the first call takes under ${TARGET_MS} ms`, async () => {
    const base = createJsonSource();
    for (const r of base.placeRows) base.placeDetail(r.slug);
    const store = new JsonStore(cloned(base));
    const t0 = performance.now();
    const rev = await store.revision();
    const ms = Math.round(performance.now() - t0);
    console.info(`first revision() at ${PLACES} places: ${ms} ms (target ${TARGET_MS} ms)`);
    writeFileSync(path.join(process.cwd(), 'test-results', 'revision-timing.txt'), `${ms} ms at ${PLACES} places (target ${TARGET_MS} ms)\n`);
    expect(rev).toMatch(/^[0-9a-f]{64}$/);
    expect(ms).toBeLessThan(TARGET_MS);
    // cached: the second call is the same promise
    expect(await store.revision()).toBe(rev);
  }, 120_000);
});
