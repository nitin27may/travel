import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-UI2: the phone item sheet (one Move up and Move down, no snap chevrons, Remove in view, 44 px), Swap with… and Swap for a nearby place
// (one undo step each), the S key, the cover title edited in place, the Stops tab count and its rows without actions. Needs the build with
// NEXT_PUBLIC_TRIP_EDIT=1 (alone, on a free port, PW_REUSE_SITE=1 PW_SITE_URL=<server>).
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });
const titles = (page: Page, day: number) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"] .tl-title`).allTextContents();
const trail = (page: Page, day: number, i: number) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"] .tl-edit-trail button`).nth(i);

test.describe('edit mode: UI2', () => {
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

  for (const size of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
    test(`phone ${size.width}x${size.height}: the item sheet has one Move up and one Move down, no snap chevrons, 44 px buttons and Remove in view`, async ({ page, site }) => {
      await page.setViewportSize(size);
      await open(page, site);
      await trail(page, 2, 1).click();
      const sheet = page.locator('.sheet-bottom-frame');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('menuitem', { name: 'Move up' })).toHaveCount(1);
      await expect(sheet.getByRole('menuitem', { name: 'Move down' })).toHaveCount(1);
      await expect(sheet.getByRole('button', { name: /^(Expand|Collapse)$/ })).toHaveCount(0);
      const remove = sheet.getByRole('menuitem', { name: /^Remove from Day 2/ });
      await expect(remove).toBeInViewport({ ratio: 1 });
      for (const b of [sheet.getByRole('button', { name: 'Close' }), sheet.getByRole('menuitem', { name: 'Move up' }), sheet.getByRole('menuitem', { name: 'Move down' })]) {
        const r = (await b.boundingBox())!;
        expect(r.width).toBeGreaterThanOrEqual(43.5);
        expect(r.height).toBeGreaterThanOrEqual(43.5);
      }
      // the title is two lines at most
      const title = (await sheet.locator('.sheet-title').boundingBox())!;
      expect(title.height).toBeLessThan(70);
    });
  }

  test('phone: one toast at a time, standing above the item sheet, not over its rows', async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, site);
    await trail(page, 1, 0).click();
    await page.getByRole('menuitem', { name: /^Remove from Day 1/ }).click();
    await trail(page, 2, 0).click();
    await page.getByRole('menuitem', { name: /^Remove from Day 2/ }).click();
    await expect(page.locator('.toast')).toHaveCount(1);
    await trail(page, 3, 0).click();
    const sheet = page.locator('.sheet-bottom-frame');
    await expect(sheet).toBeVisible();
    const toast = page.locator('.toast');
    if (await toast.count()) {
      const t = (await toast.boundingBox())!;
      const s = (await sheet.boundingBox())!;
      expect(t.y + t.height).toBeLessThanOrEqual(s.y + 1);
    }
  });

  test('Swap with… exchanges two stops of different days in one undo step; S opens it from the keyboard', async ({ page, site }) => {
    await open(page, site);
    const a0 = await titles(page, 2);
    const b0 = await titles(page, 3);
    const li = page.locator('#day-2 li.tl-entry[data-edit="stop"][data-kind="visit"]').first();
    const a = (await li.locator('.tl-title').textContent())!.trim();
    await li.locator('.tl-edit-trail button').click();
    await page.getByRole('menuitem', { name: 'Swap with…' }).click();
    const other = page.getByRole('menuitem', { name: /^Swap .* with .*, Day 3$/ }).first();
    const label = (await other.getAttribute('aria-label'))!;
    const b = label.replace(/^Swap .* with /, '').replace(/, Day 3$/, '');
    await other.click();
    await expect(page.locator('.toast', { hasText: `Swapped ${a} and ${b}` })).toBeVisible();
    await expect.poll(async () => (await titles(page, 2)).includes(b)).toBe(true);
    await expect.poll(async () => (await titles(page, 3)).includes(a)).toBe(true);
    expect(await titles(page, 2)).not.toContain(a);
    expect(await titles(page, 3)).not.toContain(b);
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => titles(page, 2)).toEqual(a0);
    await expect.poll(() => titles(page, 3)).toEqual(b0);
    // the S key on a focused stop row opens the same list
    await page.locator('#day-2 li.tl-entry[data-edit="stop"][data-kind="visit"] .drag-handle').first().focus();
    await page.keyboard.press('s');
    await expect(page.getByRole('menuitem', { name: /^Swap .* with .*, Day 3$/ }).first()).toBeVisible();
  });

  test('Swap for a nearby place opens the picker for the stop; a pick replaces it in its slot as one undo step', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 5);
    const li = page.locator('#day-5 li.tl-entry[data-edit="stop"]').filter({ has: page.locator('.tl-title a') }).first();
    const first = (await li.locator('.tl-title').textContent())!.trim();
    await li.locator('.tl-edit-trail button').click();
    await page.getByRole('menuitem', { name: 'Swap for a nearby place' }).click();
    const dlg = page.getByRole('dialog', { name: /^Swap for a nearby place$/ });
    await expect(dlg).toBeVisible();
    const row = dlg.locator('.add-row').filter({ has: page.getByRole('button', { name: /^Swap .* for / }) }).filter({ hasNotText: 'Day full' }).first();
    const name = (await row.locator('.add-title').textContent())!.trim();
    await row.getByRole('button', { name: /^Swap/ }).click();
    await expect(page.locator('.toast', { hasText: `Swapped ${first} for ${name}` })).toBeVisible();
    await expect(dlg).toHaveCount(0);
    await expect.poll(async () => (await titles(page, 5)).includes(name)).toBe(true);
    expect(await titles(page, 5)).not.toContain(first);
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => titles(page, 5)).toEqual(before);
  });

  test('the cover title edits in place: Enter saves (one undo step), Esc cancels, the name stops at 60', async ({ page, site }) => {
    await open(page, site);
    const h1 = page.locator('h1.trip-title');
    const before = (await h1.textContent())!.trim();
    await h1.getByRole('button', { name: /^Rename the trip/ }).click();
    const input = h1.getByRole('textbox');
    await expect(input).toBeFocused();
    // same display type as the heading, not a boxed field
    expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe(await h1.evaluate((el) => getComputedStyle(el).fontSize));
    await input.fill('x'.repeat(80));
    expect((await input.inputValue()).length).toBe(60);
    await page.keyboard.press('Escape');
    await expect(h1.getByRole('button', { name: /^Rename the trip/ })).toBeVisible();
    expect((await h1.textContent())!.trim()).toBe(before);
    await h1.getByRole('button', { name: /^Rename the trip/ }).click();
    await h1.getByRole('textbox').fill('Rockies with Mia');
    await page.keyboard.press('Enter');
    await expect(page.locator('.toast', { hasText: 'Renamed the trip to Rockies with Mia' })).toBeVisible();
    await expect(h1).toContainText('Rockies with Mia');
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect(h1).toContainText(before);
  });

  test('Stops tab: the count in the tab follows a removal, stay and logistics rows have no menu and say why', async ({ page, site }) => {
    await open(page, site);
    const tab = page.getByRole('tab', { name: /^Stops/ });
    const count = async () => Number(((await tab.innerText()).match(/\d+/) ?? ['0'])[0]);
    const n0 = await count();
    expect(n0).toBeGreaterThan(0);
    const li = page.locator('#day-3 li.tl-entry[data-edit="stop"]').filter({ has: page.locator('.tl-title a') }).first();
    await li.locator('.tl-edit-trail button').click();
    await page.getByRole('menuitem', { name: /^Remove from Day 3/ }).click();
    await expect.poll(count).toBe(n0 - 1);
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(count).toBe(n0);
    await tab.click();
    const stay = page.locator('.cat-row[data-edit]').filter({ hasText: 'Banff' }).first();
    await expect(stay).toBeVisible();
    await expect(stay.locator('.cat-trail button')).toHaveCount(0);
    await expect(page.locator('.cat-trail .sr-only').first()).toHaveText(/no actions/);
  });
});
