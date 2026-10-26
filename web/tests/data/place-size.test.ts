import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB_DIR } from './support';
import { builtOutDir } from '../helpers/built';
import { EXCEPTION_CAP, OVER_50, PAGE_CAP, PLACE_MEDIAN_BUDGET, placeRows, s13 } from '../../scripts/budget-report.mjs';
import type { Baseline } from '../../scripts/budget-report.mjs';

// S13: place page HTML stays within +25% of the baseline taken before S1 Part B (tests/data/place-html-baseline.json): the median page and the largest.
// Reads the real build; fails when there is none (builtOutDir throws; check-all builds first).
// Re-baselined once (D2b-INT option A, owner question Q88): the 56 pages of stored places that were stubs until DATA-D2b (no capture
// record, 1.03x to 1.06x of this baseline on main) start from their first full-record size. S13 guards how the renderer grows a page for
// the same data; a stub measured against its first record measures the research, not the renderer. The budget, the 1.5 and 2.0 caps and
// the largest-page check are unchanged, and every other page keeps its pre-S1 size. A stub page is re-baselined only by a decision like
// this one, never by a lane.
// BUD-1 (Q260): S13 measures catalogue content, not the shell. A page counts as its bytes minus today's shell chrome plus the chrome it
// had at the baseline (the file's "chrome", measured by the same method on rebuilds of the baseline commits 0c462a45 and d6faa6eb), so a footer link, a bar
// item or the beacon tag cannot move it, while every byte a record or a section adds still does (P8). Shell growth has its own cap
// (shell-size.test.ts). The limits, the exception list and the method live in web/scripts/budget-report.mjs, which
// `pnpm --dir web budget:report` prints from.
const baseline = JSON.parse(readFileSync(path.join(WEB_DIR, 'tests', 'data', 'place-html-baseline.json'), 'utf8')) as Baseline;
const OUT = path.join(builtOutDir(), 'places');

describe('place page size (S13)', () => {
  // every baseline page is in the build and has a shell (placeRows throws on a redirect or error document), so S13 never skips
  const sizes = placeRows(baseline, (slug) => {
    const f = path.join(OUT, slug, 'index.html');
    return existsSync(f) ? readFileSync(f, 'utf8') : null;
  });
  const r = s13(sizes);

  it('keeps the limits it was set with, and measures every baseline page', () => {
    expect([PLACE_MEDIAN_BUDGET, PAGE_CAP, EXCEPTION_CAP]).toEqual([1.25, 1.5, 2]);
    expect(OVER_50.size).toBe(42);
    expect(Object.keys(baseline.pages)).toHaveLength(209);
    expect(sizes.map((s) => s.slug)).toEqual(Object.keys(baseline.pages));
  });
  it('keeps the baseline chrome as measured: 3932 B on the 153 pre-S1 pages, 3978 B on the 56 option-A pages', () => {
    expect(Object.keys(baseline.chrome).sort()).toEqual(Object.keys(baseline.pages).sort());
    const counts: Record<number, number> = {};
    for (const v of Object.values(baseline.chrome)) counts[v] = (counts[v] ?? 0) + 1;
    expect(counts).toEqual({ 3932: 153, 3978: 56 });
  });
  it('the median page grows by at most 25%', () => {
    expect(r.median, `${r.mid.slug} ${r.mid.now} against ${r.mid.was}`).toBeLessThanOrEqual(PLACE_MEDIAN_BUDGET);
  });
  it('the largest page grows by at most 25%', () => {
    expect(r.largest, `${r.largestNow} against ${r.largestWas}`).toBeLessThanOrEqual(PLACE_MEDIAN_BUDGET);
  });
  it('no page grows by more than 50%, and the listed exceptions stay under 100%', () => {
    expect(r.over.map((s) => `${s.slug} ${s.was} to ${s.now}`)).toEqual([]);
  });
});
