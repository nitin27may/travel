import { expect, test } from './fixtures';

// S28 back-to-top. Phone only; rendered after mount; moves focus to <main>.
const PHONE = { width: 390, height: 844 };
const PAGES = ['/trips/dolomites-2027/', '/places/', '/places/lake-louise/'];

async function scrollTo(page: import('@playwright/test').Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
}

test.describe('back-to-top on a phone', () => {
  test.use({ viewport: PHONE });

  for (const url of PAGES) {
    test(`${url}: absent at the top, appears after 1.5 screens, tap returns to the top and focuses main`, async ({ page, site }) => {
      await page.goto(`${site.url}${url}`, { waitUntil: 'networkidle' });
      const btn = page.getByRole('button', { name: 'Back to top' });
      await expect(btn).toHaveCount(0); // not server-rendered, not loaded before the first scroll
      await scrollTo(page, 300);
      await expect(btn).toBeHidden();
      await scrollTo(page, 1400);
      await expect(btn).toBeVisible();
      const box = (await btn.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      const bar = (await page.locator('.bottom-bar').boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
      await btn.click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page.locator('main#main')).toBeFocused();
      await expect(btn).toBeHidden();
    });
  }

  test('reduced motion scrolls at once', async ({ page, site }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    await scrollTo(page, 2000);
    await page.getByRole('button', { name: 'Back to top' }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 300 }).toBe(0);
  });

  test('hides while the search panel is open', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    await scrollTo(page, 2000);
    const btn = page.getByRole('button', { name: 'Back to top' });
    await expect(btn).toBeVisible();
    await page.getByRole('navigation', { name: 'Main, bottom' }).getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('combobox')).toBeVisible();
    await expect(btn).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(btn).toBeVisible();
  });

  test('hides while the trip map sheet is open, and returns when it closes (second open too)', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/dolomites-2027/`, { waitUntil: 'networkidle' });
    await scrollTo(page, 2000);
    const btn = page.getByRole('button', { name: 'Back to top' });
    await expect(btn).toBeVisible();
    const mapBtn = page.locator('button[aria-controls="route"]:visible').first();
    for (let round = 0; round < 2; round++) {
      await mapBtn.click();
      await expect(page.locator('.tl-mapcol[data-sheet]')).toBeVisible();
      await expect(btn).toBeHidden();
      await mapBtn.click();
      await expect(page.locator('.tl-mapcol[data-sheet]')).toHaveCount(0);
      await expect(btn).toBeVisible();
    }
  });

});

test.describe('back-to-top at desktop width', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test('is never shown', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    await scrollTo(page, 3000);
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: 'Back to top' })).toHaveCount(0);
  });
});

test.describe('navigation starts at the top (390 px)', () => {
  test.use({ viewport: PHONE });
  test('Home -> Trips -> a trip -> a place land at the top', async ({ page, site }) => {
    await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
    const top = () => page.evaluate(() => Math.round(window.scrollY));
    const nav = page.getByRole('navigation', { name: 'Main, bottom' });
    await scrollTo(page, 900);
    await nav.getByRole('link', { name: 'Trips' }).click();
    await expect(page).toHaveURL(/\/trips\/$/);
    await expect.poll(top).toBe(0);
    await scrollTo(page, 700);
    await page.locator('main a[href^="/trips/"]:not([href="/trips/"])').first().click();
    await expect(page).toHaveURL(/\/trips\/[^/]+\/$/);
    await expect.poll(top).toBe(0);
    await scrollTo(page, 1500);
    await nav.getByRole('link', { name: 'Places' }).click();
    await expect(page).toHaveURL(/\/places\/$/);
    await expect.poll(top).toBe(0);
    await scrollTo(page, 1500);
    await page.locator('main a[href^="/places/"]:not([href="/places/"])').first().click();
    await expect(page).toHaveURL(/\/places\/[^/]+\/$/);
    await expect.poll(top).toBe(0);
  });
});
