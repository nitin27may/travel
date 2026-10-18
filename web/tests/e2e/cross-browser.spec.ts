import { expect, test } from './fixtures';
import { setTheme, SHOT_DIR } from './shots';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

// The smoke set the WebKit (iPhone 14, desktop Safari) and Firefox projects run (2.10), screenshots included.
// Chromium runs it too, so a failure that appears only in one engine is plain.
const PAGES: [string, string, RegExp | null][] = [
  ['home', '/', /Trip plans/i],
  ['trips', '/trips/', /Trips/i],
  ['trip', '/trips/dolomites-2027/', /Dolomites/i],
  ['places', '/places/', /Places/i],
  ['place', '/places/lago-di-braies/', /Lago di Braies/i],
  ['trail', '/places/tre-cime-di-lavaredo-loop/', /Tre Cime/i],
  ['globe', '/globe/', null],
];

test.describe('smoke', () => {
  for (const [name, url, heading] of PAGES) {
    test(`${name} renders its heading, has no horizontal scroll and no page error`, async ({ page, site }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${site.url}${url}`, { waitUntil: 'networkidle' });
      if (heading) await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
      else await expect(page.locator('.globe-root')).toBeVisible(); // the globe has no page heading; its shell is the page
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, 'horizontal overflow').toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
      const dir = path.join(SHOT_DIR, 'INTA', info.project.name);
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `${name}.png`) });
    });
  }

  test('search opens from the header and finds a trip', async ({ page, site }) => {
    await page.goto(`${site.url}/about/data/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Search' }).first().click();
    await page.getByRole('combobox').fill('dolomites');
    await expect(page.getByRole('group', { name: 'Trips' })).toBeVisible();
  });

  test('globe: the shell loads, a country drills in, the canvas element exists', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    await expect(page.locator('.globe-canvas')).toHaveCount(1);
    // on a phone the list is the 'Countries' sheet, on a wide screen the side panel
    const list = (page.viewportSize()?.width ?? 1280) < 640 ? page.getByRole('dialog', { name: 'Countries' }) : page.locator('.globe-panel');
    await expect(list).toBeVisible();
    await list.getByRole('button', { name: /Italy/ }).click();
    await expect(page).toHaveURL(/\/globe\/it\//);
  });

  test('dark theme paints the dark surface', async ({ page, site }) => {
    await setTheme(page, 'dark');
    await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe('rgb(255, 255, 255)');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
  });
});

// The harness blocks every remote host, so the specs above never see a basemap. This one lets the tile servers through
// and asks each engine, headless, whether the globe actually draws (WebGL context, style loaded, one canvas, no fallback).
test.describe('basemap draws (real tiles)', () => {
  test.use({ allowRemote: true });
  test.setTimeout(90_000);
  test.beforeAll(async () => {
    const ok = await fetch('https://tiles.openfreemap.org/styles/liberty').then((r) => r.ok).catch(() => false);
    test.skip(!ok, 'tile server not reachable from this machine');
  });
  for (const [name, url, sel] of [['home cover', '/', '.home-globe .globe-canvas'], ['globe page', '/globe/', '.globe-root .globe-canvas']] as const) {
    test(`${name}: WebGL, style loaded, no tile fallback`, async ({ page, site }) => {
      await page.goto(`${site.url}${url}`);
      await expect(page.locator(sel)).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
      await expect(page.locator(`${sel} canvas.maplibregl-canvas`)).toHaveCount(1);
      await expect(page.locator('.globe-fail, .globe-fail-note')).toHaveCount(0);
      await expect(page.getByText(/AJAXError/)).toHaveCount(0);
    });
  }
});
