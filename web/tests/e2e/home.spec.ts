import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { shoot } from './shots';

const LANE = 'L1';

test.describe('home', () => {
  test('order of sections, counts from data, no sign-in prompt above the fold', async ({ page, site }) => {
    await page.goto(`${site.url}/`);
    const heads = await page.locator('main h1, main h2').allInnerTexts();
    expect(heads.map((h) => h.toLowerCase())).toEqual(['trip plans', 'trips', 'places worth a trip', 'about the data']);
    await expect(page.getByRole('link', { name: /^All \d+ trips/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^All \d+ places/ })).toBeVisible();
    const cover = await page.locator('.home-cover').boundingBox();
    expect(cover!.y + cover!.height).toBeLessThan(900);
    await expect(page.locator('main').getByText('Sign in')).toHaveCount(0);
    expect(await page.locator('main .credits li').count()).toBeGreaterThan(0);
  });

  test('"/" opens the search, results on the first character, Esc clears then closes, Enter opens', async ({ page, site }) => {
    await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
    await page.keyboard.press('/');
    const box = page.getByRole('combobox');
    await expect(box).toBeFocused();
    await page.keyboard.type('d');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.type('olomites');
    await expect(page.getByRole('group', { name: 'Trips' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(box).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press('/');
    await page.keyboard.type('dolomites');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/trips\/dolomites-2027\//);
  });

  test('no result message, and the header search works on another page', async ({ page, site }) => {
    await page.goto(`${site.url}/about/data/`, { waitUntil: 'networkidle' });
    // the header's own "/" handler skips pages that have a [aria-keyshortcuts="/"] element, and its Search button is one (request to L0), so click
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('combobox').fill('xyzq');
    await expect(page.getByText('No trip or place matches')).toBeVisible();
  });

  test('axe', async ({ page, site }) => {
    await page.goto(`${site.url}/`);
    await page.waitForTimeout(1500);
    const r = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  test('screenshots', async ({ browser, site }) => {
    test.setTimeout(240_000);
    const wait = async (p: import('@playwright/test').Page) => { await p.waitForTimeout(2500); };
    await shoot(browser, site.url, LANE, 'home', '/', { fullPage: true, tile: true, prepare: wait });
    await shoot(browser, site.url, LANE, 'search-results', '/', {
      prepare: async (p) => { await p.keyboard.press('/'); await p.keyboard.type('lake'); await p.waitForTimeout(500); },
    });
    await shoot(browser, site.url, LANE, 'search-empty', '/', {
      prepare: async (p) => { await p.keyboard.press('/'); await p.keyboard.type('xyzq'); await p.waitForTimeout(500); },
    });
  });
});
