import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB_DIR } from './support';

// S13: place page HTML stays within +25% of the baseline taken before S1 Part B (tests/data/place-html-baseline.json): the median page and the largest.
// Reads the real build in web/out; skipped when there is none (the check-all order builds after the tests, so a clean checkout runs it on the second pass).
const baseline = JSON.parse(readFileSync(path.join(WEB_DIR, 'tests', 'data', 'place-html-baseline.json'), 'utf8')) as { pages: Record<string, number> };
const OUT = path.join(WEB_DIR, 'out', 'places');
const BUDGET = 1.25;

describe('place page size (S13)', () => {
  const sizes = Object.entries(baseline.pages).flatMap(([slug, was]) => {
    const f = path.join(OUT, slug, 'index.html');
    return existsSync(f) ? [{ slug, was, now: readFileSync(f).length }] : [];
  });
  it.skipIf(sizes.length === 0)('the median page grows by at most 25%', () => {
    const r = sizes.map((s) => s.now / s.was).sort((a, b) => a - b);
    expect(r[Math.floor(r.length / 2)]!).toBeLessThanOrEqual(BUDGET);
  });
  it.skipIf(sizes.length === 0)('the largest page grows by at most 25%', () => {
    const largestWas = Math.max(...sizes.map((s) => s.was));
    const largestNow = Math.max(...sizes.map((s) => s.now));
    expect(largestNow / largestWas, `${largestNow} against ${largestWas}`).toBeLessThanOrEqual(BUDGET);
  });
});
