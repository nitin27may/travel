import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';
import { ROOT } from './fixtures';

// Server-mode checks from the G-B audit (GB-B-2, GB-B-4, GB-A-4).
test.describe('G-B hardening', () => {
  test('/og-manifest.json is not served by the running site', async ({ request, site }) => {
    const res = await request.get(`${site.url}/og-manifest.json`);
    expect(res.status()).toBe(404);
    expect(await res.text()).not.toMatch(/Special:FilePath/);
  });

  test('the four merged place slugs redirect to the surviving page, as the API does', async ({ request, site }) => {
    const reg = JSON.parse(readFileSync(path.join(ROOT, 'data', 'catalogue', 'slugs.json'), 'utf8')) as { places: { slugs: Record<string, string>; merged: Record<string, string> } };
    const pairs = Object.entries(reg.places.merged).map(([k, survivor]) => [reg.places.slugs[k]!, reg.places.slugs[survivor]!] as const);
    expect(pairs.length).toBeGreaterThanOrEqual(4);
    for (const [from, to] of pairs) {
      const page = await request.get(`${site.url}/places/${from}/`, { maxRedirects: 0 });
      expect(page.status(), from).toBe(308);
      expect(page.headers().location, from).toBe(`/places/${to}/`);
      const api = await request.get(`${site.url}/api/v1/places/${from}/`, { maxRedirects: 0 });
      expect(api.status(), from).toBe(308);
      expect(api.headers().location, from).toBe(`/api/v1/places/${to}/`);
    }
  });

  test('a well-formed globe level with no content is noindex and does not echo its path into the title', async ({ request, site }) => {
    const html = await (await request.get(`${site.url}/globe/ca/made-up-words/`)).text();
    expect(html).toMatch(/<meta name="robots" content="noindex/);
    expect(html).not.toMatch(/Made Up Words/i);
    const real = await (await request.get(`${site.url}/globe/ca/alberta/`)).text();
    expect(real).not.toMatch(/content="noindex/);
  });
});
