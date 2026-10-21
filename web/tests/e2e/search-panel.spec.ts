import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * A press before the page hydrates is lost, so retry the press: but give the lazy chunk time to mount the panel first, because a
 * second press on an open panel is the toggle that closes it.
 */
async function open(button: Locator, panel: Locator) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await button.click();
    try {
      await expect(panel).toBeVisible({ timeout: 12_000 });
      return;
    } catch {
      // not hydrated yet: press again
    }
  }
  await expect(panel).toBeVisible();
}

// a context made here does not get the auto fixture that blocks remote hosts; without it the globe waits on tile servers
const offline = (page: Page) => page.route((url) => !/^(127\.0\.0\.1|localhost)$/.test(url.hostname), (route) => route.abort());

test.setTimeout(150_000); // the home page runs a WebGL globe; a loaded machine needs the room

// Backlog 9.1: the search panel opens whole inside the viewport from the hero field and from the header button, and the
// header button toggles it. A transformed hero card used to turn the panel's position: fixed into "relative to the card".
const WIDTHS = [1000, 1100, 1440, 1920, 390] as const;
const HEIGHT = (w: number) => (w === 390 ? 844 : 900);

for (const w of WIDTHS) {
  for (const from of ['hero', 'header'] as const) {
    test(`the panel opened from the ${from} at ${w} px lies inside the viewport`, async ({ browser, site }) => {
      const context = await browser.newContext({ viewport: { width: w, height: HEIGHT(w) }, locale: 'en-CA' });
      const page = await context.newPage();
      await offline(page);
      await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
      const button = from === 'hero' ? page.locator('main .home-search') : page.locator('.site-header [aria-keyshortcuts="/"]:visible').first();
      const panel = page.getByRole('search', { name: 'Search trips, places and areas' });
      await open(button, panel);
      await expect(page.getByRole('combobox')).toBeFocused();
      // wait for the entrance animation to settle before measuring
      await expect.poll(async () => (await panel.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
      await page.waitForTimeout(400);
      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      const { x, y, width, height } = box!;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(w + 0.5);
      expect(y + height).toBeLessThanOrEqual(HEIGHT(w) + 0.5);
      // the same place whichever button opened it
      if (w >= 640) expect(y).toBeLessThan(120);
      await context.close();
    });
  }
}

test('a second press on the header Search closes the panel and focus returns to it; Esc and an outside press close too', async ({ browser, browserName, site }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-CA' });
  const page = await context.newPage();
  await offline(page);
  await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
  const button = page.locator('.site-header [aria-keyshortcuts="/"]:visible').first();
  const panel = page.getByRole('search', { name: 'Search trips, places and areas' });

  await open(button, panel);
  await button.click();
  await expect(panel).toHaveCount(0);
  await expect(button).toBeFocused();

  // it opens again after being closed this way
  await button.click();
  await expect(panel).toBeVisible();
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  // Safari does not focus a button on a press, so Esc has no opener to return to there; the press-toggle above is covered everywhere
  if (browserName !== 'webkit') await expect(button).toBeFocused();

  await button.click();
  await expect(panel).toBeVisible();
  await page.mouse.click(40, 600);
  await expect(panel).toHaveCount(0);
  // non-modal: no scrim, no aria-modal
  await button.click();
  await expect(panel).toBeVisible();
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
  await context.close();
});
