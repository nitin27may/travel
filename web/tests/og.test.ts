import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readText, walkFiles } from './helpers';
import { builtOutDir } from './helpers/built';

const OUT = builtOutDir();
const HOST = 'nks-travel.pages.dev';
const pages = walkFiles(OUT).filter((f) => f.endsWith('.html'));
const rel = (f: string) => path.relative(OUT, f);

describe('Open Graph and canonical tags', () => {
  it('puts og:title, og:description, og:image and og:url on every exported page', () => {
    expect(pages.length).toBeGreaterThan(70);
    const bad: string[] = [];
    for (const f of pages) {
      const html = readText(f);
      for (const p of ['og:title', 'og:description', 'og:image', 'og:url']) if (!html.includes(`property="${p}"`)) bad.push(`${rel(f)}: ${p}`);
      if (!html.includes('name="twitter:card" content="summary_large_image"')) bad.push(`${rel(f)}: twitter:card`);
      if (!/<link rel="canonical" href="https:\/\/[^"]+"/.test(html)) bad.push(`${rel(f)}: canonical`);
      if (!/<html lang="en"/.test(html)) bad.push(`${rel(f)}: html lang`);
    }
    expect(bad).toEqual([]);
  });

  it('builds og:url and canonical from the page path', () => {
    const html = readText(path.join(OUT, 'places', 'index.html'));
    expect(html).toContain(`<link rel="canonical" href="https://${HOST}/places/"`);
    expect(html).toContain(`property="og:url" content="https://${HOST}/places/"`);
  });

  it('hard-codes the host nowhere else: only canonical and OG tags, robots.txt and the sitemap', () => {
    const offenders: string[] = [];
    for (const f of walkFiles(OUT).filter((x) => /\.(html|txt|js|css|json|xml)$/.test(x))) {
      const name = rel(f);
      if (name === 'robots.txt' || name === 'sitemap.xml') continue;
      let text = readText(f);
      if (!text.includes(HOST)) continue;
      // the head tags that legitimately carry it, in HTML and in the RSC payload that repeats them
      text = text.replace(/<meta[^>]*>/g, '').replace(/<link[^>]*>/g, '');
      text = text.replace(/\\?"(content|href|url|canonical|images|metadataBase)\\?":\\?"[^"\\]*nks-travel\.pages\.dev[^"\\]*\\?"/g, '');
      text = text.replace(/https:\/\/nks-travel\.pages\.dev[^"'\s\\<]*/g, (m) => (/^https:\/\/nks-travel\.pages\.dev\/(og-default\.png|[a-z0-9/_.-]*)$/.test(m) ? '' : m));
      if (text.includes(HOST)) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });

  it('uses SITE_ORIGIN when set (the fixture build uses https://example.test)', () => {
    const html = readText(path.join(builtOutDir('.fixture-out'), 'places', 'index.html'));
    expect(html).toContain('property="og:url" content="https://example.test/places/"');
    expect(html).not.toContain(HOST);
  });
});
