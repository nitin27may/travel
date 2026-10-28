/* Contrast (light and dark), unnamed controls, focus traps and the layout sweep for the parks pages. Strict: any failure fails. */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { checkContrast, formatFailures } = require('../../shared/tests/contrast.js');
const { walkKeyboard } = require('../../shared/tests/keyboard.js');
const { dumpA11y } = require('../../shared/tests/a11y.js');
const { PARKS, watchErrors } = require('./helpers.js');
const path = require('node:path');

const OUT = path.resolve(__dirname, '..', '..', 'test-results', 'parks-sweep');
const INDEX_URLS = ['/parks-app/index.html', '/parks-app/index.html?view=cards', '/parks-app/index.html?view=map', '/parks-app/index.html?sort=drive-calgary'];
const PAGE_URLS = PARKS.map((p) => '/parks-app/park.html?slug=' + p.slug);
const slugOf = (u) => u.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

for (const w of [390, 1440]) {
  for (const url of [...INDEX_URLS, ...PAGE_URLS]) {
    test(`a11y ${w}px ${url.replace('/parks-app/', '')}`, async ({ page, base }) => {
      const errs = watchErrors(page);
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(base + url);
      await page.waitForLoadState('networkidle');
      const c = await checkContrast(page);
      expect(formatFailures(c)).toBe('');
      expect(c.checked).toBeGreaterThan(20);
      const k = await walkKeyboard(page, { max: 120 });
      expect(k.trapped).toBe(false);
      expect(k.noIndicator.map((s) => s.name)).toEqual([]);
      const a = await dumpA11y(page, path.join(OUT, `${slugOf(url)}-${w}.a11y.txt`));
      expect(a.unnamed).toEqual([]);
      expect(errs.list()).toEqual([]);
    });
  }
}

/* layout: no horizontal scroll at 320, 360, 390, 600, 760 and 1440, in light and dark */
for (const w of [320, 360, 390, 600, 760, 1440]) {
  test(`layout ${w}px: no horizontal scroll on the index views and a full and a compact park`, async ({ page, base }) => {
    await page.setViewportSize({ width: w, height: 844 });
    for (const theme of ['light', 'dark']) {
      for (const url of [...INDEX_URLS, '/parks-app/index.html?ps=4&page=2', '/parks-app/park.html?slug=banff-national-park', '/parks-app/park.html?slug=jasper-national-park', '/parks-app/park.html?slug=killarney-provincial-park', '/parks-app/park.html?slug=kootenay-national-park', '/parks-app/park.html?slug=lake-ohara-area&closure=1&stale=1']) {
        await page.goto(base + url);
        await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
        // open every row's details and every group so the widest content is on screen
        for (const b of await page.locator('[data-more]').all()) await b.click();
        for (const b of await page.locator('[data-expand]').all()) await b.click();
        const o = await page.evaluate(() => {
          const de = document.documentElement, over = [];
          document.querySelectorAll('body *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.right > de.clientWidth + 1 && !e.closest('.toolbar,svg,.ctl,.toast')) over.push(e.tagName.toLowerCase() + '.' + (e.className && e.className.baseVal === undefined ? e.className : '') + ' ' + Math.round(r.right)); });
          return { sw: de.scrollWidth, cw: de.clientWidth, over: over.slice(0, 5) };
        });
        expect(o.sw, `${url} ${theme}: ${o.over.join(' | ')}`).toBeLessThanOrEqual(o.cw);
      }
    }
  });
}
