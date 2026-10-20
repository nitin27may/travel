import { describe, expect, it } from 'vitest';
import { SITEMAP_LIMIT, indexXml, sitemapInput, sitemapPlan, urlsetXml } from '@/lib/sitemap';

describe('the sitemap plan (2.41)', () => {
  const slugs = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
  it('is one file up to the limit', () => {
    const plan = sitemapPlan(sitemapInput(slugs(350), slugs(14)));
    expect(plan.index).toBe(false);
    expect(plan.files).toHaveLength(1);
    expect(plan.files[0]!.paths).toHaveLength(7 + 350 + 14);
  });
  it('is an index of per-kind files past the limit, and every url is in exactly one file', () => {
    const input = sitemapInput(slugs(10_000), slugs(14));
    const plan = sitemapPlan(input);
    expect(plan.index).toBe(true);
    expect(plan.files.map((f) => f.id)).toEqual(['pages', 'places-1', 'places-2']);
    expect(Math.max(...plan.files.map((f) => f.paths.length))).toBeLessThanOrEqual(SITEMAP_LIMIT);
    const all = plan.files.flatMap((f) => f.paths);
    expect(all).toHaveLength(7 + 10_000 + 14);
    expect(new Set(all).size).toBe(all.length);
  });
  it('writes valid xml', () => {
    expect(urlsetXml(['/a/', '/b&c/'])).toContain('<loc>https://');
    expect(urlsetXml(['/b&c/'])).toContain('&amp;');
    expect(indexXml(['pages', 'places-1'])).toContain('/sitemaps/places-1/sitemap.xml</loc>');
  });
});
