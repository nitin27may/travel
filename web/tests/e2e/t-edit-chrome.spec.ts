import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-UI1: the phone edit bar holds Undo and Redo (components 8.6, 360 and 390 wide), and on a laptop the day strip keeps every day
// while the edit tools take a second line below 1600 px (patterns 3.13 item 4). Needs the build with NEXT_PUBLIC_TRIP_EDIT=1.
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });
const titles = (page: Page, day: number) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"] .tl-title`).allTextContents();

test.describe('edit chrome by width', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  async function open(page: Page, site: { url: string }) {
    await page.addInitScript((kv) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(kv.k, kv.v);
    }, { k: COPIES_KEY, v: envelope([copy(days)]) });
    await page.goto(`${site.url}/t/${ID}/?view=day&edit=1`);
    await expect(page.locator('.tl-edit-trail').first()).toBeVisible();
  }

  for (const width of [360, 390]) {
    test(`phone ${width}: Undo and Redo stay in the edit bar after the toast is gone`, async ({ page, site }) => {
      await page.setViewportSize({ width, height: 844 });
      await open(page, site);
      const bar = page.locator('.edit-bar');
      const undo = bar.getByRole('button', { name: /^Undo/ });
      const redo = bar.getByRole('button', { name: /^Redo/ });
      await expect(undo).toBeDisabled();
      await expect(redo).toBeDisabled();
      const before = await titles(page, 1);
      await page.locator('#day-1 li.tl-entry[data-edit="stop"] .tl-edit-trail button').first().click();
      await page.getByRole('menuitem', { name: 'Remove from Day 1' }).click();
      await expect.poll(() => titles(page, 1)).toEqual(before.slice(1));
      await expect(page.locator('.toast')).toHaveCount(0, { timeout: 12_000 });
      await expect(undo).toBeEnabled();
      await expect(undo).toHaveAttribute('aria-label', /^Undo: Removed/);
      // all four controls fit the bar: 44 px wide at least, inside the viewport, none over another
      const boxes = [];
      for (const b of [undo, redo, bar.getByRole('button', { name: 'Settings' }), bar.getByRole('button', { name: 'Done' })]) {
        const r = await b.boundingBox();
        expect(r).not.toBeNull();
        expect(r!.width).toBeGreaterThanOrEqual(44);
        expect(r!.height).toBeGreaterThanOrEqual(44);
        expect(r!.x).toBeGreaterThanOrEqual(0);
        expect(r!.x + r!.width).toBeLessThanOrEqual(width);
        boxes.push(r!);
      }
      for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width + 7);
      await undo.click();
      await expect.poll(() => titles(page, 1)).toEqual(before);
      await expect(redo).toBeEnabled();
      await expect(undo).toBeDisabled();
    });
  }

  for (const width of [1280, 1440]) {
    test(`laptop ${width}: the day strip shows every day and the tools take a second line`, async ({ page, site }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, site);
      const rail = page.locator('.tl-planbar .tl-rail-days');
      const fits = await rail.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      expect(fits).toBe(true);
      expect(await rail.locator('li').count()).toBe(days);
      const bar = (await page.locator('.tl-planbar').boundingBox())!;
      const tools = (await page.locator('.tl-planbar .edit-tools').boundingBox())!;
      const railBox = (await rail.boundingBox())!;
      expect(tools.y).toBeGreaterThanOrEqual(railBox.y + railBox.height - 1);
      expect(tools.y + tools.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
      expect(tools.x + tools.width).toBeLessThanOrEqual(width);
    });
  }

  test('laptop 1760: still every day, tools and Export on the second line', async ({ page, site }) => {
    await page.setViewportSize({ width: 1760, height: 900 });
    await open(page, site);
    const rail = page.locator('.tl-planbar .tl-rail-days');
    expect(await rail.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const bar = (await page.locator('.tl-planbar').boundingBox())!;
    const exp = (await page.locator('.tl-planbar-export').boundingBox())!;
    const tools = (await page.locator('.tl-planbar .edit-tools').boundingBox())!;
    expect(Math.abs(exp.y - tools.y)).toBeLessThan(40);
    expect(exp.y + exp.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
    expect(bar.height).toBeLessThan(130);
  });
  test('the public sticky row is unchanged: no tools, one line at 1440', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${site.url}/trips/${SLUG}/?view=day`);
    await expect(page.locator('.tl-planbar')).toBeVisible();
    expect(await page.locator('.tl-planbar-tools').count()).toBe(0);
    expect((await page.locator('.tl-planbar').boundingBox())!.height).toBeLessThan(70);
  });
});
