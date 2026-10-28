import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-E2 (EA4): the keyboard model of edit mode on /t/<id>/ (edit-mode-spec 5.3; patterns 1.3): lift, arrows, Page keys, Home, End, drop, Esc,
// Alt+arrows, the single-letter keys and the one setting that turns them off, with the announcements. Needs the build with NEXT_PUBLIC_TRIP_EDIT=1,
// then PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-edit-keyboard (alone, on a free port). With the flag off /t/ answers 404 and
// every test here skips.
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const SINGLE_KEY = 'travel.trip-edit.single-keys';
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
const titles = (page: Page, day: number) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"] .tl-title`).allTextContents();
const handle = (page: Page, day: number, i: number) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"]`).nth(i).locator('.drag-handle');
const say = (page: Page) => page.locator('.sr-only[role="status"]');

test.describe('the keyboard model', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  async function open(page: Page, site: { url: string }, extra: Record<string, string> = {}) {
    await seed(page, { [COPIES_KEY]: envelope([copy(days)]), ...extra });
    await page.goto(`${site.url}/t/${ID}/?view=day&edit=1`);
    await expect(page.locator('li.tl-day').first()).toBeVisible();
    await expect(page.locator('#edit-drag-help')).toBeAttached();
  }

  test('Space lifts, an arrow moves the line and says the position, Space drops: one toast, one undo step', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 2);
    const n = before.length;
    await handle(page, 2, 0).focus();
    await page.keyboard.press('Space');
    await expect(handle(page, 2, 0)).toHaveAttribute('aria-pressed', 'true');
    await expect(say(page)).toContainText(`Lifted ${before[0]}, Day 2, position 1 of ${n}`);
    await expect(page.locator('.drag-line')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(say(page)).toContainText(`${before[0]}, Day 2, position 2 of ${n}`);
    await page.keyboard.press('ArrowDown');
    await expect(say(page)).toContainText(`position 3 of ${n}`);
    // nothing has moved yet: the lift is a preview until the drop
    expect(await titles(page, 2)).toEqual(before);
    await page.keyboard.press('Space');
    await expect(page.locator('.toast', { hasText: `Moved ${before[0]} to position 3 of ${n}` })).toBeVisible();
    // the scheduler has the last word on the order (a fixed-time stop holds its place), so the stop is somewhere below where it was
    await expect.poll(async () => (await titles(page, 2)).indexOf(before[0]!)).toBeGreaterThan(0);
    expect((await titles(page, 2)).length).toBe(n);
    await expect(say(page)).toContainText(`Moved ${before[0]}, position`);
    // focus stays on the moved stop's handle
    await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.dragHandle ?? '')).toMatch(/^2:/);
    await expect(page.locator('#day-2 li.tl-entry[data-edit="stop"] .drag-handle:focus')).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => titles(page, 2)).toEqual(before);
  });

  test('Enter lifts and drops too, End goes to the bottom of the day, Home to the top', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 2);
    await handle(page, 2, 1).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('End');
    await expect(say(page)).toContainText(`position ${before.length} of ${before.length}`);
    await page.keyboard.press('Home');
    await expect(say(page)).toContainText(`position 1 of ${before.length}`);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await titles(page, 2))[0]).toBe(before[1]);
  });

  test('Esc cancels: the stop is back, nothing changed, and it says so', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 2);
    await handle(page, 2, 0).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(say(page)).toContainText(`Cancelled. ${before[0]}, Day 2, position 1 of ${before.length}`);
    await expect(page.locator('.drag-line')).toHaveCount(0);
    await expect(handle(page, 2, 0)).not.toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.toast')).toHaveCount(0);
    expect(await titles(page, 2)).toEqual(before);
    await expect(handle(page, 2, 0)).toBeFocused();
  });

  test('Page Down moves it to the next day: the pill names the day, the drop lands there and Undo takes it back', async ({ page, site }) => {
    await open(page, site);
    const d2 = await titles(page, 2);
    const d3 = await titles(page, 3);
    await handle(page, 2, 0).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('PageDown');
    await expect(say(page)).toContainText(`${d2[0]}, Day 3, position 1 of ${d3.length + 1}`);
    await expect(page.locator('.drag-pill')).toHaveText(/^to Day 3/);
    await page.keyboard.press('Space');
    await expect(page.locator('.toast', { hasText: `Moved ${d2[0]} to Day 3` })).toBeVisible();
    await expect.poll(() => titles(page, 3)).toContain(d2[0]);
    await expect.poll(() => titles(page, 2)).toEqual(d2.slice(1));
    await expect(say(page)).toContainText(`Moved ${d2[0]} to Day 3, position`);
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => titles(page, 2)).toEqual(d2);
    await expect.poll(() => titles(page, 3)).toEqual(d3);
  });

  test('Alt+Up and Alt+Down move a stop without lifting it, and the top stop says it is already first', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 2);
    await handle(page, 2, 1).focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect.poll(async () => (await titles(page, 2)).indexOf(before[1]!)).toBe(0);
    await expect(say(page)).toContainText(new RegExp(`${before[1]}, Day 2, position \\d of ${before.length}`));
    await expect(page.locator('.drag-line')).toHaveCount(0);
    await expect(page.locator('.toast', { hasText: `Moved ${before[1]} up` })).toBeVisible();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(say(page)).toContainText(`${before[1]} is already first on Day 2`);
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(async () => (await titles(page, 2)).indexOf(before[1]!)).toBeGreaterThan(0);
  });

  test('Delete on a stop removes it with Undo; with single-letter shortcuts off it does nothing, and the ? list turns them off and on again', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 1);
    await handle(page, 1, 0).focus();
    await page.keyboard.press('Delete');
    await expect(page.locator('.toast', { hasText: `Removed ${before[0]} from Day 1` })).toBeVisible();
    await expect.poll(() => titles(page, 1)).toEqual(before.slice(1));
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => titles(page, 1)).toEqual(before);
    // the ? list, with the one setting
    await handle(page, 1, 0).focus();
    await page.keyboard.press('?');
    const dlg = page.getByRole('dialog', { name: 'Keys in edit mode' });
    await expect(dlg).toBeVisible();
    await dlg.getByRole('switch', { name: /Single-letter shortcuts/ }).click();
    expect(await page.evaluate((k) => localStorage.getItem(k), SINGLE_KEY)).toBe('off');
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await handle(page, 1, 0).focus();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    expect(await titles(page, 1)).toEqual(before);
    // a letter does not exit edit mode either
    await page.keyboard.press('e');
    await expect(page).toHaveURL(/edit=1/);
    // the lift keys are not single letters: they still work
    await page.keyboard.press('Space');
    await expect(handle(page, 1, 0)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    // it stays off after a reload, and the list says so
    await page.reload();
    await expect(page.locator('#edit-drag-help')).toBeAttached();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Keys in edit mode' }).getByRole('switch', { name: /Single-letter shortcuts/ })).toHaveAttribute('aria-checked', 'false');
  });

  test('M opens Move to day, A opens the add picker of the day, E leaves edit mode', async ({ page, site }) => {
    await open(page, site);
    await handle(page, 2, 0).focus();
    await page.keyboard.press('m');
    await expect(page.getByRole('menuitem', { name: /^Now on Day 2/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await handle(page, 2, 0).focus();
    await page.keyboard.press('a');
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Add a place to Day 2' }).first()).toBeVisible(); // E3's picker
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await handle(page, 2, 0).focus();
    await page.keyboard.press('e');
    await expect(page).not.toHaveURL(/edit=1/);
    await expect(page.getByRole('button', { name: 'Edit trip' })).toBeVisible();
  });

  test('letters typed in a field do nothing else: the note field takes e, m, a and Delete as text', async ({ page, site }) => {
    await open(page, site);
    const before = await titles(page, 1);
    await page.locator('#day-1 li.tl-entry[data-edit="stop"] .tl-edit-trail button').first().click();
    await page.getByRole('menuitem', { name: 'Add a note' }).click();
    const field = page.getByRole('textbox', { name: 'Note' });
    await field.fill('');
    await field.pressSequentially('ema');
    await page.keyboard.press('Backspace');
    await expect(field).toHaveValue('em');
    await expect(page).toHaveURL(/edit=1/);
    expect(await titles(page, 1)).toEqual(before);
  });
});
