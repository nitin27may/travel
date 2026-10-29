import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

// PA-W: the park line on the Summary and in print, and the Bookings kinds on the real Rockies page (protected-area-entry 6.2, 6.3, 6.4).
// Today the Rockies has one park the capture store knows (Kananaskis Lakes) and no entry fee stored, so the line is the honest one,
// "Entry not checked yet"; the sentence for a park with requirements is pinned in core/test/parks and tests/trips/entry-wiring.test.ts.
const ROCKIES = '/trips/canadian-rockies-2029/';

for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test.describe(`Park entry at ${vp.width}`, () => {
    test.use({ viewport: vp });

    test('the Summary names each park the plan enters, and says "Entry not checked yet" for a park nobody has read', async ({ page, site }) => {
      await page.goto(`${site.url}${ROCKIES}`);
      const lines = page.getByTestId('park-lines');
      await expect(lines.getByRole('heading', { name: 'Park entry' })).toBeVisible();
      await expect(lines.locator('.sum-park[data-state="not_checked"] .sum-park-line')).toHaveText('Entry not checked yet for Upper and Lower Kananaskis Lakes');
      await expect(lines.locator('.sum-park[data-state="not_checked"]')).toHaveCount(1);
      // PA-R-CA2: the real park sentence, and no national park left unchecked
      await expect(lines.locator('.sum-park-line').first()).toHaveText('Banff National Park, days 1 to 4 and 10 to 11: entry fee each day, or the Parks Canada Discovery Pass covers it (also Kootenay, Jasper and Yoho on this trip)');
      // PA-R-CA3: Marble Canyon and the Paint Pots (day 3) carry the Kootenay area, so Kootenay has its own line
      await expect(lines.locator('.sum-park-line', { hasText: 'Kootenay National Park, day 3:' })).toHaveCount(1);
      await expect(lines).not.toContainText(/Entry not checked yet for (?:Banff|Jasper|Yoho|Kootenay)/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('the Bookings tab lists the check apart from the bookings and does not count it', async ({ page, site }) => {
      await page.goto(`${site.url}${ROCKIES}?view=bookings`);
      const p = page.locator('#trip-panel-bookings');
      await expect(p.getByTestId('bk-summary')).toHaveText('8 to book ahead, 4 with a published opening date; also 2 passes, 1 check.');
      const check = p.locator('[data-group="check"] .bk-row');
      await expect(check).toHaveCount(1);
      await expect(check).toContainText('Lake Louise Lakeshore parking');
      await expect(check).toContainText('No reservation');
      await expect(p.locator('[data-group="booking"] .bk-row')).toHaveCount(8);
    });

    test('print carries the park lines above the Book ahead rows, and the kind of a row that is not a booking', async ({ page, site }) => {
      await page.addInitScript(() => { window.print = () => undefined; });
      await page.goto(`${site.url}${ROCKIES}`);
      await page.getByRole('button', { name: 'Export trip' }).or(page.getByRole('button', { name: 'Export', exact: true })).first().click();
      await page.getByRole('menuitem', { name: /^Print or save as PDF/ }).click();
      const view = page.getByTestId('trip-print-view');
      await expect(view).toBeAttached();
      const parks = view.locator('section[aria-label="Park entry"]');
      await expect(parks).toContainText('Entry not checked yet for Upper and Lower Kananaskis Lakes');
      await expect(view.locator('section[aria-label="To check"]')).toContainText('Lake Louise Lakeshore parking and Park and Ride');
      await expect(view.locator('section[aria-label="Book ahead"]')).toContainText('then 2 days before Day 10 at 08:00 (60%)');
      await expect(parks).toContainText('Banff National Park, days 1 to 4 and 10 to 11: entry fee each day, or the Parks Canada Discovery Pass covers it');
      // the park lines come first
      // (the print view is off screen until the browser prints, so it is read by selector, not by role)
      const order = await view.locator('section[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
      expect(order.indexOf('Park entry')).toBeLessThan(order.indexOf('Book ahead'));
    });
  });
}

for (const w of [320, 1440]) {
  test(`axe (WCAG 2.2 AA) on the Summary with the park line and on the Bookings tab at ${w}`, async ({ page, site }) => {
    await page.setViewportSize({ width: w, height: 900 });
    for (const view of ['', '?view=bookings']) {
      await page.goto(`${site.url}${ROCKIES}${view}`);
      await expect(page.locator(view ? '#trip-panel-bookings' : '[data-testid="park-lines"]')).toBeVisible();
      await page.waitForTimeout(400);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('.maplibregl-canvas').exclude('.sum-hl-days').analyze(); // .sum-hl-days: the highlights' Day links are under 24 px, a finding of UXB-1 reported with this task, not this section
      expect(r.violations.map((v) => `${view || 'summary'} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
}
