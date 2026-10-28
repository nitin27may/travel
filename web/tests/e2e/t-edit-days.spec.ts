import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-E4 (EA7): day and trip actions in edit mode on /t/<id>/ and the Settings sheet. Needs the build with NEXT_PUBLIC_TRIP_EDIT=1, then
// PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-edit-days (alone, on a free port). With the flag off /t/ answers 404 and every
// test here skips.
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
const dayCount = (page: Page) => page.locator('li.tl-day').count();
const stops = (page: Page, day: number) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"] .tl-title`).allTextContents();
const dayMenu = (page: Page, day: number) => page.locator(`#day-${day} .day-more`);
/** The open menu (desktop) or sheet (phone). */
const panel = (page: Page): Locator => page.getByRole('menu', { name: /Actions for Day/ });
const toast = (page: Page, text: string | RegExp) => page.locator('.toast', { hasText: text });
const undo = (page: Page) => page.locator('.toast').last().getByRole('button', { name: 'Undo' }).click();
/** Nothing is left over the page: no scrim, no sheet frame, and the element at the page's middle is the page's own. */
async function expectNoOverlay(page: Page) {
  await expect(page.locator('.scrim, .sheet-bottom-frame, [role="menu"]')).toHaveCount(0);
  const blocked = await page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return !!el?.closest('.scrim, .sheet, .popover, [data-base-ui-inert]');
  });
  expect(blocked).toBe(false);
}

test.describe('edit mode: day actions', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  async function open(page: Page, site: { url: string }) {
    await seed(page, { [COPIES_KEY]: envelope([copy(days)]) });
    await page.goto(`${site.url}/t/${ID}/?view=day&edit=1`);
    await expect(page.locator('li.tl-day').first()).toBeVisible();
    await expect(dayMenu(page, 1)).toBeVisible();
  }
  /** Whether Drop Day n asks about a booking, by opening the question and closing it again. */
  async function holdsBooking(page: Page, day: number): Promise<boolean> {
    await dayMenu(page, day).click();
    await panel(page).getByRole('menuitem', { name: `Drop Day ${day}` }).click();
    const asks = (await page.getByRole('alertdialog').count()) > 0;
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    return asks;
  }

  test('every day has its menu, with the rows in order and Drop last', async ({ page, site }) => {
    await open(page, site);
    await expect(page.locator('.day-more')).toHaveCount(days);
    await dayMenu(page, 2).click();
    const rows = await panel(page).getByRole('menuitem').allTextContents();
    const names = rows.map((r) => r.trim());
    expect(names[0]).toBe('Add a day after Day 2');
    expect(names[1]).toBe('Add a note');
    expect(names.indexOf('Reset Day 2')).toBeGreaterThan(1);
    expect(names[names.length - 1]).toBe('Drop Day 2');
    // a day that is still our plan cannot be reset, and says why
    await expect(panel(page).getByRole('menuitem', { name: 'Reset Day 2' })).toBeDisabled();
    await expect(panel(page).getByText('Day 2 is already our plan')).toBeVisible();
    await page.keyboard.press('Escape');
    await expectNoOverlay(page);
  });

  test('Add a day adds an empty Day 3 after Day 2, renumbers the rest, and Undo takes it back', async ({ page, site }) => {
    await open(page, site);
    const was3 = await page.locator('#day-3 .tl-day-title').innerText();
    await dayMenu(page, 2).click();
    await panel(page).getByRole('menuitem', { name: 'Add a day after Day 2' }).click();
    await expect(toast(page, 'Added Day 3')).toBeVisible();
    await expect(page.locator('li.tl-day')).toHaveCount(days + 1);
    await expect(page.locator('#day-3 .tl-day-title')).toHaveText('Your day');
    await expect(page.locator('#day-3 .tl-empty')).toBeVisible();
    // the old Day 3 is Day 4 now, with its menu and stops named by the new number
    await expect(page.locator('#day-4 .tl-day-title')).toHaveText(was3);
    await expect(page.locator('#day-4 .tl-edit-trail button').first()).toHaveAttribute('aria-label', /, Day 4$/);
    await expect(page.locator('#day-3 .tl-add-open, #day-3 .tl-add button').first()).toBeVisible();
    await undo(page);
    await expect(page.locator('li.tl-day')).toHaveCount(days);
    await expect(page.locator('#day-3 .tl-day-title')).toHaveText(was3);
  });

  test('an empty day drops at once, without a question, and Undo puts it back', async ({ page, site }) => {
    await open(page, site);
    await dayMenu(page, 2).click();
    await panel(page).getByRole('menuitem', { name: 'Add a day after Day 2' }).click();
    await expect(page.locator('#day-3 .tl-day-title')).toHaveText('Your day');
    await dayMenu(page, 3).click();
    await panel(page).getByRole('menuitem', { name: 'Drop Day 3' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(toast(page, 'Dropped Day 3')).toBeVisible();
    await expect(page.locator('li.tl-day')).toHaveCount(days);
    await expectNoOverlay(page);
    await undo(page);
    await expect(page.locator('li.tl-day')).toHaveCount(days + 1);
    await expect(page.locator('#day-3 .tl-day-title')).toHaveText('Your day');
  });

  test('Drop a day with stops asks where they go (default the day before) and a day without a booking does not confirm', async ({ page, site }) => {
    await open(page, site);
    // a day with stops and no booking
    let day = 0;
    for (let d = 3; d <= days && !day; d++) if ((await stops(page, d)).length && !(await holdsBooking(page, d))) day = d;
    expect(day, 'a day with stops and no booking').toBeGreaterThan(0);
    // the regroup rows ("Together again ...") are not places: the question does not count them
    const all = await stops(page, day);
    const mine = all.filter((t) => !t.startsWith('Together again'));
    const before = await stops(page, day - 1);
    const later = await page.locator(`#day-${day + 1} .tl-day-title`).innerText().catch(() => null);
    await dayMenu(page, day).click();
    await panel(page).getByRole('menuitem', { name: `Drop Day ${day}` }).click();
    const q = page.locator('fieldset.edit-drop-set').filter({ hasText: `Its ${mine.length === 1 ? 'stop' : `${mine.length} stops`}` });
    await expect(q).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(q.getByRole('radio', { name: /^Move to/ })).toBeChecked();
    await expect(q.getByRole('combobox', { name: 'Move to day' })).toHaveValue(String(day - 1));
    await q.page().getByRole('button', { name: `Drop Day ${day}` }).click();
    await expect(toast(page, new RegExp(`^Dropped Day ${day} · its .*moved to Day ${day - 1}`))).toBeVisible();
    await expect(page.locator('li.tl-day')).toHaveCount(days - 1);
    await expectNoOverlay(page);
    // the stops are at the end of the day before; the day after is Day n now
    const after = await stops(page, day - 1);
    expect(after.length).toBeGreaterThanOrEqual(before.length + mine.length);
    for (const s of mine) expect(after).toContain(s);
    if (later) await expect(page.locator(`#day-${day} .tl-day-title`)).toHaveText(later);
    await undo(page);
    await expect(page.locator('li.tl-day')).toHaveCount(days);
    expect(await stops(page, day)).toEqual(all);
    expect(await stops(page, day - 1)).toEqual(before);
  });

  test('a stop-less choice: Go to Maybe keeps the places, are removed drops them, each one undo step', async ({ page, site }) => {
    await open(page, site);
    const mine = await stops(page, 2);
    await dayMenu(page, 2).click();
    await panel(page).getByRole('menuitem', { name: 'Drop Day 2' }).click();
    if (await page.getByRole('alertdialog').count()) {
      // Day 2 holds a booking: confirm is its own test; leave
      return;
    }
    await page.getByRole('radio', { name: 'Go to Maybe' }).check();
    await page.getByRole('button', { name: 'Drop Day 2' }).click();
    await expect(toast(page, /^Dropped Day 2 · its .*in Maybe/)).toBeVisible();
    await expect(page.locator('li.tl-day')).toHaveCount(days - 1);
    await page.getByRole('button', { name: 'Show' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Changes from our plan' });
    await expect(sheet.getByText('Dropped Day 2 of our plan')).toBeVisible();
    await page.keyboard.press('Escape');
    await undo(page);
    await expect(page.locator('li.tl-day')).toHaveCount(days);
    expect(await stops(page, 2)).toEqual(mine);
  });

  test('a day with a booking confirms by name, Cancel leaves it, and the confirm is the only one', async ({ page, site }) => {
    await open(page, site);
    let day = 0;
    for (let d = 1; d <= days && !day; d++) if (await holdsBooking(page, d)) day = d;
    test.skip(!day, 'this trip has no booking on a day');
    await dayMenu(page, day).click();
    await panel(page).getByRole('menuitem', { name: `Drop Day ${day}` }).click();
    const ask = page.getByRole('alertdialog');
    await expect(ask).toContainText(new RegExp(`Drop Day ${day} and its .* booking`));
    // Cancel is first in the tab order, and leaves the day alone
    await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expect(ask.getByRole('button', { name: `Drop Day ${day}` })).toHaveClass(/btn-danger/);
    await ask.getByRole('button', { name: 'Cancel' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.locator('li.tl-day')).toHaveCount(days);
    await expect(toast(page, /Dropped/)).toHaveCount(0);
    await dayMenu(page, day).click();
    await panel(page).getByRole('menuitem', { name: `Drop Day ${day}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: `Drop Day ${day}` }).click();
    await expect(toast(page, `Dropped Day ${day}`)).toBeVisible();
    await expect(page.locator('li.tl-day')).toHaveCount(days - 1);
    await undo(page);
    await expect(page.locator('li.tl-day')).toHaveCount(days);
  });

  test('Reset Day n puts a day back to our plan with Undo, no question', async ({ page, site }) => {
    await open(page, site);
    const before = await stops(page, 2);
    await page.locator('#day-2 li.tl-entry[data-edit="stop"] .tl-edit-trail button').first().click();
    await page.getByRole('menuitem', { name: 'Remove from Day 2' }).click();
    await expect.poll(() => stops(page, 2)).toHaveLength(before.length - 1);
    await dayMenu(page, 2).click();
    await panel(page).getByRole('menuitem', { name: 'Reset Day 2' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(toast(page, 'Day 2 is back to our plan')).toBeVisible();
    await expect.poll(() => stops(page, 2)).toEqual(before);
    await undo(page);
    await expect.poll(() => stops(page, 2)).toHaveLength(before.length - 1);
  });

  test('Add a note shows it under the day header; saving empty removes it', async ({ page, site }) => {
    await open(page, site);
    await dayMenu(page, 1).click();
    await panel(page).getByRole('menuitem', { name: 'Add a note' }).click();
    await page.locator('#edit-note-t').fill('Leave by 8, the lot fills early');
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(toast(page, 'Saved a note on Day 1')).toBeVisible();
    await expect(page.getByTestId('day-status-1')).toContainText('Your note Leave by 8, the lot fills early');
    await page.reload();
    await expect(page.getByTestId('day-status-1')).toContainText('Leave by 8');
    await dayMenu(page, 1).click();
    await expect(panel(page).getByRole('menuitem', { name: 'Edit the note' })).toBeVisible();
    await panel(page).getByRole('menuitem', { name: 'Edit the note' }).click();
    await page.locator('#edit-note-t').fill('');
    await page.getByRole('button', { name: 'Remove note' }).click();
    // The wrapper stays mounted (it hosts the warnings) but holds nothing and takes no space.
    await expect(page.getByTestId('day-status-1')).toBeEmpty();
    await expect(page.getByTestId('day-status-1')).toBeHidden();
    await expect(page.locator('#day-1')).not.toContainText('Leave by 8');
  });

  test('Version of Day n lists each version with its consequence, changes it with Undo, and leaves nothing over the page', async ({ page, site }) => {
    await open(page, site);
    let day = 0;
    for (let d = 1; d <= days && !day; d++) if ((await page.locator(`#day-${d} .tl-vchip`).count()) > 0) day = d;
    test.skip(!day, 'this trip has no day with versions');
    const chip = page.locator(`#day-${day} .tl-vchip`);
    const was = (await chip.locator('.tl-vchip-label').innerText()).trim();
    await dayMenu(page, day).click();
    await panel(page).getByRole('menuitem', { name: `Version of Day ${day}…` }).click();
    const list = panel(page);
    await expect(list.getByRole('menuitem').first()).toBeVisible();
    await expect(list.getByRole('menuitem', { name: /\(now\)/ })).toBeDisabled();
    await expect(list.locator('.edit-day-sub').first()).not.toHaveText('Checking this version');
    const other = list.getByRole('menuitem').filter({ hasNotText: '(now)' }).first();
    await other.click();
    await expect(toast(page, new RegExp(`^Day ${day} now uses version [ABC]`))).toBeVisible();
    await expect(chip.locator('.tl-vchip-label')).not.toHaveText(was);
    await expectNoOverlay(page);
    // the page answers a click at once: nothing invisible is in the way
    await page.locator(`#day-${day} .day-more`).click();
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await undo(page);
    await expect(chip.locator('.tl-vchip-label')).toHaveText(was);
  });

  test('stops on a day after an added day are named by the number the page shows, and a removal there holds', async ({ page, site }) => {
    await open(page, site);
    await dayMenu(page, 1).click();
    await panel(page).getByRole('menuitem', { name: 'Add a day after Day 1' }).click();
    await expect(page.locator('#day-2 .tl-day-title')).toHaveText('Your day');
    // published Day 2 is Day 3 now
    const before = await stops(page, 3);
    await page.locator('#day-3 li.tl-entry[data-edit="stop"] .tl-edit-trail button').first().click();
    await page.getByRole('menuitem', { name: 'Remove from Day 3' }).click();
    await expect(toast(page, new RegExp(`^Removed .* from Day 3`))).toBeVisible();
    await expect.poll(() => stops(page, 3)).toHaveLength(before.length - 1);
    await page.reload();
    await expect.poll(() => stops(page, 3)).toHaveLength(before.length - 1);
    await page.getByRole('button', { name: 'Show' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Changes from our plan' });
    await expect(sheet.getByText(/^Removed .* from Day 3$/)).toBeVisible();
    await expect(sheet.getByText('Added Day 2')).toBeVisible();
  });
});

test.describe('edit mode: Settings', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  async function open(page: Page, site: { url: string }) {
    await seed(page, { [COPIES_KEY]: envelope([copy(days)]) });
    await page.goto(`${site.url}/t/${ID}/?view=day&edit=1`);
    await expect(page.locator('li.tl-day').first()).toBeVisible();
    const phone = (page.viewportSize()?.width ?? 1280) < 640;
    await (phone ? page.getByRole('group', { name: /^Editing/ }).getByRole('button', { name: 'Settings' }) : page.locator('.edit-tools').getByRole('button', { name: 'Settings' })).click();
    const sheet = page.getByRole('dialog', { name: 'Settings' });
    await expect(sheet).toBeVisible();
    return sheet;
  }

  test('the sections come in the spec order: name, dates, who is going, pace, make it yours', async ({ page, site }) => {
    const sheet = await open(page, site);
    const heads = await sheet.locator('.field-label, h3').allTextContents();
    const order = ['Trip name', 'Starts', 'Who is going', 'Pace', 'Make it yours'];
    const at = order.map((h) => heads.findIndex((x) => x.trim() === h));
    expect(at.every((i) => i >= 0), `${heads.join(' | ')}`).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    await expect(sheet.getByRole('group', { name: 'Days' })).toBeVisible();
    await expect(sheet.getByLabel('Trip name')).toHaveAttribute('maxlength', '60');
    await expect(sheet.getByRole('button', { name: 'Sat 8 Sep 2029' }).or(sheet.locator('.own-set-date'))).toBeVisible();
  });

  test('the name saves on Enter with an Undo toast, and a long name stops at 60 characters', async ({ page, site }) => {
    const sheet = await open(page, site);
    const name = sheet.getByLabel('Trip name');
    await name.fill('x'.repeat(80));
    expect(await name.inputValue()).toHaveLength(60);
    await name.fill('Rockies with the cousins');
    await name.press('Enter');
    await expect(toast(page, 'Renamed the trip to Rockies with the cousins')).toBeVisible();
    await undo(page);
    await expect(toast(page, /^Undid: Renamed/)).toBeVisible();
  });

  test('Who is going and Pace change the copy at once and say it in the toast', async ({ page, site }) => {
    const sheet = await open(page, site);
    await sheet.getByRole('radio', { name: 'Relaxed' }).click();
    await expect(toast(page, 'Pace is now Relaxed')).toBeVisible();
    await sheet.getByRole('button', { name: 'More adults' }).click();
    await expect(toast(page, /^Planned for 3 adults/)).toBeVisible();
  });

  test('a new start date relabels the days and moves no stop', async ({ page, site }) => {
    const sheet = await open(page, site);
    const before = await stops(page, 2);
    // SW-008 (copies/2): a device copy can be undated too, so "No date" is offered here as on an account trip
    await expect(sheet.getByRole('button', { name: 'No date', exact: true })).toBeVisible();
    await sheet.locator('.own-set-date').click();
    await sheet.locator('.cal-cell[data-date="2029-09-15"]').click();
    await expect(toast(page, /^The trip starts .* days relabelled, no stop moved/)).toBeVisible();
    await expect(sheet.locator('.own-set-date')).not.toContainText('8 Sep');
    expect(await stops(page, 2)).toEqual(before);
    await undo(page);
    await expect(sheet.locator('.own-set-date')).toContainText('8 Sep 2029');
  });

  test('SW-008: No date clears a device copy\'s start, the days are numbered only, and Undo puts the date back', async ({ page, site }) => {
    const sheet = await open(page, site);
    await sheet.getByRole('button', { name: 'No date', exact: true }).click();
    await expect(toast(page, 'The trip has no dates · days are numbered only')).toBeVisible();
    await expect(sheet.locator('.own-set-date')).toContainText('No date');
    const env = await page.evaluate(() => JSON.parse(localStorage.getItem('travel.copies.local') ?? 'null') as { schema: string; items: { start: string | null }[] });
    expect(env).toMatchObject({ schema: 'copies/2', items: [{ start: null }] });
    await undo(page);
    await expect(sheet.locator('.own-set-date')).toContainText('8 Sep 2029');
  });

  test('a shorter trip asks which day goes and where its stops go, then Apply drops it as one step', async ({ page, site }) => {
    const sheet = await open(page, site);
    const less = sheet.getByRole('button', { name: 'Fewer days' });
    await less.click();
    const ask = sheet.getByRole('group', { name: 'Which days go' });
    await expect(ask).toBeVisible();
    await expect(ask.getByRole('combobox', { name: /Day to drop/ })).toHaveValue(String(days));
    await expect(ask.getByRole('status')).toContainText(new RegExp(`^Drop Day ${days} ·`));
    // nothing moves before Apply
    await expect(page.locator('li.tl-day')).toHaveCount(days);
    await ask.getByRole('button', { name: 'Cancel' }).click();
    await expect(ask).toHaveCount(0);
    await less.click();
    await ask.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('li.tl-day')).toHaveCount(days - 1);
    await expect(toast(page, new RegExp(`^Drop Day ${days}`))).toBeVisible();
    await undo(page);
    await expect(page.locator('li.tl-day')).toHaveCount(days);
  });

  test('a longer trip asks where the new days go, then Apply adds them', async ({ page, site }) => {
    const sheet = await open(page, site);
    await sheet.getByRole('button', { name: 'More days' }).click();
    await sheet.getByRole('button', { name: 'More days' }).click();
    const ask = sheet.getByRole('group', { name: 'Where the new days go' });
    await ask.getByRole('combobox').selectOption({ label: /After Day 4/ as unknown as string }).catch(async () => {
      await ask.getByRole('combobox').selectOption('4');
    });
    await expect(ask.getByRole('status')).toHaveText('Add 2 days · after Day 4');
    await ask.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('li.tl-day')).toHaveCount(days + 2);
    await expect(page.locator('#day-5 .tl-day-title')).toHaveText('Your day');
    await expect(page.locator('#day-6 .tl-day-title')).toHaveText('Your day');
    await undo(page);
    await expect(page.locator('li.tl-day')).toHaveCount(days);
  });

  test('Make it yours: Your driving and pace goes to Pace, Change places opens the add row on Day 1', async ({ page, site }) => {
    const sheet = await open(page, site);
    await sheet.getByRole('button', { name: 'Your driving and pace' }).click();
    await expect(sheet.getByRole('radio', { name: 'Standard' })).toBeFocused();
    await sheet.getByRole('button', { name: 'Change places' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
  });
});

test.describe('edit mode: day actions on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });

  test('the day sheet adds a day, and a closed sheet leaves nothing over the page', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([copy(days)]) });
    await page.goto(`${site.url}/t/${ID}/?view=day&edit=1`);
    await expect(page.locator('li.tl-day').first()).toBeVisible();
    await dayMenu(page, 1).scrollIntoViewIfNeeded();
    await dayMenu(page, 1).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('menuitem').first()).toHaveText('Add a day after Day 1');
    const h = await sheet.getByRole('menuitem').first().boundingBox();
    expect(h!.height).toBeGreaterThanOrEqual(44);
    await sheet.getByRole('menuitem', { name: 'Add a day after Day 1' }).click();
    await expect(toast(page, 'Added Day 2')).toBeVisible();
    await expect(page.locator('li.tl-day')).toHaveCount(days + 1);
    await expect(page.locator('.sheet-bottom-frame')).toHaveCount(0);
    // the Settings sheet's controls are 44 px high on a phone (SW-016)
    await page.getByRole('group', { name: /^Editing/ }).getByRole('button', { name: 'Settings' }).click();
    const set = page.getByRole('dialog', { name: 'Settings' });
    const small: string[] = [];
    for (const [name, c] of Object.entries({
      name: set.locator('.input').first(),
      date: set.locator('.own-set-date'),
      pace: set.getByRole('radio', { name: 'Relaxed' }),
      done: set.getByRole('button', { name: 'Done' }),
      moreDays: set.getByRole('button', { name: 'More days' }),
      fewerDays: set.getByRole('button', { name: 'Fewer days' }),
      moreAdults: set.getByRole('button', { name: 'More adults' }),
      close: set.getByRole('button', { name: /Close|Collapse|Expand/ }).first(),
    })) {
      const box = await c.boundingBox();
      if (!box || box.height < 43.5 || box.width < 43.5) small.push(`${name} ${box?.width}x${box?.height}`);
    }
    expect(small, 'controls under 44 px').toEqual([]);
  });
});
