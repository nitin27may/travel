import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';
import { SHOT_DIR } from './shots';

const PHONE = { width: 390, height: 844 };

test.describe('phone bottom bar Search slot and home order (SHL, backlog 2.41 and 4.15)', () => {
  test('the bar reads Trips, Places, Globe, Search; Search opens the search with focus in the input and Esc returns to the button', async ({ browser, site }) => {
    const context = await browser.newContext({ viewport: PHONE, locale: 'en-CA' });
    const page = await context.newPage();
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    const bar = page.getByRole('navigation', { name: 'Main, bottom' });
    await expect(bar.locator('a, button')).toHaveText(['Trips', 'Places', 'Globe', 'Search']);
    await expect(bar.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    const button = bar.getByRole('button', { name: 'Search' });
    await button.click();
    await expect(page.getByRole('combobox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(button).toBeFocused();
    await context.close();
  });

  test('the sign-in page stays reachable and the header shows no Sign in link while the flag is off', async ({ page, site }) => {
    await page.goto(`${site.url}/`);
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    expect((await page.goto(`${site.url}/sign-in/`))?.status()).toBe(200);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`at 390 the first screen shows the h1 and the search card above the globe (${theme})`, async ({ browser, site }) => {
      const context = await browser.newContext({ viewport: PHONE, locale: 'en-CA' });
      const page = await context.newPage();
      await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark theme' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const h1 = await page.locator('main h1').boundingBox();
      const card = await page.locator('.home-search').boundingBox();
      const globe = await page.locator('.home-globe').boundingBox();
      expect(h1!.y + h1!.height).toBeLessThan(PHONE.height);
      expect(card!.y + card!.height).toBeLessThan(PHONE.height);
      expect(h1!.y).toBeLessThan(card!.y);
      expect(card!.y + card!.height).toBeLessThanOrEqual(globe!.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await context.close();
    });
  }

  test('desktop keeps the globe behind the card', async ({ page, site }) => {
    await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
    const card = await page.locator('.home-cover-inner').boundingBox();
    const cover = await page.locator('.home-cover').boundingBox();
    expect(card!.y).toBeGreaterThan(cover!.y);
    expect(card!.y + card!.height).toBeLessThan(cover!.y + cover!.height);
    expect(await page.locator('.home-globe').evaluate((e) => getComputedStyle(e).position)).toBe('absolute');
  });

  test('axe on home and the bar at 390', async ({ browser, site }) => {
    const context = await browser.newContext({ viewport: PHONE, locale: 'en-CA' });
    const page = await context.newPage();
    await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    await context.close();
  });

  test('screenshots: home and bottom bar, 1440 and 390, light and dark, 2x', async ({ browser, site }) => {
    test.setTimeout(240_000);
    mkdirSync(path.join(SHOT_DIR, 'SHL'), { recursive: true });
    for (const theme of ['light', 'dark'] as const) {
      for (const size of [{ width: 1440, height: 900 }, PHONE]) {
        const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'en-CA' });
        const page = await context.newPage();
        await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
        if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark theme' }).click();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(SHOT_DIR, 'SHL', `home-${size.width}-${theme}.png`) });
        if (size.width === 390) await page.locator('.bottom-bar').screenshot({ path: path.join(SHOT_DIR, 'SHL', `bar-390-${theme}.png`) });
        await context.close();
      }
    }
  });
});
