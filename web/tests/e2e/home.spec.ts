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

  test('a question with no matching record offers the filtered Places list once every part has loaded', async ({ page, site }) => {
    await page.goto(`${site.url}/about/data/`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('combobox').fill('family trail italy');
    const link = page.getByRole('link', { name: /Kid-friendly trails in Italy/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/places/?country=IT&kind=trail&kid=yes');
    await link.click();
    await expect(page).toHaveURL(/\/places\/\?country=IT&kind=trail&kid=yes/);
  });

  test('no result message, and the header search works on another page', async ({ page, site }) => {
    await page.goto(`${site.url}/about/data/`, { waitUntil: 'networkidle' });
    // the header's own "/" handler skips pages that have a [aria-keyshortcuts="/"] element, and its Search button is one (request to L0), so click
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('combobox').fill('xyzq');
    await expect(page.getByText('No trip or place matches')).toBeVisible();
  });

  for (const [name, path] of [['home', '/'], ['another page', '/about/data/']] as const) {
    test(`keys typed straight after "/" are kept (${name})`, async ({ page, site }) => {
      await page.goto(`${site.url}${path}`, { waitUntil: 'networkidle' });
      await page.keyboard.press('/');
      await page.keyboard.type('dolomites', { delay: 0 });
      await expect(page.getByRole('combobox')).toHaveValue('dolomites');
      await expect(page.getByRole('group', { name: 'Trips' })).toBeVisible();
    });
  }

  test('the cover globe adds one Tab stop, not one per pin; arrows move between pins', async ({ page, site }) => {
    await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
    await page.locator('a.globe-pin').first().waitFor({ state: 'attached', timeout: 30_000 }).catch(() => undefined);
    const pins = await page.locator('a.globe-pin[data-globe-pin]').count();
    if (pins < 2) test.skip(true, 'no basemap in this harness, so no cover pins to walk');
    expect(await page.locator('a.globe-pin[tabindex="0"]').count()).toBe(1);
    expect(await page.locator('a.globe-pin[tabindex="-1"]').count()).toBe(pins - 1);
    const first = page.locator('a.globe-pin[tabindex="0"]');
    await first.focus();
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => (document.activeElement as HTMLElement).tabIndex)).toBe(0);
    expect(await page.locator('a.globe-pin[tabindex="0"]').count()).toBe(1);
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
      prepare: async (p) => { await p.keyboard.press('/'); await p.getByRole('combobox').waitFor(); await p.getByRole('combobox').fill('lake'); await p.getByRole('option').first().waitFor(); },
    });
    await shoot(browser, site.url, LANE, 'search-empty', '/', {
      prepare: async (p) => { await p.keyboard.press('/'); await p.getByRole('combobox').waitFor(); await p.getByRole('combobox').fill('xyzq'); await p.getByText('No trip or place matches').waitFor(); },
    });
  });
});
