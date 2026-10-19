import { expect, test } from './fixtures';

// The units toggle reaches every distance and height on a place page (verifier 3): sections, chips, group summaries, nearby lists,
// the pointer and the timeline chips. The map's own scale bar belongs to the map and is left out.
const PAGES = ['/places/lake-louise/', '/places/larch-valley-to-sentinel-pass/', '/places/moraine-lakeshore/', '/places/otzi-south-tyrol-museum-of-archaeology/', '/places/athabasca-falls-walk/', '/places/bald-hills/', '/places/alpe-di-siusi/'];

test.describe('units on place pages', () => {
  for (const url of PAGES) {
    test(`mi and ft on ${url}`, async ({ page, site }) => {
      await page.addInitScript(() => localStorage.setItem('travel:v1:prefs', JSON.stringify({ distance: 'mi', elevation: 'ft' })));
      await page.goto(`${site.url}${url}`);
      await page.waitForLoadState('networkidle');
      // open every disclosure so collapsed summaries and bodies are all in the text
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
      const text = await page.evaluate(() => {
        const clone = document.querySelector('article.pl-page')!.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.pl-mapcard, .maplibregl-ctrl, script, style, blockquote').forEach((n) => n.remove());
        return clone.textContent ?? '';
      });
      const bad = [...text.matchAll(/\d[\d,.]*\s?(?:km|cm|m)\b/g)].map((m) => text.slice(Math.max(0, (m.index ?? 0) - 25), (m.index ?? 0) + 12).replace(/\s+/g, ' '));
      expect(bad).toEqual([]);
    });
  }
});
