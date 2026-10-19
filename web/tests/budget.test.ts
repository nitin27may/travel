import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB, readText, walkFiles } from './helpers';

const OUT = path.join(WEB, 'out');
const LIST_BUDGET_KB = 200;
const PLACE_BUDGET_KB = 180;

/**
 * Same-origin <script src> tags in the exported HTML that a modern browser runs at load: what is
 * there before any dynamic import. `noModule` scripts (legacy polyfills) are skipped, as browsers do.
 */
export function startScripts(html: string): string[] {
  return [...html.matchAll(/<script\b([^>]*)>/g)]
    .map((m) => m[1])
    .filter((attrs) => !/\bnoModule\b/i.test(attrs))
    .map((attrs) => /\ssrc="([^"]+)"/.exec(` ${attrs}`)?.[1])
    .filter((s): s is string => Boolean(s) && s!.startsWith('/'));
}

export function gzippedKb(srcs: string[]): number {
  const unique = [...new Set(srcs)];
  return unique.reduce((n, s) => n + gzipSync(readFileSync(path.join(OUT, s.split('?')[0]))).length, 0) / 1024;
}

const GLOBE_HTML_BUDGET_KB = 200;

describe('globe pages carry no pin list (backlog 2.39)', () => {
  const globePages = walkFiles(path.join(OUT, 'globe')).filter((f) => f.endsWith('index.html'));

  it(`keeps every globe page's HTML under ${GLOBE_HTML_BUDGET_KB} KB, with the pins and cards in data files`, () => {
    expect(globePages.length).toBeGreaterThan(20);
    const sizes = globePages.map((f) => ({ page: path.relative(OUT, f), kb: readFileSync(f).length / 1024 })).sort((a, b) => b.kb - a.kb);
    console.log(`globe HTML: largest ${sizes[0].page} ${sizes[0].kb.toFixed(1)} KB of ${sizes.length} pages`);
    expect(sizes[0].kb, `${sizes[0].page} is ${sizes[0].kb.toFixed(1)} KB`).toBeLessThanOrEqual(GLOBE_HTML_BUDGET_KB);
    for (const f of globePages.slice(0, 20)) {
      const html = readText(f);
      expect(html, f).not.toContain('"kindLabel"');
      expect(html, f).not.toMatch(/"lat":-?\d/);
    }
  });

  it('writes the tree, one pin file per country and one card file per pin', () => {
    const tree = JSON.parse(readText(path.join(OUT, 'globe-data', 'index.json'))) as { continents: { countries: { slug: string }[] }[] };
    const countries = tree.continents.flatMap((c) => c.countries.map((n) => n.slug));
    expect(countries.length).toBeGreaterThan(3);
    expect(statSync(path.join(OUT, 'globe-data', 'index.json')).size / 1024).toBeLessThan(60);
    for (const cc of countries) {
      const file = path.join(OUT, 'globe-data', 'pins', cc, 'data.json');
      expect(existsSync(file), cc).toBe(true);
      const pins = JSON.parse(readText(file)) as Record<string, unknown>[];
      expect(statSync(file).size / pins.length, `${cc}: bytes per pin`).toBeLessThan(400);
      for (const p of pins) expect(Object.keys(p).sort()).toEqual(['approx', 'kind', 'kindLabel', 'lat', 'lon', 'name', 'path', 'slug', 'tier', 'type']);
    }
  });
});

describe('JS budget: gzipped scripts loaded at start, per exported page', () => {
  const pages = walkFiles(OUT).filter((f) => f.endsWith('index.html'));

  it('exports pages to measure', () => {
    expect(pages.length).toBeGreaterThan(70);
  });

  it('parses script tags the way the test expects', () => {
    expect(startScripts('<script src="/_next/a.js" async=""></script><script src="https://x.test/b.js"></script><script>inline()</script><script src="/_next/poly.js" noModule=""></script>')).toEqual(['/_next/a.js']);
  });

  it(`keeps every page under ${LIST_BUDGET_KB} KB (the list pages are the heaviest)`, () => {
    const sizes = pages.map((f) => ({ page: '/' + path.relative(OUT, path.dirname(f)).split(path.sep).join('/'), kb: gzippedKb(startScripts(readText(f))) }));
    const heaviest = [...sizes].sort((a, b) => b.kb - a.kb);
    console.log('JS budget (gzipped KB, scripts at load):\n' + ['/places', '/trips', '/', '/about/data'].map((p) => `  ${p || '/'}: ${(sizes.find((s) => s.page === p || (p === '/' && s.page === '/.'))?.kb ?? 0).toFixed(1)}`).join('\n'));
    expect(heaviest[0].kb, `${heaviest[0].page} is ${heaviest[0].kb.toFixed(1)} KB`).toBeLessThanOrEqual(LIST_BUDGET_KB);
  });

  it('keeps the popover library out of the list pages start bundle (backlog 2.7: it loads after hydration)', () => {
    for (const page of ['places', 'trips']) {
      for (const s of startScripts(readText(path.join(OUT, page, 'index.html')))) expect(readText(path.join(OUT, s.split('?')[0])), `${page}: ${s}`).not.toContain('data-base-ui');
    }
  });

  it(`keeps every place page under ${PLACE_BUDGET_KB} KB and the popover library out of its start bundle (backlog 2.27)`, () => {
    const places = pages.filter((f) => /\/places\/[^/]+\/index\.html$/.test(f.split(path.sep).join('/')));
    expect(places.length).toBeGreaterThan(10);
    const sizes = places.map((f) => ({ page: path.basename(path.dirname(f)), kb: gzippedKb(startScripts(readText(f))) })).sort((a, b) => b.kb - a.kb);
    expect(sizes[0].kb, `${sizes[0].page} is ${sizes[0].kb.toFixed(1)} KB`).toBeLessThanOrEqual(PLACE_BUDGET_KB);
    for (const f of places.slice(0, 5)) for (const s of startScripts(readText(f))) expect(readText(path.join(OUT, s.split('?')[0])), `${f}: ${s}`).not.toContain('data-base-ui');
  });

  it('does not ship a map library in the initial bundle', () => {
    for (const f of pages.slice(0, 5)) for (const s of startScripts(readText(f))) expect(readText(path.join(OUT, s.split('?')[0]))).not.toContain('maplibre');
  });
});
