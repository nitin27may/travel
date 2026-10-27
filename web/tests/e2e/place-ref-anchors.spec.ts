import { expect, test } from './fixtures';

// REF-W (public-ref-aliases A8): element ids and links built from capture refs now hold the PUBLIC ref (no month in
// `canadian-rockies-sept-2029`), and an in-page anchor, a deep link and every link on a Rockies place, a trail and a trip page still land.
const GONDOLA = '/places/banff-gondola/';
const TRAIL = '/places/larch-valley-to-sentinel-pass/';
const TRIP = '/trips/canadian-rockies-2029/';
// `#row-<key>` and `#su-<key>` links (gap chips, who-it-suits) have no target on main either in some cases (the id is not rendered): not ref ids, out of this spec.
const refAnchors = (hs: string[]) => hs.filter((h) => h.length > 1 && h !== '#main' && !/^#(?:row|su)-/.test(h));
const DATED = /canadian-rockies-(?:jan|feb|mar|apr|may|june?|july?|aug|sept?|oct|nov|dec)[a-z]*-2029/i;

test.describe('public refs in ids and anchors', () => {
  test('a deep link to an offer row of banff-gondola scrolls to the row', async ({ page, site }) => {
    await page.goto(`${site.url}${GONDOLA}`);
    const id = await page.locator('[id^="offer-legacy-canadian-rockies-2029-"]').first().getAttribute('id');
    expect(id).toBeTruthy();
    expect(id).not.toMatch(DATED);
    await page.goto(`${site.url}${GONDOLA}#${id}`);
    const row = page.locator(`[id="${id}"]`);
    await expect(row).toBeInViewport();
  });

  test('every in-page anchor of banff-gondola, opened as a deep link, lands on its target', async ({ page, site }) => {
    await page.goto(`${site.url}${GONDOLA}`);
    const hrefs = refAnchors(await page.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute('href')!)));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) {
      await page.goto(`${site.url}${GONDOLA}${h}`);
      const target = page.locator(`[id="${h.slice(1)}"]`).first();
      expect(await target.count(), h).toBe(1);
      if (await target.isVisible()) await expect(target, h).toBeInViewport();
    }
  });

  for (const path of [GONDOLA, TRAIL, TRIP]) {
    test(`${path}: no dated ref in the DOM, every in-page anchor has a target and every internal link answers`, async ({ page, site, request }) => {
      await page.goto(`${site.url}${path}`);
      const html = await page.content();
      expect(html).not.toMatch(DATED);
      const hashes = refAnchors(await page.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute('href')!)));
      for (const h of hashes) expect(await page.locator(`[id="${decodeURIComponent(h.slice(1))}"]`).count(), h).toBeGreaterThan(0);
      const links = await page.$$eval('a[href^="/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')!.split('#')[0]!))]);
      expect(links.length).toBeGreaterThan(0);
      const bad: string[] = [];
      for (const l of links.filter((x) => /^\/(places|trips)\//.test(x))) {
        const res = await request.get(`${site.url}${l}`);
        if (res.status() >= 400) bad.push(`${res.status()} ${l}`);
      }
      expect(bad).toEqual([]);
    });
  }
});
