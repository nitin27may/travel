import { expect, test } from './fixtures';

// OVERFLOW-FIX: no page may scroll sideways on a phone. v0.2 found 66 of 358 place pages wider than a 320 px screen (a grid track
// sized to its chips, a 19rem column, a cover search card). One test per width walks the home page and every place page in the
// sitemap in a single context, so the whole catalogue is checked in about a minute and a new long chip or row cannot slip in.
const WIDTHS = [320, 390];

test.describe('no horizontal overflow on phones (home and every place page)', () => {
  test.setTimeout(600_000);
  for (const width of WIDTHS) {
    test(`home and all place pages fit ${width} px`, async ({ browser, site }) => {
      const xml = await (await fetch(`${site.url}/sitemap.xml`)).text();
      const places = [...new Set([...xml.matchAll(/\/places\/[^<\/\s]+\//g)].map((m) => m[0]))];
      expect(places.length, 'place pages found in the sitemap').toBeGreaterThan(300);
      const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'en-CA' });
      const page = await context.newPage();
      const wide: string[] = [];
      for (const url of ['/', ...places]) {
        await page.goto(`${site.url}${url}`, { waitUntil: 'load' });
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 0) wide.push(`${url} +${over}px`);
      }
      await context.close();
      expect(wide, `pages wider than ${width} px`).toEqual([]);
    });
  }
});
