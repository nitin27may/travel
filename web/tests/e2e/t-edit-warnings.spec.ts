import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-E5 (EA8): warnings in two levels in edit mode on /t/<id>/. Needs the build with NEXT_PUBLIC_TRIP_EDIT=1, then
// PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-edit-warnings (alone, on a free port). With the flag off /t/ answers 404 and
// every test here skips. The Fix scenario moves the Lake Louise Gondola (open 09:00 to 16:30) to Day 9, where it ends at 17:10.
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number, pace: string) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace, adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });
const GONDOLA = 'Lake Louise Gondola';

test.describe('edit mode: warnings in two levels', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  async function open(page: Page, site: { url: string }, pace = 'standard') {
    await page.addInitScript(
      (kv) => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(kv.k, kv.v);
      },
      { k: COPIES_KEY, v: envelope([copy(days, pace)]) },
    );
    await page.goto(`${site.url}/t/${ID}/?view=day&edit=1`);
    await expect(page.locator('li.tl-day').first()).toBeVisible();
    await expect(page.locator('#day-1 .day-more')).toBeVisible();
  }
  /** Moves the gondola from Day 10 to Day 9, where it closes before it ends: one Fix warning on Day 9. */
  async function breakGondola(page: Page) {
    await page.locator('#day-10 li.tl-entry[data-edit="stop"]', { has: page.locator('.tl-title', { hasText: GONDOLA }) }).first().locator('.tl-edit-trail button').click();
    await page.getByRole('menuitem', { name: 'Move to day' }).click();
    await page.locator('.edit-day', { hasText: 'Day 9' }).click();
    await expect(page.locator('#day-9 .wn[data-level="fix"]')).toBeVisible();
  }
  const fixRow = (page: Page) => page.locator('#day-9 .wn[data-level="fix"]');

  test('a Fix warning shows at rest on the day header with one fix, and no edit is disabled', async ({ page, site }) => {
    await open(page, site);
    await expect(page.locator('li.tl-day .wn[data-level="fix"]')).toHaveCount(0);
    await breakGondola(page);
    await expect(fixRow(page)).toContainText(/To fix:.*closes at 16:30/);
    await expect(fixRow(page).getByRole('button')).toHaveCount(1);
    await expect(fixRow(page).getByRole('button')).toHaveText(new RegExp(`Move ${GONDOLA} to Day \\d+`));
    // the level is said in words and a triangle, not colour alone
    await expect(fixRow(page).locator('svg')).toHaveCount(1);
    // the stop's menu is still fully available: a warning never disables an edit
    await page.locator('#day-9 li.tl-entry[data-edit="stop"]', { has: page.locator('.tl-title', { hasText: GONDOLA }) }).locator('.tl-edit-trail button').click();
    await expect(page.getByRole('menuitem', { name: /Remove from Day 9/ })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: 'Move to day' })).toBeEnabled();
    await page.keyboard.press('Escape');
  });

  test('the count is in the sticky row and the Summary, and follows the fix and its undo', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, site);
    await breakGondola(page);
    const count = page.getByTestId('warn-count');
    await expect(count).toContainText('1 to fix');
    await expect(count).toContainText('Day 9');
    await expect(page.locator('.tl-planbar').getByTestId('warn-count')).toBeVisible();
    await page.getByRole('tab', { name: /Summary/ }).click();
    await expect(page.getByTestId('summary-checks')).toContainText('1 to fix');
    await page.getByRole('tab', { name: /Days/ }).click();

    // the one fix: one undo step with a toast
    const label = (await fixRow(page).getByRole('button').textContent()) ?? '';
    const target = /to Day (\d+)/.exec(label)?.[1];
    expect(target).toBeTruthy();
    await fixRow(page).getByRole('button').click();
    await expect(page.locator('.toast', { hasText: `Moved ${GONDOLA} to Day ${target}` })).toBeVisible();
    await expect(page.locator('li.tl-day .wn[data-level="fix"]')).toHaveCount(0);
    await expect(page.getByTestId('warn-count')).toHaveCount(0);
    await expect(page.locator(`#day-${target} li.tl-entry .tl-title`, { hasText: GONDOLA })).toHaveCount(1);
    await page.locator('.toast').last().getByRole('button', { name: 'Undo' }).click();
    await expect(fixRow(page)).toBeVisible();
    await expect(page.getByTestId('warn-count')).toContainText('1 to fix');
  });

  test('a Fix warning with no day that fits offers Remove, and removing it clears the count', async ({ page, site }) => {
    await open(page, site);
    await breakGondola(page);
    // removing the stop by its own menu recomputes the count (E1B removals)
    await page.locator('#day-9 li.tl-entry[data-edit="stop"]', { has: page.locator('.tl-title', { hasText: GONDOLA }) }).locator('.tl-edit-trail button').click();
    await page.getByRole('menuitem', { name: /Remove from Day 9/ }).click();
    await expect(page.locator('li.tl-day .wn[data-level="fix"]')).toHaveCount(0);
    await expect(page.getByTestId('warn-count')).toHaveCount(0);
  });

  test('Check warnings collapse to one line with Show, and carry no fix button', async ({ page, site }) => {
    await open(page, site, 'relaxed');
    const day = page.locator('#day-2 .wn[data-level="check"]');
    await expect(day).toContainText('2 to check');
    await expect(day.getByRole('button', { name: 'Show' })).toHaveAttribute('aria-expanded', 'false');
    await expect(day.locator('li')).toHaveCount(0);
    await day.getByRole('button', { name: 'Show' }).click();
    await expect(day.locator('li')).toHaveCount(2);
    await expect(day.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
    // information only: the only button on a Check line is Show or Hide
    await expect(day.getByRole('button')).toHaveCount(1);
    await expect(page.locator('li.tl-day .wn[data-level="check"] .wn-fix')).toHaveCount(0);
    // a single check reads in full on its own line
    await expect(page.locator('#day-4 .wn[data-level="check"]')).toContainText(/^To check:/);
    // the Summary says how many to check
    await page.getByRole('tab', { name: /Summary/ }).click();
    await expect(page.getByTestId('summary-checks')).toContainText(/to check/);
  });

  test('a phone: the count sits on its own line under the rail, never over the tabs, and a tap jumps to the first issue', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, site);
    await breakGondola(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const count = page.getByTestId('warn-count');
    await expect(count).toBeVisible();
    const tabs = page.getByRole('tablist').first();
    const [c, t, rail] = await Promise.all([count.boundingBox(), tabs.boundingBox(), page.locator('.tl-rail-days').boundingBox()]);
    expect(c && t && rail).toBeTruthy();
    // under the tab row and under the day rail, inside the screen
    expect(c!.y).toBeGreaterThanOrEqual(t!.y + t!.height - 1);
    expect(c!.y).toBeGreaterThanOrEqual(rail!.y + rail!.height - 1);
    expect(c!.x).toBeGreaterThanOrEqual(0);
    expect(c!.x + c!.width).toBeLessThanOrEqual(390);
    expect(c!.height).toBeGreaterThanOrEqual(44);
    // none of the tab labels is cut
    const cut = await page.getByRole('tablist').first().getByRole('tab').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
    expect(cut).toBe(0);
    await count.click();
    const fix = fixRow(page).getByRole('button');
    await expect(fix).toBeFocused();
    // the page scrolls smoothly: wait for it to land, then the button is on screen and clear of the sticky bar
    await expect
      .poll(async () => {
        const b = await fix.boundingBox();
        return !!b && b.y >= 120 && b.y + b.height <= 844;
      })
      .toBe(true);
  });
});
