import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { buildByAir } from './built-helpers';

// STEP2-B2: a trip the builder made is edited on /t/<id>/ like a copy, plus the engine's own actions: Keep on Day n, a move that is kept
// there, the re-flow offer and the device re-flow, a pace change applied with Rebuild (a kept stop never moves), one Undo for the
// Rebuild, a removal, an add, and a reload that keeps it all. Production build with NEXT_PUBLIC_PLAN_BUILDER=1 and NEXT_PUBLIC_TRIP_EDIT=1;
// run alone on a free port: PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-built-edit
// The server runs with NODE_ENV=test and the build POST is sent on without its Origin header (built-helpers.ts), as plan-flow.spec.ts does.
const LIST_KEY = 'travel.plans.local';

type Doc = {
  pace: string;
  picks: { ref: string; name: string; added?: boolean }[];
  edits: { day: number; refs: string[]; locked: string[]; placed?: string[] }[];
  lastBuild: { builtAt: string; days: { day: number; items: { ref: string; startMin: number | null }[] }[] };
};
const docOf = (page: Page, id: string): Promise<Doc> =>
  page.evaluate(([k, i]) => JSON.parse(localStorage.getItem(k!)!).items.find((d: { id: string }) => d.id === i), [LIST_KEY, id]);
const toast = (page: Page, text: string | RegExp) => page.locator('.toast', { hasText: text }).last();
const stopRows = (page: Page) => page.locator('li.tl-entry[data-edit="stop"]');
const rowOf = (page: Page, name: string) => stopRows(page).filter({ has: page.locator('.tl-title', { hasText: name }) }).first();
/** The day a stop shows on: the number of the day card that holds its row. */
const dayShown = (page: Page, name: string) =>
  rowOf(page, name).evaluate((li) => Number((li.closest('li.tl-day')?.id ?? li.closest('[id^="day-"]')?.id ?? '').replace(/\D+/g, '')));

test('a built trip edits like a copy: Keep on Day n, a kept move, re-flow, pace with Rebuild, Undo, remove, add, reload', async ({ page, site, request }) => {
  test.setTimeout(240_000);
  const probe = await request.get(`${site.url}/plan/`);
  test.skip(probe.status() === 404, 'needs the build with both builder flags on');
  // the private id never goes into a request path (review STEP2-ES ES-008)
  const paths: string[] = [];
  page.on('request', (r) => paths.push(new URL(r.url()).pathname));
  const id = await buildByAir(page, site);
  await expect(stopRows(page).first()).toBeVisible({ timeout: 20_000 });
  const names = await stopRows(page).locator('.tl-title').allTextContents();
  expect(names.length).toBeGreaterThan(1);
  const [keepName, moveName] = names as [string, string];
  const keepDay = await dayShown(page, keepName);

  // 1 Keep on Day n: one switch in the item sheet, with its reason; the mark appears on the row
  await rowOf(page, keepName).locator('.tl-edit-trail button').click();
  const keep = page.getByRole('menuitemcheckbox', { name: `Keep on Day ${keepDay}` });
  await expect(keep).toHaveAttribute('aria-checked', 'false');
  await keep.click();
  await expect(keep).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.keep-why').first()).toContainText('a rebuild keeps it on Day');
  await expect(page.getByRole('menuitemcheckbox', { name: 'Must see' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(rowOf(page, keepName).locator('.tl-marks')).toContainText(`Kept on Day ${keepDay}`);

  // 2 move another stop to another day: kept there, marked Moved by you
  await rowOf(page, moveName).locator('.tl-edit-trail button').click();
  await page.getByRole('menuitem', { name: 'Move to day…' }).click();
  const target = page.locator('.edit-daylist button.edit-day:not([disabled])').first();
  await expect(target).toBeVisible({ timeout: 15_000 });
  const label = (await target.locator('.edit-day-name').textContent())!;
  const to = Number(/Day (\d+)/.exec(label)![1]);
  await target.click();
  await expect(toast(page, `Moved ${moveName} to Day ${to} · kept there`)).toBeVisible();
  await expect.poll(() => dayShown(page, moveName)).toBe(to);
  await expect(rowOf(page, moveName).locator('.tl-marks')).toContainText('Moved by you');
  await expect(rowOf(page, moveName).locator('.tl-marks')).toContainText(`Kept on Day ${to}`);

  // 3 the re-flow offer names what stays; Re-flow times the days again on the device and is one undo step
  const offer = page.getByTestId('reflow-offer');
  await expect(offer).toContainText(/^Re-flow the rest\? 2 kept stay/);
  await offer.getByRole('button', { name: 'Re-flow' }).click();
  await expect(toast(page, /^Re-flowed Day/)).toBeVisible();
  await expect(offer).toHaveCount(0);
  await expect.poll(() => dayShown(page, moveName)).toBe(to);
  await expect.poll(() => dayShown(page, keepName)).toBe(keepDay);
  const reflowed = await docOf(page, id);
  const movedRef = reflowed.picks.find((p) => p.name === moveName)!.ref;
  expect(reflowed.lastBuild.days.find((d) => d.day === to)!.items.find((i) => i.ref === movedRef)!.startMin).not.toBeNull();

  // 4 pace in Settings, then Apply and rebuild: the Apply line says what changes and what stays; the kept stops stay on their days
  const before = await docOf(page, id);
  await page.locator('.edit-tools').getByRole('button', { name: 'Settings' }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  await expect(sheet.getByTestId('built-settings')).toBeVisible({ timeout: 15_000 });
  const relaxed = before.pace === 'relaxed' ? 'Full' : 'Relaxed';
  await sheet.locator('#own-pace').getByRole('radio', { name: relaxed }).click();
  const apply = sheet.getByTestId('built-apply');
  await expect(apply).toContainText(`Apply: pace ${relaxed}`);
  await expect(apply).toContainText(/Rebuild \d+ days · 2 kept stay/);
  await apply.getByRole('button', { name: 'Apply and rebuild' }).click();
  await expect(toast(page, /^Rebuilt \d+ days · 2 kept stayed/)).toBeVisible({ timeout: 60_000 });
  const rebuilt = await docOf(page, id);
  expect(rebuilt.pace).toBe(relaxed.toLowerCase());
  expect(rebuilt.lastBuild.builtAt).not.toBe(before.lastBuild.builtAt);
  await sheet.getByRole('button', { name: 'Close' }).last().click();
  await expect.poll(() => dayShown(page, keepName)).toBe(keepDay);
  await expect.poll(() => dayShown(page, moveName)).toBe(to);

  // 5 one Undo puts the previous build and pace back
  await page.locator('.edit-tools').getByRole('button', { name: /^Undo: Rebuilt/ }).click();
  await expect(toast(page, /^Undid: Rebuilt/)).toBeVisible();
  await expect.poll(async () => (await docOf(page, id)).pace).toBe(before.pace);
  expect((await docOf(page, id)).lastBuild.builtAt).toBe(before.lastBuild.builtAt);
  await expect.poll(() => dayShown(page, keepName)).toBe(keepDay);

  // 6 any stop can be removed (here the kept one), and a place can be added to a day
  // with a child on the trip the day checks arrive a moment after Undo and redraw the day, which closes a menu opened in that moment (RB-004 made
  // built trips carry a party, so this is now the usual case): open it again until it stays
  await expect(async () => {
    await rowOf(page, keepName).locator('.tl-edit-trail button').click();
    await page.getByRole('menuitem', { name: /^Remove from Day/ }).click({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await expect(toast(page, `Removed ${keepName}`)).toBeVisible();
  await expect(rowOf(page, keepName)).toHaveCount(0);
  await page.locator('.tl-add-open').first().click();
  const picker = page.locator('.add-picker').first();
  await picker.getByRole('searchbox', { name: 'Search places to add' }).fill('lake');
  const row = picker.locator('.add-row').filter({ has: page.getByRole('button', { name: /^Add .* to Day \d+$/ }) }).filter({ hasNotText: 'Day full' }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  const added = (await row.locator('.add-title').textContent())!;
  await row.getByRole('button', { name: /^Add / }).click();
  await expect(toast(page, `Added ${added}`)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(rowOf(page, added)).toBeVisible();
  await expect(rowOf(page, added).locator('.tl-marks')).toContainText('Added by you');
  const shown = await stopRows(page).locator('.tl-title').allTextContents();

  // 7 a reload keeps every edit
  await page.reload();
  await expect(stopRows(page).first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => stopRows(page).locator('.tl-title').allTextContents()).toEqual(shown);
  await expect(rowOf(page, moveName).locator('.tl-marks')).toContainText('Moved by you');

  expect(paths.filter((p) => p.includes(id))).toEqual(paths.filter((p) => p.startsWith(`/t/${id}`)));
});

test('a built day has its menu (add, drop, reset) and Export is made on the device', async ({ page, site, request }) => {
  test.setTimeout(180_000);
  const probe = await request.get(`${site.url}/plan/`);
  test.skip(probe.status() === 404, 'needs the build with both builder flags on');
  const paths: string[] = [];
  page.on('request', (r) => paths.push(new URL(r.url()).pathname));
  const id = await buildByAir(page, site);
  await expect(stopRows(page).first()).toBeVisible({ timeout: 20_000 });
  const days = await page.locator('li.tl-day').count();

  // add a day after Day 1, then drop it again
  await page.getByRole('button', { name: 'Actions for Day 1' }).click();
  await page.getByRole('menuitem', { name: 'Add a day after Day 1' }).click();
  await expect(toast(page, 'Added Day 2')).toBeVisible();
  await expect(page.locator('li.tl-day')).toHaveCount(days + 1);
  await expect(page.getByTestId('day-empty-2')).toContainText('No stops on Day 2');
  await page.getByTestId('day-empty-2').getByRole('button', { name: 'Drop Day 2' }).click();
  await expect(page.locator('li.tl-day')).toHaveCount(days);

  // a move makes Reset Day n available; Reset brings the day back to the build
  const first = (await stopRows(page).locator('.tl-title').first().textContent())!;
  const from = await dayShown(page, first);
  await rowOf(page, first).locator('.tl-edit-trail button').click();
  await page.getByRole('menuitem', { name: 'Move to day…' }).click();
  const target = page.locator('.edit-daylist button.edit-day:not([disabled])').first();
  await expect(target).toBeVisible({ timeout: 15_000 });
  await target.click();
  await expect.poll(() => dayShown(page, first)).not.toBe(from);
  await page.getByRole('button', { name: `Actions for Day ${from}` }).click();
  await page.getByRole('menuitem', { name: `Reset Day ${from}` }).click();
  await expect(toast(page, `Day ${from} is back to the built plan`)).toBeVisible();
  await expect.poll(() => dayShown(page, first)).toBe(from);

  // Export lists the person's days from the device; nothing is asked under the trip's id
  await page.getByRole('button', { name: 'Done' }).first().click();
  await page.getByRole('button', { name: 'Export trip' }).first().click();
  await expect(page.getByRole('menuitem', { name: /For a spreadsheet \(CSV\): \d+ stops on your days/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Share Trip plan' })).toBeVisible();
  expect(paths.filter((p) => p.includes(id) && !p.startsWith(`/t/${id}`))).toEqual([]);
});
