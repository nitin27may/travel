import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-P1: "Save to a trip" on a place page opens the trip picker. Needs the build with NEXT_PUBLIC_TRIP_EDIT=1 (then PW_REUSE_SITE=1
// PW_SITE_URL=<that server> playwright test save-to-trip, alone, on a free port). With the flag off, the same page keeps today's note and
// the last test checks it (it skips on a flag-on build).
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = {
  id: ID, slug: SLUG, title: 'Canadian Rockies', days: 14, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
};
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });

let on = false;
test.beforeAll(async ({ playwright, site }) => {
  const ctx = await playwright.request.newContext();
  on = (await ctx.get(`${site.url}/t/${ID}/`)).status() !== 404;
  await ctx.dispose();
});

async function seed(page: Page, items: unknown[]) {
  await page.addInitScript(([k, v]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k!, v!);
  }, [COPIES_KEY, envelope(items)]);
}
const dialog = (page: Page, name: RegExp) => page.getByRole('dialog', { name });

test.describe('Save to a trip with the trip picker on', () => {
  test.beforeEach(() => test.skip(!on, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1'));

  test('no trips: "No trips yet" with Browse trips, and a heart without a trip', async ({ page, site }) => {
    await page.goto(`${site.url}/places/moraine-lake/`);
    await page.getByRole('button', { name: 'Save to a trip' }).click();
    const dlg = dialog(page, /Add Moraine Lake to a trip/);
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('heading', { name: 'No trips yet' })).toBeVisible();
    await expect(dlg.getByRole('link', { name: 'Browse trips' })).toHaveAttribute('href', '/trips/');
    await dlg.getByRole('button', { name: 'Save without a trip' }).click();
    await expect(page.locator('.toast')).toContainText(/favourites/);
    await expect(page.getByRole('button', { name: 'Favourite Moraine Lake' })).toHaveAttribute('aria-pressed', 'true');
    // the heart never made a trip
    expect(await page.evaluate((k) => localStorage.getItem(k), COPIES_KEY)).toBeNull();
  });

  test('a trip row opens that trip\'s add picker on the place, and Add is one undo step', async ({ page, site }) => {
    await seed(page, [copy]);
    await page.goto(`${site.url}/places/moraine-lake/`);
    await page.getByRole('button', { name: 'Save to a trip' }).click();
    const dlg = dialog(page, /Add Moraine Lake to a trip/);
    const row = dlg.locator('.tpk-row').filter({ hasText: 'Canadian Rockies' });
    await expect(row).toBeVisible();
    await expect(row.locator('.tpk-day')).toHaveText('The best day is picked next');
    await row.getByRole('link', { name: /^Add Moraine Lake to Canadian Rockies$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/t/${ID}/`));
    const add = dialog(page, /Add /i);
    await expect(add.getByText('Moraine Lake').first()).toBeVisible();
    const btn = add.getByRole('button', { name: /^(Add|Move) to Day \d+$/ }).first();
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('.toast', { hasText: /Moraine Lake to Day|Moved/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  });

  test('the "In your copy" line reads the device only: no trip document or plan model is requested', async ({ page, site }) => {
    await seed(page, [{ ...copy, added: [{ day: 5, placeSlug: 'moraine-lake' }] }]);
    const seen: string[] = [];
    page.on('request', (r) => { if (/\/api\/v1\/trips\/|\/t\/|plan-model|\/api\/v1\/plans/.test(r.url()) && !/\/places\//.test(r.url())) seen.push(r.url()); });
    await page.goto(`${site.url}/places/moraine-lake/`);
    const line = page.locator('.tpk-in');
    await expect(line).toContainText('In your copy of Canadian Rockies · Day 5');
    await expect(line.getByRole('link', { name: 'Canadian Rockies' })).toHaveAttribute('href', `/t/${ID}/?view=day`);
    await page.getByRole('button', { name: 'Save to a trip' }).click();
    await expect(dialog(page, /Add Moraine Lake to a trip/).locator('.tpk-day')).toHaveText('Already on Day 5');
    expect(seen).toEqual([]);
  });

  test('a copy of a public trip that uses the place reads "≈ your copy may differ"', async ({ page, site }) => {
    await seed(page, [copy]);
    await page.goto(`${site.url}/places/moraine-lake/`);
    await expect(page.locator('.tpk-in')).toContainText('In your copy of Canadian Rockies');
    await expect(page.locator('.tpk-in')).toContainText('≈ your copy may differ');
  });

  test('a park offers its members, never itself as a stop', async ({ page, site }) => {
    await seed(page, [copy]);
    await page.goto(`${site.url}/places/banff-national-park/`);
    await page.getByRole('button', { name: 'Save to a trip' }).click();
    const dlg = dialog(page, /Add places in .* to a trip/);
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('link', { name: /^Add places in .* to Canadian Rockies$/ })).toHaveAttribute('href', `/t/${ID}/?edit=1&add=banff-national-park`);
    await expect(dlg.locator('.tpk-day').first()).toHaveText('Choose the places next');
  });

  test('Escape closes the picker and focus returns to Save to a trip', async ({ page, site }) => {
    await page.goto(`${site.url}/places/moraine-lake/`);
    const open = page.getByRole('button', { name: 'Save to a trip' });
    await open.click();
    await expect(dialog(page, /Add Moraine Lake to a trip/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page, /Add Moraine Lake to a trip/)).toHaveCount(0);
    await expect(open).toBeFocused();
  });
});

test('with the flag off the place page keeps its note and draws no In your copy line', async ({ page, site }) => {
  test.skip(on, 'flag-off check');
  await seed(page, [copy]);
  await page.goto(`${site.url}/places/moraine-lake/`);
  await page.getByRole('button', { name: 'Save to a trip' }).click();
  await expect(page.getByText(/Saving to a trip comes with the planner/)).toBeVisible();
  await expect(page.locator('.tpk-in')).toHaveCount(0);
});
