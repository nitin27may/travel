import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB_DIR } from './support';

// S13: place page HTML stays within +25% of the baseline taken before S1 Part B (tests/data/place-html-baseline.json): the median page and the largest.
// Reads the real build in web/out; skipped when there is none (the check-all order builds after the tests, so a clean checkout runs it on the second pass).
const baseline = JSON.parse(readFileSync(path.join(WEB_DIR, 'tests', 'data', 'place-html-baseline.json'), 'utf8')) as { pages: Record<string, number> };
const OUT = path.join(WEB_DIR, 'out', 'places');
const BUDGET = 1.25;
/**
 * No single page grows by more than 50%, except these. They are small pages (about 45 kB before) of fully researched records: every
 * suitability group, provenance row and section now has content, and the page carries it once in the payload. They stay under +100%.
 * CS7c added Funbob, Otzi, Paint Pots and Wedge Pond (+51 to 54%): small pages that gained a full record (price, hours, season, official links).
 * PLC (stage 4) added lago-di-carezza (+49.7% to +51.2%): a small page that crossed the line by the stroller and wheelchair chips at rest (S10),
 * which are drawn twice (markup and payload); the median grew by 0.05%.
 * A page leaves this list when it passes 50%; a new one must be argued in review, not added here.
 */
const OVER_50 = new Set(["rafting-on-the-rienza", "chorrillo-del-salto", "coastal-path", "delicate-arch-trail", "devils-garden", "emerald-lakeshore", "grassi-lakes-easy-route", "ha-ling-peak", "hickman-bridge", "iceline-trail", "lac-blanc-via-flegere", "lago-di-braies-walk", "laguna-capri", "laguna-de-los-tres", "laguna-esmeralda", "lake-louise", "lower-calf-creek-falls", "marble-canyon-walk", "mirador-de-las-aguilas", "mirador-de-los-condores", "narrows-from-the-temple-of-sinawava", "navajo-loop-and-queens-garden", "parus-trail", "plan-de-laiguille", "riverside-walk", "scout-lookout-angels-landing-chains-view", "skaftafell-svartifoss", "solitaire-lake-trail", "stowe-recreation-path", "takakkaw-falls-walk", "track-and-tower-trail", "troll-falls", "upheaval-dome", "windows-section", "funbob-monte-baranci", "otzi-south-tyrol-museum-of-archaeology", "paint-pots-walk", "wedge-pond-loop", "lago-di-carezza"]);
const PAGE_CAP = 1.5;
const EXCEPTION_CAP = 2;

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
  it.skipIf(sizes.length === 0)('no page grows by more than 50%, and the listed exceptions stay under 100%', () => {
    const bad = sizes.filter((s) => s.now / s.was > (OVER_50.has(s.slug) ? EXCEPTION_CAP : PAGE_CAP)).map((s) => `${s.slug} ${s.was} to ${s.now}`);
    expect(bad).toEqual([]);
  });
});
