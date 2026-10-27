import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// UXB-4: When to go in the Summary (spec trip-and-places-ux-fixes.md 6.2, W4; components 4.7): the best-time hero, the month strip (three letters,
// pattern and word), four equal cards, a hazard line at rest on a phone, and links out to the weather services with no runtime call.
const ROCKIES = '/trips/canadian-rockies-2029/';
const COSTA_RICA = '/trips/costa-rica-2027/';
const PATAGONIA = '/trips/patagonia-2027/';
const sec = (page: Page) => page.locator('#when-to-go');

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the Rockies: hero, a strip with words in the cells, four cards in one row, and the heading once', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await expect(sec(page).getByRole('heading', { name: 'When to go', exact: true })).toBeVisible();
    await expect(sec(page).getByText('Best time for this plan')).toBeVisible();
    await expect(sec(page).locator('.wtg-window')).toHaveText('Early to late September');
    const cells = sec(page).locator('.mstrip-cell');
    await expect(cells).toHaveCount(12);
    await expect(cells.nth(8)).toContainText('best');
    await expect(cells.nth(8)).toContainText('Sep');
    expect(await cells.nth(8).evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(56);
    const tops = await sec(page).locator('.wtg-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    await expect(sec(page).locator('.wtg-card[data-card="crowds"]')).toContainText('Not checked yet');
    await expect(sec(page).locator('.mstrip-legend')).toBeHidden();
  });

  test('weather links open in a new tab, name their publisher, and make no request to a weather service', async ({ page, site }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (!r.url().startsWith(site.url) && u.protocol.startsWith('http')) external.push(u.host);
    });
    await page.goto(`${site.url}${ROCKIES}`);
    await page.waitForLoadState('networkidle');
    const banff = sec(page).getByRole('link', { name: /Banff forecast, Environment Canada, opens in a new tab/ });
    await expect(banff).toHaveAttribute('href', /^https:\/\/weather\.gc\.ca\//);
    await expect(banff).toHaveAttribute('target', '_blank');
    await expect(banff).toHaveAttribute('rel', /noopener/);
    expect(await banff.evaluate((e) => Math.round(e.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
    expect(external.filter((h) => /weather|meteo|vedur|yr\.no|nws|noaa|open-meteo|imn|smn/i.test(h))).toEqual([]);
  });

  test('a plan-basis trip is outlined and never called best', async ({ page, site }) => {
    await page.goto(`${site.url}${COSTA_RICA}`);
    await expect(sec(page).getByText('The window this plan was written for')).toBeVisible();
    await expect(sec(page).locator('.mstrip-cell[data-state="plan"]')).toHaveCount(1);
    await expect(sec(page).locator('.mstrip-cell[data-state="best"]')).toHaveCount(0);
    await expect(sec(page).getByText('Best time for this plan')).toHaveCount(0);
  });

  test('Patagonia (southern hemisphere): February and March are the months, and a gap line shows', async ({ page, site }) => {
    await page.goto(`${site.url}${PATAGONIA}`);
    const best = sec(page).locator('.mstrip-cell[data-state="best"]');
    await expect(best).toHaveCount(2);
    await expect(best.nth(0)).toContainText('Feb');
    await expect(sec(page).getByText('Not every base has its own forecast page yet.')).toBeVisible();
  });

  test('every cell has its month and state as text; axe passes at 1440', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await expect(sec(page).getByText('September, best for this plan')).toHaveCount(1);
    await expect(sec(page).getByText('January, not checked for this plan')).toHaveCount(1);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).include('#when-to-go').analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
});

for (const w of [320, 390]) {
  test.describe(`phone ${w}`, () => {
    test.use({ viewport: { width: w, height: 800 } });

    test(`no sideways scroll; ${w < 340 ? '6 x 2 with the word in the cell' : '12 x 1 with a legend'}; advice folds, the hazard stays`, async ({ page, site }) => {
      await page.goto(`${site.url}${ROCKIES}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const cells = sec(page).locator('.mstrip-cell');
      const rows = new Set(await cells.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top))));
      if (w < 340) {
        expect(rows.size).toBe(2);
        await expect(cells.nth(8).locator('.mstrip-w')).toBeVisible();
        await expect(sec(page).locator('.mstrip-legend')).toBeHidden();
      } else {
        expect(rows.size).toBe(1);
        await expect(sec(page).locator('.mstrip-legend')).toBeVisible();
        await expect(cells.nth(8).locator('.mstrip-w')).toBeHidden();
      }
      const notes = sec(page).locator('.wtg-notes li');
      await expect(notes.filter({ hasText: 'Moraine Lake road closes' })).toBeVisible();
      await expect(notes.filter({ hasText: 'Larch gold peaks' })).toBeHidden();
      await sec(page).locator('label.wtg-more').click();
      await expect(notes.filter({ hasText: 'Larch gold peaks' })).toBeVisible();
      await expect(sec(page).locator('label.wtg-more')).toContainText('Show fewer');
    });

    test('every weather link is at least 44 px tall; axe passes', async ({ page, site }) => {
      await page.goto(`${site.url}${ROCKIES}`);
      const hs = await sec(page).locator('.wtg-link').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      expect(Math.min(...hs)).toBeGreaterThanOrEqual(44);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).include('#when-to-go').analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  });
}
