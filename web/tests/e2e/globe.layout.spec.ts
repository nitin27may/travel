import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from './fixtures';

// Layout checks on the BUILT export (.site). The canvas size check needs WebGL, so it launches Chromium with a software GL
// backend and aborts remote tiles: the map is created and sized even though the style never arrives.
const CHROME = path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
const GL_REAL = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
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

  test('Reset view button and Home return to the world; Esc closes the card before stepping up', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/place/adolf-munkel-weg/`);
    await expect(page.locator('.globe-card')).toBeVisible();
    // the breadcrumb chip is never under the card
    const chip = await page.locator('.globe-crumbs').boundingBox();
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.globe-crumbs') !== null, [chip!.x + 20, chip!.y + chip!.height / 2]);
    expect(hit).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('.globe-card')).toHaveCount(0);
    await expect(page).toHaveURL(/\/globe\/it\/south-tyrol\/val-di-funes\//);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/globe\/it\/south-tyrol\//);
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect(page).toHaveURL(/\/globe\/(\?|$)/);
    await page.goto(`${site.url}/globe/it/`);
    await expect(page.getByRole('heading', { name: 'Italy', level: 2 })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.keyboard.press('Home');
    await expect(page).toHaveURL(/\/globe\/(\?|$)/);
    await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();
  });

  // 9b and 9c of the experience review: a drag at world zoom pans the globe and its release never drills in.
  test('drag at world zoom pans the globe, coasts, and the release does not drill into a country', async ({ site }) => {
    const browser = await chromium.launch({ executablePath: CHROME, args: GL_REAL });
    try {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.addInitScript(() => localStorage.setItem('travel:v1:globe', JSON.stringify({ spin: true })));
      await page.goto(`${site.url}/globe/`);
      await page.waitForSelector('.maplibregl-canvas', { timeout: 30_000 });
      await page.waitForTimeout(4000);
      const lng = async () => Number(new URL(page.url()).searchParams.get('c')?.split(',')[0]);
      const before = await lng();
      // over open water, left of the Atlantic pins; the spin is running at mousedown
      await page.mouse.move(420, 450);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(420 + i * 25, 450, { steps: 2 });
      await page.mouse.up();
      await page.waitForTimeout(900);
      const after = await lng();
      expect(new URL(page.url()).pathname).toBe('/globe/');
      expect(Math.abs(after - before)).toBeGreaterThanOrEqual(20);
      await ctx.close();
    } finally { await browser.close(); }
  });
});
