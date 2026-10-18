import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from './fixtures';

// Layout checks on the BUILT export (.site). The canvas size check needs WebGL, so it launches Chromium with a software GL
// backend and aborts remote tiles: the map is created and sized even though the style never arrives.
const CHROME = path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

test.describe('globe layout', () => {
  for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test(`canvas fills the root and every drawn pin is centred inside it at ${vp.width}x${vp.height}`, async ({ site }) => {
      const browser = await chromium.launch({ executablePath: CHROME, args: GL });
      try {
        const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 900 });
        const page = await ctx.newPage();
        await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
        await page.goto(`${site.url}/globe/`);
        await page.waitForSelector('.maplibregl-canvas', { timeout: 30_000 });
        await page.waitForTimeout(1500); // the world frame animates in and the pins settle
        const m = await page.evaluate(() => {
          const r = (el: Element | null) => { const b = el?.getBoundingClientRect(); return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null; };
          const root = r(document.querySelector('.globe-root'))!;
          const canvas = r(document.querySelector('.maplibregl-canvas'))!;
          const pins = [...document.querySelectorAll('.globe-pin')].filter((p) => getComputedStyle(p).visibility !== 'hidden').map((p) => r(p)!);
          return { root, canvas, outside: pins.filter((p) => p.x + p.w / 2 < root.x || p.y + p.h / 2 < root.y || p.x + p.w / 2 > root.x + root.w || p.y + p.h / 2 > root.y + root.h).length, pins: pins.length };
        });
        expect(m.canvas.h).toBeGreaterThanOrEqual(Math.min(400, m.root.h));
        expect(Math.abs(m.canvas.h - m.root.h)).toBeLessThanOrEqual(1);
        expect(Math.abs(m.canvas.w - m.root.w)).toBeLessThanOrEqual(1);
        expect(m.pins).toBeGreaterThan(0);
        expect(m.outside).toBe(0);
      } finally { await browser.close(); }
    });
  }

  test('landscape phone: 300 px side peek, options behind a button, no stacked control card', async ({ browser, site }) => {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
    await page.goto(`${site.url}/globe/`);
    const panel = page.locator('.globe-panel');
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())?.width).toBe(300);
    await expect(page.locator('.globe-card-controls')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Map options' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await ctx.close();
  });

  test('a country with nothing saved keeps its live facts in an empty-state card', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    const search = page.getByRole('combobox', { name: 'Search the globe' });
    await search.fill('Japan');
    await expect(page.getByRole('option').first()).toContainText('Japan');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/globe\/jp\//);
    const card = page.locator('.globe-country-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Japan' })).toBeVisible();
    await expect(card).toContainText('Tokyo');
    await expect(card).toContainText('Japanese');
    await expect(card).toContainText('Nothing saved here yet');
  });

  test('the control card collapses to a pill and opens again', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    await expect(page.getByRole('radiogroup', { name: 'Map style' })).toBeVisible();
    await page.getByRole('button', { name: 'Collapse the map options' }).click();
    await expect(page.getByRole('radiogroup', { name: 'Map style' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Map options' }).click();
    await expect(page.getByRole('radiogroup', { name: 'Map style' })).toBeVisible();
  });
});
