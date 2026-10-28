import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-INT: one walk through the whole edit-mode surface (E1, E1B, E2, E3, E4 together) on /t/<id>/. The packages were built apart, so
// each spec covers its own; this one covers what they do to each other: a removed rule row and a dropped day, a picked place that is
// dragged, a day added and a place added into it, one undo stack across all of it, and the document after a reload.
// Needs the build with NEXT_PUBLIC_TRIP_EDIT=1, then PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-edit-flow (alone, on a
// free port). With the flag off /t/ answers 404 and the test skips.
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });

/** Every day with its rows as "<kind of row> <title> <time>", in page order: the whole visible plan in one value. */
const plan = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('li.tl-day')].map((d) => ({
      id: d.id,
      title: d.querySelector('.tl-day-title')?.textContent?.trim() ?? '',
      rows: [...d.querySelectorAll<HTMLElement>('li.tl-entry')].map(
        (r) => `${r.dataset.edit ?? '-'} ${r.querySelector('.tl-title')?.textContent?.trim() ?? ''} ${r.querySelector('.tl-time')?.textContent?.trim() ?? ''}`,
      ),
    })),
  );
const stops = (page: Page, day: number) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"] .tl-title`).allTextContents();
const dayMenu = (page: Page, day: number) => page.locator(`#day-${day} .day-more`);
const toast = (page: Page, text: string | RegExp) => page.locator('.toast', { hasText: text });
const tools = (page: Page) => page.locator('.edit-tools');
async function centre(l: Locator): Promise<{ x: number; y: number }> {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('one full walk: remove, add, drag, add a day, drop a day, undo to the start, redo, reload, Done', async ({ page, site, playwright, isMobile }) => {
  test.skip(isMobile, 'the mouse drag runs on the desktop projects');
  test.setTimeout(120_000);
  const ctx = await playwright.request.newContext();
  const probe = await ctx.get(`${site.url}/t/${ID}/`);
  test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
  const days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
  await ctx.dispose();

  // open a copy and turn edit mode on
  await page.addInitScript(([k, v]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k!, v!);
  }, [COPIES_KEY, envelope([copy(days)])]);
  await page.goto(`${site.url}/t/${ID}/?view=day`);
  await expect(page.locator('li.tl-day').first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit trip' }).click();
  await expect(page).toHaveURL(/edit=1/);
  await expect(page.locator('#edit-drag-help')).toBeAttached();
  await expect(dayMenu(page, 1)).toBeVisible();
  const start = await plan(page);
  expect(start).toHaveLength(days);
  let steps = 0;

  // 1 remove a stop (Day 1)
  const d1 = await stops(page, 1);
  await page.locator('#day-1 li.tl-entry[data-edit="stop"] .tl-edit-trail button').first().click();
  await page.getByRole('menuitem', { name: 'Remove from Day 1' }).click();
  await expect.poll(() => stops(page, 1)).toEqual(d1.slice(1));
  steps++;

  // 2 remove a meal (a row the rules made, Day 1)
  const meal = page.locator('#day-1 li.tl-entry[data-edit="rule"][data-kind="meal"]').first();
  const mealName = (await meal.locator('.tl-title').innerText()).trim();
  await meal.locator('.tl-edit-trail button').click();
  await page.getByRole('menuitem', { name: 'Remove from Day 1' }).click();
  await expect(toast(page, `Removed ${mealName} from Day 1`)).toBeVisible();
  await expect(page.locator('#day-1 li.tl-entry[data-kind="meal"]', { hasText: mealName })).toHaveCount(0);
  expect(await stops(page, 1)).toEqual(d1.slice(1));
  steps++;

  // 3 add a place to Day 5 from the picker
  const d5 = await stops(page, 5);
  await page.locator('#day-5 .tl-add-open').click();
  const dlg = page.getByRole('dialog', { name: /Add a place|Add /i });
  const row = dlg.locator('.add-row').filter({ has: page.getByRole('button', { name: /^Add .* to Day 5$/ }) }).filter({ hasNotText: 'Day full' }).first();
  await expect(row).toBeVisible();
  const name = (await row.locator('.add-title').textContent())!;
  await row.getByRole('button', { name: /^Add / }).click();
  await expect(toast(page, `Added ${name} to Day 5`)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => stops(page, 5)).toContain(name);
  expect((await stops(page, 5)).length).toBe(d5.length + 1);
  steps++;

  // 4 drag that new row to Day 4 by the day rail
  const added = page.locator('#day-5 li.tl-entry[data-edit="stop"]', { hasText: name }).first();
  await added.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.33));
  const d4 = await stops(page, 4);
  const from = await centre(added.locator('.drag-handle'));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 20, { steps: 3 });
  // the strip of day numbers scrolls on its own (it follows the day in view, and is short beside the edit tools): bring Day 4 into it
  const cell = page.locator('.tl-rail-cell', { hasText: /^4$/ });
  await cell.evaluate((e) => e.scrollIntoView({ inline: 'center', block: 'nearest' }));
  await page.waitForTimeout(700);
  const c = await centre(cell);
  await page.mouse.move(c.x, c.y, { steps: 20 });
  await expect(page.locator('.drag-pill')).toHaveText(/^to Day 4 · at the end/);
  await expect.poll(() => page.locator('#day-4').evaluate((e) => Math.abs(e.getBoundingClientRect().top)), { timeout: 4000 }).toBeLessThan(260);
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect.poll(() => stops(page, 4)).toContain(name);
  expect((await stops(page, 4)).length).toBe(d4.length + 1);
  expect(await stops(page, 5)).toEqual(d5);
  steps++;

  // 5 add a day after Day 2: the numbers after it move up by one, and the moved place is on Day 5 now
  await dayMenu(page, 2).click();
  await page.getByRole('menu', { name: /Actions for Day/ }).getByRole('menuitem', { name: 'Add a day after Day 2' }).click();
  await expect(toast(page, 'Added Day 3')).toBeVisible();
  await expect(page.locator('li.tl-day')).toHaveCount(days + 1);
  await expect(page.locator('#day-3 .tl-day-title')).toHaveText('Your day');
  await expect.poll(() => stops(page, 5)).toContain(name);
  await expect(page.locator('#day-5 li.tl-entry', { hasText: name }).first().locator('.tl-edit-trail button')).toHaveAttribute('aria-label', /, Day 5$/);
  steps++;

  // 5b add a place into that new day (the picker names the new number, the dayMap puts it in the right slot)
  await page.locator('#day-3 .tl-add-open').click();
  const dlg3 = page.getByRole('dialog', { name: /Add a place|Add /i });
  await expect(dlg3.getByRole('heading', { name: 'Add a place to Day 3' }).first()).toBeVisible();
  const row3 = dlg3.locator('.add-row').filter({ has: page.getByRole('button', { name: /^Add .* to Day 3$/ }) }).filter({ hasNotText: 'Day full' }).first();
  await expect(row3).toBeVisible();
  const name3 = (await row3.locator('.add-title').textContent())!;
  await row3.getByRole('button', { name: /^Add / }).click();
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await expect.poll(() => stops(page, 3)).toContain(name3);
  steps++;
  const afterAdds = await plan(page);

  // 6 drop a day: Day 3 now has a stop, so it asks where the stop goes (default the day before) and Drop moves it there
  await dayMenu(page, 3).click();
  await page.getByRole('menu', { name: /Actions for Day/ }).getByRole('menuitem', { name: 'Drop Day 3' }).click();
  await page.getByRole('button', { name: 'Drop Day 3' }).click();
  await expect(toast(page, /^Dropped Day 3/)).toBeVisible();
  await expect(page.locator('li.tl-day')).toHaveCount(days);
  await expect.poll(() => stops(page, 2)).toContain(name3);
  await expect.poll(() => stops(page, 4)).toContain(name);
  steps++;
  const edited = await plan(page);
  expect(edited).not.toEqual(start);

  // nothing is left over the page
  await expect(page.locator('.scrim, .sheet-bottom-frame, [role="menu"], dialog[open]')).toHaveCount(0);

  // undo everything back to the start, one step per action
  for (let i = 0; i < steps; i++) {
    await expect(tools(page).getByRole('button', { name: /^Undo/ })).toBeEnabled();
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => page.locator('.edit-tools').getByRole('button', { name: /^Redo/ }).isEnabled()).toBe(true);
    // the first undo takes the dropped day back: the day count and every row are as they were before the drop
    if (i === 0) {
      await expect.poll(() => page.locator('li.tl-day').count()).toBe(days + 1);
      expect(await plan(page)).toEqual(afterAdds);
    }
  }
  await expect(tools(page).getByRole('button', { name: /^Undo/ })).toBeDisabled();
  expect(await plan(page)).toEqual(start);

  // redo everything
  for (let i = 0; i < steps; i++) {
    await expect(tools(page).getByRole('button', { name: /^Redo/ })).toBeEnabled();
    await page.keyboard.press('ControlOrMeta+Shift+z');
  }
  await expect(tools(page).getByRole('button', { name: /^Redo/ })).toBeDisabled();
  expect(await plan(page)).toEqual(edited);

  // a reload keeps the document, the day numbers and edit mode
  await page.reload();
  await expect(page.locator('li.tl-day').first()).toBeVisible();
  await expect(page.locator('.tl-edit-trail').first()).toBeVisible();
  expect(await plan(page)).toEqual(edited);

  // Done leaves edit mode and the read page shows the edited plan
  await tools(page).getByRole('button', { name: 'Done' }).click();
  await expect(page).not.toHaveURL(/edit=1/);
  await expect(page.locator('.tl-edit-trail')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit trip' })).toBeVisible();
  // (the rows no longer carry data-edit here)
  const read = (day: number) => page.locator(`#day-${day} li.tl-entry .tl-title`).allTextContents();
  expect(await read(4)).toContain(name);
  expect(await read(2)).toContain(name3);
  await page.reload();
  await expect(page.locator('li.tl-day').first()).toBeVisible();
  await expect.poll(() => read(4)).toContain(name);
});
