import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-E1 (EA1, EA3 buttons part): edit mode on /t/<id>/, the stop menu, Remove on every stop with Undo, Move to day, Move up and down.
// Needs the build with NEXT_PUBLIC_TRIP_EDIT=1, then PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-edit-remove (alone, on a
// free port). With the flag off /t/ answers 404 and every test here skips.
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });

async function seed(page: Page, values: Record<string, string>) {
  await page.addInitScript((kv) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, values);
}
const titles = (page: Page, day: number) => page.locator(`#day-${day} li.tl-entry[data-edit] .tl-title`).allTextContents();
const trail = (page: Page, day: number, i: number) => page.locator(`#day-${day} li.tl-entry[data-edit] .tl-edit-trail button`).nth(i);

test.describe('edit mode: the stop menu', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  async function open(page: Page, site: { url: string }, query = '?view=day&edit=1') {
    await seed(page, { [COPIES_KEY]: envelope([copy(days)]) });
    await page.goto(`${site.url}/t/${ID}/${query}`);
    await expect(page.locator('li.tl-day').first()).toBeVisible();
  }

  test('Edit trip turns the mode on with pushState, Done turns it off, Back leaves it', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([copy(days)]) });
    await page.goto(`${site.url}/t/${ID}/?view=day`);
    await expect(page.locator('.tl-edit-trail')).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit trip' }).click();
    await expect(page).toHaveURL(/edit=1/);
    await expect(page.locator('.tl-edit-trail').first()).toBeVisible();
    // one filled button: Done in the sticky row; the cover's is secondary
    await expect(page.locator('.edit-tools').getByRole('button', { name: 'Done' })).toHaveClass(/btn-primary/);
    await expect(page.locator('.trip-actions').getByRole('button', { name: 'Done' })).not.toHaveClass(/btn-primary/);
    await page.goBack();
    await expect(page).not.toHaveURL(/edit=1/);
    await expect(page.locator('.tl-edit-trail')).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit trip' }).click();
    await page.locator('.edit-tools').getByRole('button', { name: 'Done' }).click();
    await expect(page).not.toHaveURL(/edit=1/);
    await expect(page.getByRole('button', { name: 'Edit trip' })).toBeVisible();
  });

  test('EA1: every stop of every day has its menu with Remove last, and Remove then Undo puts the stop back where it was', async ({ page, site }) => {
    await open(page, site);
    for (let d = 1; d <= days; d++) {
      const day = page.locator(`#day-${d}`);
      const stops = day.locator('li.tl-entry[data-edit]');
      const n = await stops.count();
      expect(n, `Day ${d} has stops to edit`).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) await expect(day.locator('.tl-edit-trail button').nth(i)).toHaveAttribute('aria-label', new RegExp(`^Actions for .+, Day ${d}$`));
    }
    // Day 2: remove a middle stop (the second), then Undo from the toast
    const before = await titles(page, 2);
    expect(before.length).toBeGreaterThan(2);
    await trail(page, 2, 1).click();
    const menu = page.getByRole('menu');
    const rows = await menu.getByRole('menuitem').allTextContents();
    expect(rows[rows.length - 1]!.trim()).toMatch(/^Remove from Day 2$/);
    await menu.getByRole('menuitem', { name: 'Remove from Day 2' }).click();
    await expect(page.locator('.toast', { hasText: `Removed ${before[1]} from Day 2` })).toBeVisible();
    // the scheduler may re-time what is left (a regroup slot holds its time), so only the removed stop is pinned here
    await expect.poll(async () => (await titles(page, 2)).includes(before[1]!)).toBe(false);
    expect(await titles(page, 2)).toHaveLength(before.length - 1);
    await expect(page.locator('.tl-entry[data-edit]').first()).toBeVisible();
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => titles(page, 2)).toEqual(before);
  });

  test('a removal is kept on the device across a reload and shows in the changes sheet with its own button', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 1);
    await trail(page, 1, 0).click();
    await page.getByRole('menuitem', { name: 'Remove from Day 1' }).click();
    await expect.poll(() => titles(page, 1)).toEqual(before.slice(1));
    await expect(page.getByText('1 change from our plan').first()).toBeVisible();
    await page.reload();
    await expect.poll(() => titles(page, 1)).toEqual(before.slice(1));
    await page.getByRole('button', { name: 'Show' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Changes from our plan' });
    await expect(sheet.getByText(`Removed ${before[0]} from Day 1`)).toBeVisible();
    await sheet.getByRole('button', { name: 'Put it back' }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => titles(page, 1)).toEqual(before);
  });

  test('Move to day lists the days in order with the current day disabled, moves the stop and marks it', async ({ page, site }) => {
    await open(page, site);
    const first = (await titles(page, 1))[0]!;
    await trail(page, 1, 0).click();
    await page.getByRole('menuitem', { name: 'Move to day…' }).click();
    const list = page.getByRole('menuitem', { name: /^Now on Day 1/ });
    await expect(list).toBeDisabled();
    await page.getByRole('menuitem', { name: /^Day 3/ }).click();
    await expect(page.locator('.toast', { hasText: `Moved ${first} to Day 3` })).toBeVisible();
    await expect.poll(() => titles(page, 3)).toContain(first);
    await expect(page.locator('#day-3 li.tl-entry', { hasText: first }).getByText('Moved from Day 1')).toBeVisible();
    await expect.poll(() => titles(page, 1)).not.toContain(first);
  });

  test('Move up and Move down reorder a stop inside its day, with a reason when there is nowhere to go', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 2);
    await trail(page, 2, 0).click();
    await expect(page.getByRole('menuitem', { name: 'Move up' })).toBeDisabled();
    await page.getByRole('menuitem', { name: 'Move down' }).click();
    await expect.poll(async () => (await titles(page, 2)).indexOf(before[0]!)).toBeGreaterThan(0);
  });
});

test.describe('edit mode on a phone (EA3, no drag)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });

  test('the edit bar replaces the public bar, and the item sheet moves a stop to another day by button', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([copy(days)]) });
    await page.goto(`${site.url}/t/${ID}/?view=day&edit=1`);
    const bar = page.getByRole('group', { name: 'Editing Canadian Rockies' });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('button')).toHaveText(['Settings', 'Done']);
    await expect(page.locator('.bottom-bar')).toBeHidden();
    const first = (await titles(page, 1))[0]!;
    await trail(page, 1, 0).scrollIntoViewIfNeeded();
    await trail(page, 1, 0).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('menuitem').first()).toHaveText('Move to day…');
    await sheet.getByRole('menuitem', { name: 'Move to day…' }).click();
    await sheet.getByRole('menuitem', { name: /^Day 2/ }).click();
    await expect(page.locator('.toast', { hasText: `Moved ${first} to Day 2` })).toBeVisible();
    await expect.poll(() => titles(page, 2)).toContain(first);
    await bar.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.bottom-bar')).toBeVisible();
  });
});
