import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-E1 (EA5, EA6): undo and redo (buttons and keys), the stack kept across a reload in the tab, the changes line, Reset to our plan
// with its confirm above three changes. Needs the build with NEXT_PUBLIC_TRIP_EDIT=1 (see t-edit-remove.spec.ts).
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });
const titles = (page: Page, day: number) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"] .tl-title`).allTextContents();

test.describe('edit mode: undo, redo, changes, reset', () => {
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
  async function removeFirst(page: Page, day: number) {
    await page.locator(`#day-${day} li.tl-entry[data-edit="stop"] .tl-edit-trail button`).first().click();
    await page.getByRole('menuitem', { name: `Remove from Day ${day}` }).click();
  }

  test('Undo and Redo by button and by key, and the toast says what was undone', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 1);
    await removeFirst(page, 1);
    await expect.poll(() => titles(page, 1)).toEqual(before.slice(1));
    const tools = page.locator('.edit-tools');
    await expect(tools.getByRole('button', { name: /^Redo/ })).toBeDisabled();
    await tools.getByRole('button', { name: /^Undo: Removed/ }).click();
    await expect.poll(() => titles(page, 1)).toEqual(before);
    await expect(tools.getByRole('button', { name: /^Undo/ })).toBeDisabled();
    await tools.getByRole('button', { name: /^Redo: Removed/ }).click();
    await expect.poll(() => titles(page, 1)).toEqual(before.slice(1));
    await page.keyboard.press('Control+z');
    await expect.poll(() => titles(page, 1)).toEqual(before);
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(() => titles(page, 1)).toEqual(before.slice(1));
  });

  test('EA5: the undo stack survives a reload in the same tab', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 1);
    await removeFirst(page, 1);
    await removeFirst(page, 1);
    await expect.poll(() => titles(page, 1)).toEqual(before.slice(2));
    await page.reload();
    await expect.poll(() => titles(page, 1)).toEqual(before.slice(2));
    const tools = page.locator('.edit-tools');
    await expect(tools.getByRole('button', { name: /^Undo/ })).toBeEnabled();
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await expect.poll(() => titles(page, 1)).toEqual(before);
  });

  test('EA6: Reset to our plan does not ask for three changes or fewer, and asks for four with Cancel first', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 1);
    for (let i = 0; i < 3; i++) await removeFirst(page, 1);
    await page.locator('.trip-actions').getByRole('button', { name: 'Trip actions' }).click();
    await page.getByRole('menuitem', { name: 'Reset to our plan' }).click();
    await expect.poll(() => titles(page, 1)).toEqual(before);
    await expect(page.getByText('Reset to our plan').first()).toBeVisible();
    await page.locator('.edit-tools').getByRole('button', { name: /^Undo/ }).click();
    await expect.poll(() => titles(page, 1)).toEqual(before.slice(3));
    await removeFirst(page, 1);
    await page.locator('.trip-actions').getByRole('button', { name: 'Trip actions' }).click();
    await page.getByRole('menuitem', { name: 'Reset to our plan' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('Reset to our plan? Your 4 changes are removed. You can undo this until you leave the page.');
    await expect(confirm.getByRole('button').first()).toHaveText('Cancel');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => titles(page, 1)).toEqual(before.slice(4));
    // Cancel goes back to the menu's rows, still open
    await page.getByRole('menuitem', { name: 'Reset to our plan' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reset' }).click();
    await expect.poll(() => titles(page, 1)).toEqual(before);
    await page.keyboard.press('Control+z');
    await expect.poll(() => titles(page, 1)).toEqual(before.slice(4));
  });

  test('the sync word reads On this device on a signed-out device, and edit mode is announced', async ({ page, site }) => {
    await open(page, site);
    await expect(page.locator('.own-state .own-sync')).toHaveText('On this device');
    await expect(page.locator('.edit-tools .own-sync')).toHaveCount(0); // ER-022: the quiet word is in the cover meta, not the sticky row
    await removeFirst(page, 1);
    await expect(page.locator('[role="status"][aria-live="polite"]').filter({ hasText: /Removed .+ from Day 1/ }).first()).toBeAttached();
  });
});
