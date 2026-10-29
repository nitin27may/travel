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
    const dlg = dialog(page, /^Add to a trip$/);
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
    await page.goto(`${site.url}/places/mount-lawrence-grassi/`);
    await page.getByRole('button', { name: 'Save to a trip' }).click();
    const dlg = dialog(page, /^Add to a trip$/);
    const row = dlg.locator('.tpk-row').filter({ hasText: 'Canadian Rockies' });
    await expect(row).toBeVisible();
    await expect(row.locator('.tpk-day')).toHaveText('The best day is picked next');
    await row.getByRole('link', { name: /^Add Mount Lawrence Grassi to Canadian Rockies$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/t/${ID}/`));
    const add = dialog(page, /Add /i);
    await expect(add.getByText('Mount Lawrence Grassi').first()).toBeVisible();
    const btn = add.getByRole('button', { name: /^(Add|Move) to Day \d+$/ }).first();
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('.toast', { hasText: /Mount Lawrence Grassi to Day|Moved/ })).toBeVisible();
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
    await expect(dialog(page, /^Add to a trip$/).locator('.tpk-day')).toHaveText('On Day 5 in this trip');
    expect(seen).toEqual([]);
  });

  test('a copy of a public trip that uses the place names the day of our plan (PR-019)', async ({ page, site }) => {
    await seed(page, [copy]);
    await page.goto(`${site.url}/places/moraine-lake/`);
    await expect(page.locator('.tpk-in')).toContainText('In your copy of Canadian Rockies');
    await expect(page.locator('.tpk-in')).toContainText('≈ Day 11 in our plan');
  });

  test('a park offers its members, never itself as a stop', async ({ page, site }) => {
    await seed(page, [copy]);
    await page.goto(`${site.url}/places/banff-national-park/`);
    await page.getByRole('button', { name: 'Save to a trip' }).click();
    const dlg = dialog(page, /^Add to a trip$/);
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('.tpk-place')).toContainText(/Places in\s*Banff National Park/);
    await expect(dlg.getByRole('link', { name: /^Add places in .* to Canadian Rockies$/ })).toHaveAttribute('href', `/t/${ID}/?edit=1&add=banff-national-park`);
    await expect(dlg.locator('.tpk-day').first()).toHaveText('Choose the places next');
  });

  test('Escape closes the picker and focus returns to Save to a trip', async ({ page, site }) => {
    await page.goto(`${site.url}/places/moraine-lake/`);
    const open = page.getByRole('button', { name: 'Save to a trip' });
    await open.click();
    await expect(dialog(page, /^Add to a trip$/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page, /^Add to a trip$/)).toHaveCount(0);
    await expect(open).toBeFocused();
  });
});

const DOLO = { ...copy, id: '1a1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f', slug: 'dolomites-2027', title: 'Dolomites', cc: 'IT', start: '2027-07-03' };
const VT = { ...copy, id: '3c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f', slug: 'new-hampshire-stopover-2026', title: 'New Hampshire stopover', cc: 'US', start: '2026-11-20' };

test.describe('the picker ranks trips by distance (PR-001, PR-002, PR-006, PR-017)', () => {
  test.beforeEach(() => test.skip(!on, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1'));

  test('the trip near Moraine Lake is first and the rest say Far from Moraine Lake with Open trip; a trip with the place already says Open Day', async ({ page, site }) => {
    // dates put Dolomites and New Hampshire before the Rockies: only distance can put the Rockies first
    await seed(page, [DOLO, VT, copy]);
    await page.goto(`${site.url}/places/moraine-lake/`);
    await page.getByRole('button', { name: 'Save to a trip' }).click();
    const dlg = dialog(page, /^Add to a trip$/);
    await expect(dlg.locator('.tpk-row')).toHaveCount(3);
    await expect(dlg.locator('.tpk-name')).toHaveText(['Canadian Rockies', 'New Hampshire stopover', 'Dolomites'].map((t) => new RegExp(`^${t}`)));
    await expect(dlg.locator('.tpk-day')).toHaveText(['On Day 11 in this trip', 'Far from Moraine Lake', 'Far from Moraine Lake']);
    await expect(dlg.getByRole('link', { name: /^Moraine Lake is on Day 11 of Canadian Rockies: open Day 11$/ })).toHaveAttribute('href', `/t/${ID}/?view=day#day-11`);
    await expect(dlg.getByRole('link', { name: 'Open trip' })).toHaveCount(2);
    // the base points were looked up once and kept on the device
    expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('travel.copy-bases.local') ?? '{}')).sort())).toEqual(['canadian-rockies-2029', 'dolomites-2027', 'new-hampshire-stopover-2026']);
  });

  test('a far trip is not a dead end: Back to the place and Save without a trip', async ({ page, site }) => {
    await seed(page, [DOLO]);
    await page.goto(`${site.url}/t/${DOLO.id}/?edit=1&add=moraine-lake`);
    const add = page.getByRole('dialog');
    await expect(add.getByText(/from this trip's bases/)).toBeVisible();
    await expect(add.getByRole('link', { name: 'Back to Moraine Lake' })).toHaveAttribute('href', '/places/moraine-lake/');
    await add.getByRole('button', { name: 'Save without a trip' }).click();
    await expect(page.locator('.toast')).toContainText(/favourites/);
  });

  test('Tab wraps inside the picker: from Save without a trip it goes back to the sheet, never out to the page', async ({ page, site }) => {
    await seed(page, [copy]);
    await page.goto(`${site.url}/places/moraine-lake/`);
    await page.getByRole('button', { name: 'Save to a trip' }).click();
    const dlg = dialog(page, /^Add to a trip$/);
    await dlg.getByRole('button', { name: 'Save without a trip' }).focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  });

  test('a damaged list says so, in Mine\'s words', async ({ page, site }) => {
    await page.addInitScript(() => localStorage.setItem('travel.copies.local', '{nope'));
    await page.goto(`${site.url}/places/moraine-lake/`);
    await page.getByRole('button', { name: 'Save to a trip' }).click();
    await expect(dialog(page, /^Add to a trip$/).getByRole('heading', { name: /couldn.t read your trips/ })).toBeVisible();
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
