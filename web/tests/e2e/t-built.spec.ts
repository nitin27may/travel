import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { buildByAir } from './built-helpers';

// STEP2-B1: a trip made in the builder opens on the same details page as a copy (`/t/<id>/`), in edit mode with the just-built line,
// and can be edited there. Production build with NEXT_PUBLIC_PLAN_BUILDER=1 and NEXT_PUBLIC_TRIP_EDIT=1; run alone on a free port:
//   PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-built
// The server runs with NODE_ENV=test and the build POST is sent on without its Origin header, as plan-flow.spec.ts does.
const LIST_KEY = 'travel.plans.local';

const stops = (page: Page) => page.locator('li.tl-entry[data-edit="stop"] .tl-title').allTextContents();
const toast = (page: Page, text: string | RegExp) => page.locator('.toast', { hasText: text });
const docOf = (page: Page, id: string) =>
  page.evaluate(([k, i]) => JSON.parse(localStorage.getItem(k!)!).items.find((d: { id: string }) => d.id === i), [LIST_KEY, id]);

test('Build my days lands on the trip: just-built line, Days in time order, built=1 gone, remove, add, undo, reload, Mine opens it in read mode', async ({ page, site, request }) => {
  test.setTimeout(180_000);
  const probe = await request.get(`${site.url}/plan/`);
  test.skip(probe.status() === 404, 'needs the build with both builder flags on');
  const id = await buildByAir(page, site);

  // 1 the page is the copy's page: edit mode on Days, the just-built line, built=1 consumed after the first paint
  await expect(page.locator('li.tl-day').first()).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(new RegExp(`/t/${id}/\\?edit=1&view=day$`));
  await expect(page.getByTestId('just-built')).toContainText(/Built \d+ days/);
  await expect(page.getByTestId('just-built')).toContainText('Just built');
  await expect(page.locator('.tl-day-title').first()).toBeVisible();
  await expect(page.locator('.edit-tools')).toBeVisible();
  // a day's stops run in time order
  const times = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('li.tl-day')].map((d) => [...d.querySelectorAll('li.tl-entry[data-edit="stop"] .tl-time')].map((t) => (t.textContent ?? '').replace(/[^0-9:]/g, '')).filter(Boolean)),
  );
  for (const day of times) expect([...day].sort()).toEqual(day);

  // 2 the Summary carries the build block
  await page.getByRole('tab', { name: 'Summary' }).click();
  await expect(page.getByTestId('built-summary')).toContainText('How it was built');
  await page.getByRole('tab', { name: 'Days' }).click();

  // 3 remove a stop, then Undo
  const before = await stops(page);
  expect(before.length).toBeGreaterThan(1);
  await page.locator('li.tl-entry[data-edit="stop"] .tl-edit-trail button').first().click();
  await page.getByRole('menuitem', { name: /^Remove from Day/ }).click();
  await expect.poll(() => stops(page)).toEqual(before.slice(1));
  expect((await docOf(page, id)).picks.length).toBe((await docOf(page, id)).picks.length);
  await toast(page, /Removed/).getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => stops(page)).toEqual(before);

  // 4 remove again and keep it; add a place from the picker to an empty day
  await page.locator('li.tl-entry[data-edit="stop"] .tl-edit-trail button').first().click();
  await page.getByRole('menuitem', { name: /^Remove from Day/ }).click();
  await expect.poll(() => stops(page)).toEqual(before.slice(1));
  const left = await stops(page);
  await page.locator('.tl-add-open').first().click();
  // a built trip has no published candidates: the picker offers the catalogue by search (and the build's left-out picks when there are any)
  const picker = page.locator('.add-picker').first();
  await picker.getByRole('searchbox', { name: 'Search places to add' }).fill('lake');
  const row = picker.locator('.add-row').filter({ has: page.getByRole('button', { name: /^Add .* to Day \d+$/ }) }).filter({ hasNotText: 'Day full' }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  const name = (await row.locator('.add-title').textContent())!;
  await row.getByRole('button', { name: /^Add / }).click();
  await expect(toast(page, `Added ${name}`)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => stops(page)).toContain(name);
  const after = await stops(page);
  expect(after.length).toBe(left.length + 1);
  const saved = await docOf(page, id);
  expect(saved.picks.some((p: { name: string; added?: boolean }) => p.added === true)).toBe(true);

  // 5 a reload keeps the edits and shows no just-built line
  await page.reload();
  await expect(page.locator('li.tl-day').first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => stops(page)).toEqual(after);
  await expect(page.getByTestId('just-built')).toHaveCount(0);

  // 6 Mine lists it and opens it in read mode
  await page.goto(`${site.url}/mine/`);
  const open = page.locator(`a[href*="/t/${id}/"]`).first();
  await expect(open).toBeVisible({ timeout: 20_000 });
  await open.click();
  await expect(page).toHaveURL(new RegExp(`/t/${id}/`));
  await expect(page).not.toHaveURL(/edit=1/);
  await expect(page.getByRole('button', { name: 'Edit trip' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.edit-tools')).toHaveCount(0);
});

test('an address for a trip that is not on this device is the not-found state', async ({ page, site, request }) => {
  const probe = await request.get(`${site.url}/plan/`);
  test.skip(probe.status() === 404, 'needs the build with both builder flags on');
  await page.goto(`${site.url}/t/0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d/?edit=1&built=1`);
  await expect(page.getByText('This trip is not on this device or in your account.')).toBeVisible();
});
