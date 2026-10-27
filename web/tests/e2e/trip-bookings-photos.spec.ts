import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

// UXB-6: the Bookings and Photos tabs (spec trip-and-places-ux-fixes.md 3.2, 3.6; UXB-N 7, 8; owner QP3, Q307).
const ROCKIES = '/trips/canadian-rockies-2029/';
const DOLOMITES = '/trips/dolomites-2027/';
const ALGONQUIN = '/trips/algonquin-muskoka-2026/';
const open = async (page: Page, site: { url: string }, trip: string, tab: 'bookings' | 'photos') => {
  await page.goto(`${site.url}${trip}?view=${tab}`);
  await expect(page.locator(`#trip-panel-${tab}`)).toBeVisible();
};

for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test.describe(`Bookings tab at ${vp.width}`, () => {
    test.use({ viewport: vp });

    test('Rockies (PA-W): "7 to book ahead", the shuttle dated, the lakeshore lot a check listed and not counted, one prices line, no filter row, the tab count says 7', async ({ page, site }) => {
      await open(page, site, ROCKIES, 'bookings');
      const p = page.locator('#trip-panel-bookings');
      await expect(p.getByTestId('bk-summary')).toHaveText('7 to book ahead, 1 with a published opening date; also 1 check.');
      await expect(p.locator('.bk-row')).toHaveCount(8);
      await expect(p.locator('[data-group="check"] .bk-row')).toHaveCount(1);
      await expect(p.locator('.bk-prices')).toHaveText('Prices: not checked yet for these 7.');
      await expect(p.getByTestId('bk-summary')).not.toContainText(/pass|task/); // only the one check is counted apart (UXB-6F: no kind is named that is not there)
      await expect(p.locator('select, [role="combobox"], .facet-pill')).toHaveCount(0);
      await expect(page.locator('#trip-tab-bookings')).toHaveAttribute('aria-label', 'Bookings, 7');
      await expect(p.locator('.bk-rule')).toHaveText('Opens 2 days before Day 10 at 08:00 local');
      await expect(p.getByRole('link', { name: /Booking page for Parks Canada Lake Louise/ })).toHaveAttribute('href', 'https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise');
    });

    test('Dolomites: "Opens 30 days before Day 3", with no dangling "local"', async ({ page, site }) => {
      await open(page, site, DOLOMITES, 'bookings');
      const p = page.locator('#trip-panel-bookings');
      await expect(p.getByTestId('bk-summary')).toHaveText('3 to book ahead, 1 with a published opening date.');
      await expect(p.locator('.bk-rule')).toHaveText('Opens 30 days before Day 3');
    });

    test('a day link opens that day on Days; links are 44 px high and the panel does not scroll sideways', async ({ page, site }) => {
      await open(page, site, ROCKIES, 'bookings');
      const link = page.locator('#trip-panel-bookings .bk-day a').first();
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await link.click();
      await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText(/^Days/);
    });
  });
}

test.describe('trips without bookings or photos', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('a trip with no booking draws no Bookings tab; ?view=bookings opens the Summary', async ({ page, site }) => {
    await page.goto(`${site.url}${ALGONQUIN}?view=bookings`);
    await expect(page.locator('#trip-tab-bookings')).toHaveCount(0);
    await expect(page.locator('#trip-tab-photos')).toHaveCount(0);
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText('Summary');
  });
});

for (const vp of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test.describe(`Photos tab at ${vp.width}`, () => {
    test.use({ viewport: vp });

    test('groups by the gallery sections with day signs and place links; every tile shows its credit at rest', async ({ page, site }) => {
      await open(page, site, ROCKIES, 'photos');
      const p = page.locator('#trip-panel-photos');
      await expect(p.getByTestId('ph-summary')).toContainText('38 photos');
      await expect(p.locator('.gal-tile').first()).toBeVisible();
      await expect(p.getByRole('heading', { level: 3, name: /Moraine Lake/ })).toContainText('Day 11');
      await expect(p.getByRole('heading', { level: 3, name: /Lake Louise/ })).toContainText('Days 3 and 10');
      await expect(p.getByRole('heading', { level: 3, name: /Moraine Lake/ }).getByRole('link').first()).toHaveAttribute('href', '/places/moraine-lake/');
      // a section names its places, each its own link; and the day sign is the plan's, never a stray word's (UXB-6F M1, S1)
      const kan = p.getByRole('heading', { level: 3, name: /Kananaskis/ });
      await expect(kan).not.toContainText('Day 10');
      const links = await p.getByRole('heading', { level: 3, name: /Johnston/ }).getByRole('link').allTextContents();
      expect(links.every((t) => /Johnston|Minnewanka/.test(t))).toBe(true);
      await expect(p.getByRole('heading', { level: 3, name: /Waterton|Assiniboine/ }).first()).toContainText('Nearby, not in this plan');
      const credits = p.locator('.gal-credit');
      const n = await credits.count();
      expect(n).toBe(38);
      for (let i = 0; i < n; i++) {
        const c = credits.nth(i);
        await expect(c).toBeVisible();
        await expect(c).toHaveCSS('opacity', '1');
        expect(((await c.textContent()) ?? '').split(' · ').length).toBeGreaterThanOrEqual(2);
      }
      // the author gives way, the licence never does (UXB-6F M2)
      const cut = await page.locator('#trip-panel-photos .gal-credit-lic').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth).length);
      expect(cut).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('one lightbox runs over all 38 photos and names the section (UXB-6F S2)', async ({ page, site }) => {
      await open(page, site, ROCKIES, 'photos');
      const first = page.locator('#trip-panel-photos .ph-group').first();
      await expect(first.locator('.gal-tile').first()).toBeVisible();
      const n = await first.locator('.gal-tile').count();
      await first.locator('.gal-tile').last().click();
      const dlg = page.getByRole('dialog');
      await expect(dlg).toContainText(`${n} / 38 · Moraine Lake`);
      await page.keyboard.press('ArrowRight');
      await expect(dlg).toContainText(`${n + 1} / 38 · Lake Louise`);
      await page.keyboard.press('Escape');
    });

    test('a tile opens the lightbox and Escape returns focus to it', async ({ page, site }) => {
      await open(page, site, DOLOMITES, 'photos');
      const tile = page.locator('#trip-panel-photos .gal-tile').first();
      await tile.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(tile).toBeFocused();
    });
  });
}

for (const w of [320, 390, 1440]) {
  test(`axe (WCAG 2.2 AA) on the Bookings and Photos tabs at ${w}`, async ({ page, site }) => {
    await page.setViewportSize({ width: w, height: 900 });
    for (const tab of ['bookings', 'photos'] as const) {
      await open(page, site, ROCKIES, tab);
      if (tab === 'photos') await page.locator('#trip-panel-photos .gal-tile').first().waitFor();
      await page.waitForTimeout(500);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('.maplibregl-canvas').analyze();
      expect(r.violations.map((v) => `${tab} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
}
