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
    expect(await cells.nth(8).evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBeGreaterThanOrEqual(56);
    const tops = await sec(page).locator('.wtg-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    // the strip and the cards share their right edge
    const edge = (sel: string) => sec(page).locator(sel).evaluate((e) => Math.round(e.getBoundingClientRect().right));
    expect(Math.abs((await edge('.mstrip-list')) - (await edge('.wtg-cards')))).toBeLessThanOrEqual(1);
    // one kicker line: the heading and the hero kicker share a row
    const top = (sel: string) => sec(page).locator(sel).evaluate((e) => Math.round(e.getBoundingClientRect().top));
    expect(Math.abs((await top('#wtg-h')) - (await top('.wtg-kick')))).toBeLessThanOrEqual(3);
    // the legend says what a blank cell means, and nothing else, once the words are in the cells
    await expect(sec(page).locator('.mstrip-legend')).toContainText('Blank: not checked for this plan');
    await expect(sec(page).locator('.mstrip-legend-state').first()).toBeHidden();
  });

  test('the Rockies: researched crowds, the three other weeks and June as a good month (C1)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await expect(sec(page).locator('.wtg-card[data-card="crowds"]')).toContainText('Lower');
    await expect(sec(page).locator('.wtg-card[data-card="crowds"]')).not.toContainText('Not checked yet');
    await expect(sec(page).locator('.wtg-week')).toHaveCount(3);
    await expect(sec(page).locator('.wtg-week').first()).toContainText('First week of September');
    await expect(sec(page).getByText('have not been researched yet')).toHaveCount(0);
    await expect(sec(page).locator('.mstrip-cell[data-month="6"]')).toHaveAttribute('data-state', 'good');
    await expect(sec(page).getByText('June, also good, with trade-offs')).toHaveCount(1);
  });

  test('a trip with no windows file keeps its gap lines', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/dolomites-2027/`);
    await expect(sec(page).locator('.wtg-card[data-card="crowds"]')).toContainText('Not checked yet');
    await expect(sec(page).getByText('Other weeks have not been researched yet.')).toBeVisible();
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
    await expect(sec(page).getByText('Some weather pages for this trip are not linked yet')).toBeVisible();
    await expect(sec(page).locator('.wtg-link')).toHaveCount(0);
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

    test('no sideways scroll; the strip is 6 x 2 with the word in the cell and the blank legend', async ({ page, site }) => {
      await page.goto(`${site.url}${ROCKIES}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const cells = sec(page).locator('.mstrip-cell');
      const rows = new Set(await cells.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top))));
      expect(rows.size).toBe(2);
      await expect(cells.nth(8).locator('.mstrip-w')).toBeVisible();
      await expect(sec(page).locator('.mstrip-legend')).toContainText('Blank: not checked for this plan');
    });

    test('the forecast row is at rest; climate folds behind one counted disclosure that names itself by its visible text', async ({ page, site }) => {
      await page.goto(`${site.url}${ROCKIES}`);
      await expect(sec(page).getByRole('link', { name: /Banff forecast/ })).toBeVisible();
      await expect(sec(page).getByRole('link', { name: /Banff climate averages, Environment Canada/ })).toBeHidden();
      const toggle = sec(page).locator('#wtg-wx-more');
      await expect(toggle).toHaveAccessibleName('More weather pages (3)');
      await sec(page).locator('label[for="wtg-wx-more"]').click();
      await expect(sec(page).getByRole('link', { name: /Banff climate averages, Environment Canada/ })).toBeVisible();
      await expect(toggle).toHaveAccessibleName('Show fewer');
      await expect(sec(page).locator('.wtg-notes li')).toHaveCount(3);
    });

    test('a hazard note is in view at rest on Iceland, and no heading sits over an empty list', async ({ page, site }) => {
      await page.goto(`${site.url}/trips/iceland-ring-road-2027/`);
      await expect(sec(page).locator('.wtg-notes li', { hasText: 'No river crossings' })).toBeVisible();
      await expect(sec(page).locator('.wtg-notes li[data-kind="warn"]')).toHaveCount(2);
      await page.goto(`${site.url}/trips/norway-summer-2028/`);
      await expect(sec(page).locator('.wtg-notes li:visible')).toHaveCount(2);
    });

    test('every visible weather link is at least 44 px tall; axe passes', async ({ page, site }) => {
      await page.goto(`${site.url}${ROCKIES}`);
      const hs = await sec(page).locator('.wtg-link').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)));
      expect(hs.length).toBeGreaterThan(0);
      expect(Math.min(...hs)).toBeGreaterThanOrEqual(44);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).include('#when-to-go').analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  });
}
