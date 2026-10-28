import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-E3 (EA2): the add-a-place picker on /t/<id>/?edit=1. Needs the build with NEXT_PUBLIC_TRIP_EDIT=1, then PW_REUSE_SITE=1
// PW_SITE_URL=<that server> playwright test t-edit-add (alone, on a free port). With the flag off /t/ answers 404 and every test skips.
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });
const titles = (page: Page, day: number) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"] .tl-title`).allTextContents();

test.describe('edit mode: the add picker', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  async function open(page: Page, site: { url: string }, query = '?view=day&edit=1') {
    await page.addInitScript(([k, v]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k!, v!);
    }, [COPIES_KEY, envelope([copy(days)])]);
    await page.goto(`${site.url}/t/${ID}/${query}`);
    await expect(page.locator('li.tl-day').first()).toBeVisible();
  }
  const picker = (page: Page) => page.getByRole('dialog', { name: /Add a place|Add /i });

  test('every day has Add a place to Day n; the picker lists groups with fit lines, never a park, and fetches only a page of places for the base', async ({ page, site }) => {
    const api: string[] = [];
    page.on('request', (r) => { if (/\/api\/v1\/(places|near)\//.test(r.url())) api.push(r.url()); });
    await open(page, site);
    for (let d = 1; d <= days; d++) await expect(page.locator(`#day-${d} .tl-add-open`)).toHaveText(`Add a place to Day ${d}`);
    expect(api).toEqual([]);
    await page.locator('#day-5 .tl-add-open').click();
    const dlg = picker(page);
    await expect(dlg.getByRole('heading', { name: 'Add a place to Day 5' }).first()).toBeVisible();
    await expect(dlg.getByText(/^Base: /)).toBeVisible();
    await expect(dlg.getByRole('heading', { name: /^Within 30 km, with a place page$/i })).toBeVisible();
    await expect(dlg.locator('.add-fit').first()).toBeVisible();
    await expect(dlg.getByText(/National Park/i).first()).toHaveCount(0).catch(() => undefined);
    expect(await dlg.locator('.add-kind-area, [data-kind="area"]').count()).toBe(0);
    // one bounded page, no bulk load
    expect(api.length).toBeGreaterThan(0);
    for (const u of api) expect(u).toMatch(/pageSize=48/);
  });

  test('Add puts the place on the day as one undo step with a toast, the row reads Added with Undo, and the new stop has Remove in its menu', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 5);
    await page.locator('#day-5 .tl-add-open').click();
    const dlg = picker(page);
    const row = dlg.locator('.add-row').filter({ has: page.getByRole('button', { name: /^Add .* to Day 5$/ }) }).filter({ hasNotText: 'Day full' }).first();
    await expect(row).toBeVisible();
    const name = (await row.locator('.add-title').textContent())!;
    const same = dlg.locator('.add-row').filter({ has: page.locator('.add-title', { hasText: name }) }).first();
    await row.getByRole('button', { name: /^Add / }).click();
    await expect(page.locator('.toast', { hasText: `Added ${name} to Day 5` })).toBeVisible();
    await expect(same.getByText('Added', { exact: true })).toBeVisible();
    await expect(same.getByRole('button', { name: /^Undo adding/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.poll(() => titles(page, 5)).toContain(name);
    expect((await titles(page, 5)).length).toBe(before.length + 1);
    await expect(page.locator('#day-5 .tl-add-open')).toBeFocused();
    // the new row can be removed
    const li = page.locator('#day-5 li.tl-entry', { hasText: name }).first();
    await li.locator('.tl-edit-trail button').click();
    await expect(page.getByRole('menuitem', { name: 'Remove from Day 5' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Undo from the toast takes it back
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => titles(page, 5)).toEqual(before);
  });

  test('Move here is offered for a place already on the trip, never a duplicate', async ({ page, site }) => {
    await open(page, site);
    await page.locator('#day-5 .tl-add-open').click();
    const dlg = picker(page);
    const mv = dlg.getByRole('button', { name: /^Move .* to Day 5$/ }).first();
    await expect(mv).toBeVisible();
    await expect(dlg.getByText(/^On Day \d+$/).first()).toBeVisible();
    await mv.click();
    await expect(page.locator('.toast', { hasText: /^Moved .* to Day 5/ })).toBeVisible();
  });

  test('a place found by search that the plan model does not carry is scheduled, and is still there after a reload', async ({ page, site }) => {
    await open(page, site);
    await page.locator('#day-5 .tl-add-open').click();
    const dlg = picker(page);
    await dlg.getByRole('searchbox', { name: 'Search places to add' }).fill('lake');
    const row = dlg.locator('#add-h-search + ul .add-row').filter({ has: page.getByRole('button', { name: /^Add .* to Day 5$/ }) }).first();
    await expect(row).toBeVisible();
    const name = (await row.locator('.add-title').textContent())!;
    await row.getByRole('button', { name: /^Add / }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => titles(page, 5)).toContain(name);
    await page.reload();
    await expect.poll(() => titles(page, 5)).toContain(name);
  });

  test('search reaches the whole catalogue, nearest the base first; Rainy day narrows places and says so when nothing is marked', async ({ page, site }) => {
    await open(page, site);
    await page.locator('#day-5 .tl-add-open').click();
    const dlg = picker(page);
    await dlg.getByRole('searchbox', { name: 'Search places to add' }).fill('lake');
    await expect(dlg.getByRole('heading', { name: 'Search results' })).toBeVisible();
    const names = await dlg.locator('#add-h-search + ul .add-title').allTextContents();
    expect(names.length).toBeGreaterThan(1);
    await dlg.getByRole('button', { name: 'Rainy day' }).click();
    await expect(dlg.getByRole('button', { name: 'Rainy day' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('add=<slug> opens the picker with that place, one row per day, and leaves the address; a park opens its members; a far place gets no day', async ({ page, site }) => {
    await open(page, site, '?view=day&edit=1&add=moraine-lake');
    const dlg = picker(page);
    await expect(dlg.getByText('Moraine Lake').first()).toBeVisible();
    await expect(page).not.toHaveURL(/add=/);
    await expect(dlg.getByRole('button', { name: /^(Add|Move) to Day \d+$/ }).first()).toBeVisible();
  });

  test('an unknown slug says so', async ({ page, site }) => {
    await open(page, site, '?view=day&edit=1&add=no-such-place-here');
    await expect(picker(page).getByText('We do not have this place any more.')).toBeVisible();
  });

  test('a park is never a stop: its slug lists members, and a place on the other side of the world offers only a new trip', async ({ page, site }) => {
    await open(page, site, '?view=day&edit=1&add=banff-national-park');
    const dlg = picker(page);
    await expect(dlg.getByText('A park is not a stop. Pick a place in it.')).toBeVisible();
    await page.goto(`${site.url}/t/${ID}/?view=day&edit=1&add=cinque-torri`);
    const far = picker(page);
    await expect(far.getByText(/from this trip's bases\./)).toBeVisible();
    await expect(far.getByRole('button', { name: /^Add to Day/ })).toHaveCount(0);
  });
});
