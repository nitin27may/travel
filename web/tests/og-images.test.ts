import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB, readText } from './helpers';

const OUT = path.join(WEB, 'out');
const locs = [...readText(path.join(OUT, 'sitemap.xml')).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

describe('sitemap and share images', () => {
  it('lists every exported trip and place page at its canonical URL, and nothing else but the lists', () => {
    for (const kind of ['trips', 'places'] as const) {
      const dirs = locs.filter((l) => l.startsWith(`/${kind}/`) && l !== `/${kind}/`);
      expect(dirs.length).toBeGreaterThan(10);
      for (const l of dirs) {
        expect(existsSync(path.join(OUT, l, 'index.html')), l).toBe(true);
        expect(readText(path.join(OUT, l, 'index.html'))).toContain(`<link rel="canonical" href="https://nks-travel.pages.dev${l}"/>`);
      }
    }
    expect(locs).not.toContain('/specimen/');
  });

  it('writes one reasonably small image per trip and place, and the page tag points at it', () => {
    for (const l of locs.filter((x) => /^\/(trips|places)\/[^/]+\/$/.test(x))) {
      const [, kind, slug] = l.split('/');
      const file = path.join(OUT, 'og', kind, `${slug}.jpg`);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeLessThan(200 * 1024);
      expect(readText(path.join(OUT, l, 'index.html'))).toContain(`og:image" content="https://nks-travel.pages.dev/og/${kind}/${slug}.jpg"`);
    }
  });

  it('keeps the specimen out of the index', () => {
    expect(readText(path.join(OUT, 'specimen', 'index.html'))).toMatch(/name="robots" content="noindex/);
    expect(existsSync(path.join(OUT, 'og-manifest.json'))).toBe(false);
  });
});
