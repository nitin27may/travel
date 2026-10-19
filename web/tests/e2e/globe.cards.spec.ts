import { expect, test } from './fixtures';

// Cards and floating chrome on the built export with remote tiles blocked (spec 3.2, 4.3; checks 3, 12, 22, 23, 26; acceptance A4).
// The map never gets a style here, but the page chrome, the pins and the cards are all real.
const FLOATERS = ['.globe-crumbs', '.globe-search', '.globe-status', '.globe-card-controls', '.globe-card-pill', '.globe-options-btn', '.globe-list-btn', '.globe-zoom', '.globe-hint', '.globe-panel', '.globe-panel-tab', '.globe-card-sheet', '.globe-card-dock', '.globe-card', '.globe-feature', '.globe-sheet .sheet-panel', '.maplibregl-ctrl-attrib'];

async function overlaps(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate((sels) => {
    const seen = sels.flatMap((s) => [...document.querySelectorAll(s)].filter((el) => {
      const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
      return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && b.width > 0 && b.height > 0;
    }).map((el) => ({ sel: s, el, b: el.getBoundingClientRect() })));
    const out: string[] = [];
    for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) {
      const a = seen[i], c = seen[j];
      if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
      // the pin-anchored card sits where the camera puts its pin; with no map style there is no flight, so only the fixed placements are checked here
      if ((a.sel === '.globe-card' && !a.el.closest('.globe-card-dock, .globe-card-sheet')) || (c.sel === '.globe-card' && !c.el.closest('.globe-card-dock, .globe-card-sheet'))) continue;
      const w = Math.min(a.b.right, c.b.right) - Math.max(a.b.left, c.b.left);
      const h = Math.min(a.b.bottom, c.b.bottom) - Math.max(a.b.top, c.b.top);
      if (w > 1 && h > 1) out.push(`${a.sel} x ${c.sel} (${Math.round(w)} x ${Math.round(h)})`);
    }
    return out;
  }, FLOATERS);
}

test.describe('globe cards', () => {
  test('a place with no photo shows the compact header, never an empty well, and never "Draft" or a household status (check 23, A4)', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/place/adolf-munkel-weg/`);
    const card = page.locator('.globe-card');
    await expect(card).toBeVisible();
    await expect(card.locator('.globe-card-head')).toBeVisible();
    const empties = await card.evaluate((el) => [...el.querySelectorAll('*')].filter((n) => {
      const cs = getComputedStyle(n); const b = n.getBoundingClientRect();
      return b.height > 96 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && n.children.length === 0 && !n.textContent?.trim();
    }).length);
    expect(empties, 'no element taller than 96 px with a background and no children').toBe(0);
    const text = (await card.innerText()).toLowerCase();
    for (const w of ['draft', 'planned', 'shortlisted', 'visited', 'dropped']) expect(text, w).not.toContain(w);
    await expect(card.getByRole('link', { name: /Open place/ })).toBeVisible();
    await expect(card.getByRole('link', { name: /Directions/ })).toHaveAttribute('href', /google\.com\/maps\/dir\/.*destination=46\.\d+,11\.\d+/);
    await expect(card.getByRole('button', { name: 'Share' })).toBeVisible();
    expect(await card.getByRole('button', { name: 'Close details' }).count(), 'one close button').toBe(1);
  });

  test('the card names the public trip that uses the place and the day', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/place/adolf-munkel-weg/`);
    await expect(page.locator('.globe-card-used')).toContainText(/Used in .*Dolomites/);
  });

  test('a card with a photo shows the image with its credit, served from our own renditions when the build has them', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/place/lake-louise/`);
    const card = page.locator('.globe-card');
    await expect(card).toBeVisible();
    if (await card.locator('.globe-card-photo img').count()) {
      await expect(card.locator('.globe-card-credit-on')).toContainText(/CC|Public domain|licen/i);
      const src = await card.locator('.globe-card-photo img').getAttribute('src');
      expect(src, 'a card image is never read from Commons in the built site').toMatch(/^\/img\//);
    } else {
      await expect(card.locator('.globe-card-head')).toBeVisible();
    }
  });

  test('the tooltip is hidden while a card is open', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/place/adolf-munkel-weg/`);
    await expect(page.locator('.globe-card')).toBeVisible();
    await expect(page.locator('.globe-tip')).toBeHidden();
  });

  for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test(`no two floating elements overlap at ${vp.width}x${vp.height}: world, a country, a place card (check 3, 26)`, async ({ browser, site }) => {
      const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 900 });
      const page = await ctx.newPage();
      await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
      for (const url of ['/globe/', '/globe/it/', '/globe/place/adolf-munkel-weg/']) {
        await page.goto(`${site.url}${url}`);
        await page.locator('.globe-top').waitFor();
        await page.waitForTimeout(900);
        expect(await overlaps(page), `${url} at ${vp.width}x${vp.height}`).toEqual([]);
      }
      await ctx.close();
    });
  }

  test('Map options pill opens the card; immersive hides every control but the attribution and Show controls brings them back', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    await page.getByRole('button', { name: 'Map options' }).click();
    await page.getByRole('button', { name: /Hide controls/ }).click();
    await expect(page.locator('.globe-panel')).toHaveCSS('opacity', '0');
    await expect(page.getByRole('button', { name: 'Show controls' })).toBeVisible();
    await page.getByRole('button', { name: 'Show controls' }).click();
    await expect(page.locator('.globe-panel')).toHaveCSS('opacity', '1');
    await page.keyboard.press('.');
    await expect(page.locator('.globe-panel')).toHaveCSS('opacity', '0');
    await page.keyboard.press('Escape');
    await expect(page.locator('.globe-panel')).toHaveCSS('opacity', '1');
  });

  test('at 390 the search results draw over the breadcrumb (review M3)', async ({ browser, site }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
    await page.goto(`${site.url}/globe/it/south-tyrol/`);
    await page.getByRole('combobox', { name: 'Search the globe' }).fill('ital');
    const first = page.getByRole('option').first();
    await expect(first).toBeVisible();
    const b = (await first.boundingBox())!;
    const over = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.globe-results') !== null, [b.x + b.width / 2, b.y + b.height / 2]);
    expect(over, 'the first result is not under the breadcrumb').toBe(true);
    await ctx.close();
  });

  test('landscape: Open place stays on the screen and the dock leaves the attribution clear (review M4)', async ({ browser, site }) => {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
    await page.goto(`${site.url}/globe/place/lake-louise/`);
    const open = page.locator('.globe-card-dock').getByRole('link', { name: /Open place/ });
    await expect(open).toBeVisible();
    const b = (await open.boundingBox())!;
    expect(b.y + b.height, 'Open place is on the 390 px screen').toBeLessThanOrEqual(390);
    const dock = (await page.locator('.globe-card-dock').boundingBox())!;
    const attr = await page.locator('.maplibregl-ctrl-attrib').boundingBox();
    if (attr) expect(dock.y + dock.height <= attr.y || dock.x + dock.width <= attr.x, 'the dock does not cover the attribution').toBe(true);
    await ctx.close();
  });

  for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test(`at ${vp.width}x${vp.height} the search results draw above the map buttons (round 3)`, async ({ browser, site }) => {
      const ctx = await browser.newContext({ viewport: vp, hasTouch: true });
      const page = await ctx.newPage();
      await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
      await page.goto(`${site.url}/globe/it/south-tyrol/`);
      await page.getByRole('combobox', { name: 'Search the globe' }).fill('ital');
      await expect(page.getByRole('option').first()).toBeVisible();
      const hidden = await page.evaluate(() => {
        const res = document.querySelector('.globe-results')!.getBoundingClientRect();
        const bad: string[] = [];
        for (const sel of ['.globe-zoom', '.globe-options-btn', '.globe-list-btn', '.globe-card-pill']) {
          const el = document.querySelector(sel); if (!el) continue;
          const b = el.getBoundingClientRect();
          const l = Math.max(res.left, b.left), r = Math.min(res.right, b.right), t = Math.max(res.top, b.top), bt = Math.min(res.bottom, b.bottom);
          if (r - l > 2 && bt - t > 2 && !document.elementFromPoint((l + r) / 2, (t + bt) / 2)?.closest('.globe-results')) bad.push(sel);
        }
        return bad;
      });
      expect(hidden, 'a map button draws over the results').toEqual([]);
      await ctx.close();
    });
  }

  for (const slug of ['lake-louise', 'adolf-munkel-weg']) {
    test(`landscape: the place name is fully visible without scrolling (${slug}) (round 3)`, async ({ browser, site }) => {
      const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
      const page = await ctx.newPage();
      await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
      await page.goto(`${site.url}/globe/place/${slug}/`);
      const dock = page.locator('.globe-card-dock');
      await expect(dock).toBeVisible();
      const m = await page.evaluate(() => {
        const t = document.querySelector('.globe-card-dock .globe-card-title')!.getBoundingClientRect();
        const a = document.querySelector('.globe-card-dock .globe-card-actions')!.getBoundingClientRect();
        const d = document.querySelector('.globe-card-dock')!.getBoundingClientRect();
        return { titleTop: t.top, titleBottom: t.bottom, actionsTop: a.top, dockTop: d.top };
      });
      expect(m.titleTop, 'the title starts inside the dock').toBeGreaterThanOrEqual(m.dockTop);
      expect(m.titleBottom, 'the title ends above the actions footer').toBeLessThanOrEqual(m.actionsTop);
      await ctx.close();
    });
  }
});
