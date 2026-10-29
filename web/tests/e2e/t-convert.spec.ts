import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-B3: a copy becomes the person's own trip in place. The Make it yours card shows once on a new copy and is dismissed for good; the
// first engine action (a plan row or Rebuild in Settings) shows the convert notice inline; Continue converts as one undo step (the copy's
// stops stay on their days, "From our trip"); the built features apply; Undo gives the copy back; a reload keeps the converted trip; Mine names
// the trip it began as; Reset to our plan makes a fresh copy of our trip in place. Production build with NEXT_PUBLIC_TRIP_EDIT=1 (and
// NEXT_PUBLIC_PLAN_BUILDER=1 for the Rebuild run); run alone on a free port: PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-convert
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const PLANS_KEY = 'travel.plans.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: new Date().toISOString(),
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });
const toast = (page: Page, text: string | RegExp) => page.locator('.toast', { hasText: text }).last();
const lists = (page: Page) =>
  page.evaluate(([c, p]) => {
    const a = JSON.parse(localStorage.getItem(c!) ?? '{"items":[]}') as { items: unknown[] };
    const b = JSON.parse(localStorage.getItem(p!) ?? '{"items":[]}') as { items: { id: string; seed?: string; convertedAt?: string; title?: string; edits: { fromTrip?: string[] }[] }[] };
    return { copies: a.items.length, plans: b.items };
  }, [COPIES_KEY, PLANS_KEY]);

async function seed(page: Page, site: { url: string }, request: { get: (u: string) => Promise<{ status(): number; json(): Promise<unknown> }> }): Promise<number | null> {
  const probe = await request.get(`${site.url}/t/${ID}/`);
  if (probe.status() === 404) return null;
  const days = ((await (await request.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
  await page.addInitScript(([k, v]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k!, v!);
  }, [COPIES_KEY, envelope([copy(days)])]);
  return days;
}

test('Make it yours shows once, Keep it as it is remembers, and the copy stays a copy', async ({ page, site, request }) => {
  test.setTimeout(120_000);
  const days = await seed(page, site, request);
  test.skip(days === null, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
  await page.goto(`${site.url}/t/${ID}/?edit=1&view=day`);
  const card = page.getByTestId('make-it-yours');
  await expect(card).toBeVisible({ timeout: 20_000 });
  // focus lands on its heading; the three choices and the dismissal are there, above Day 1
  await expect(card.getByRole('heading', { name: 'Make it yours' })).toBeFocused();
  for (const name of ['Change places', 'Your driving and pace', 'Where you start', 'Keep it as it is']) await expect(card.getByRole('button', { name })).toBeVisible();
  const above = await page.evaluate(() => document.querySelector('[data-testid="make-it-yours"]')!.compareDocumentPosition(document.querySelector('#day-1')!) & Node.DOCUMENT_POSITION_FOLLOWING);
  expect(above).toBeTruthy();
  // Change places opens the add picker on Day 1 and converts nothing
  await card.getByRole('button', { name: 'Change places' }).click();
  await expect(page.getByRole('dialog').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await card.getByRole('button', { name: 'Keep it as it is' }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator('li.tl-day').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('make-it-yours')).toHaveCount(0);
  // still a copy: nothing moved
  expect(await lists(page)).toMatchObject({ copies: 1, plans: [] });
  // after dismissal it is a section of Settings and a row of the cover's menu
  await page.locator('.edit-tools').getByRole('button', { name: 'Settings' }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  await expect(sheet.getByRole('heading', { name: 'Make it yours' })).toBeVisible();
  await sheet.getByLabel('Close').click();
  await page.getByRole('button', { name: 'Trip actions' }).first().click();
  await expect(page.getByRole('menuitem', { name: /Make it yours/ })).toBeVisible();
});

test('the convert notice asks inline, Cancel changes nothing, Continue converts as one step, Undo gives the copy back, a reload keeps it', async ({ page, site, request }) => {
  test.setTimeout(180_000);
  const days = await seed(page, site, request);
  test.skip(days === null, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
  await page.goto(`${site.url}/t/${ID}/?edit=1&view=day`);
  await expect(page.getByTestId('make-it-yours')).toBeVisible({ timeout: 20_000 });
  const before = await page.locator('li.tl-entry[data-edit="stop"] .tl-title').allTextContents();
  const kicker = page.locator('.trip-kicker, .cover-kicker, [data-kicker]').first();
  void kicker;

  // the card's Where you start goes to Settings with the notice, not a dialog of its own
  await page.getByTestId('make-it-yours').getByRole('button', { name: 'Where you start' }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  const notice = sheet.getByTestId('convert-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('This makes it your own trip. Our later updates to the Canadian Rockies trip will no longer change it. You can undo this until you leave the page.');
  await expect(notice.getByRole('button', { name: 'Continue' })).toBeVisible();
  // Cancel: nothing changes
  await notice.getByRole('button', { name: 'Cancel' }).click();
  await expect(notice).toHaveCount(0);
  expect(await lists(page)).toMatchObject({ copies: 1, plans: [] });

  // a plan row asks again; Continue converts
  await sheet.getByRole('button', { name: 'Days and driving' }).click();
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Continue' }).click();
  await expect(toast(page, 'Made this your own trip')).toBeVisible({ timeout: 20_000 });
  // the built sections of the converted trip open on what was asked
  await expect(sheet.getByTestId('built-settings')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /^Days and driving/ })).toHaveAttribute('aria-expanded', 'true');
  const after = await lists(page);
  expect(after.copies).toBe(0);
  expect(after.plans).toHaveLength(1);
  expect(after.plans[0]).toMatchObject({ id: ID, seed: SLUG, title: 'Canadian Rockies' });
  expect(after.plans[0]!.convertedAt).toBeTruthy();
  // every one of our stops is kept on its day, "From our trip"
  const kept = after.plans[0]!.edits.reduce((n, e) => n + (e.fromTrip?.length ?? 0), 0);
  expect(kept).toBeGreaterThan(0);

  // it is a built trip now: the cover says so, and the built features apply
  await sheet.getByLabel('Close').click();
  await expect(page.locator('body')).toContainText('Your trip · made from our Canadian Rockies trip');
  await page.locator('li.tl-entry[data-edit="stop"] .tl-edit-trail button').first().click();
  await expect(page.getByRole('menuitemcheckbox', { name: /^Keep on Day/ })).toBeVisible();
  await page.keyboard.press('Escape');
  const marks = await page.locator('li.tl-entry .tl-marks').allTextContents();
  expect(marks.join(' ')).toContain('From our trip');
  const names = await page.locator('li.tl-entry[data-edit="stop"] .tl-title').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  // the places that were stops stay stops (the rows of the plan that are not places are the only ones that go)
  for (const n of names) expect(before).toContain(n);

  // a reload keeps the converted trip
  await page.reload();
  await expect(page.locator('li.tl-day').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('body')).toContainText('Your trip · made from our Canadian Rockies trip');
  expect(await lists(page)).toMatchObject({ copies: 0 });

  // Mine names the trip it began as
  await page.goto(`${site.url}/mine/`);
  const row = page.locator('li.crow[data-draft]').first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.locator('.crow-from')).toHaveText('Made from Canadian Rockies');

  // Undo (still this tab's session): the copy is back, with its versions
  await page.goto(`${site.url}/t/${ID}/?edit=1&view=day`);
  await expect(page.locator('li.tl-day').first()).toBeVisible({ timeout: 20_000 });
  await page.locator('.edit-tools').getByRole('button', { name: /^Undo: / }).first().click();
  // the step on top of the stack is the convert's own (nothing else was changed)
  await expect(page.locator('body')).toContainText('Your copy · from our');
  const back = await lists(page);
  expect(back.copies).toBe(1);
  expect(back.plans).toEqual([]);
  expect(await page.locator('li.tl-entry[data-edit="stop"] .tl-title').allTextContents()).toEqual(before);
  // Redo converts again
  await page.locator('.edit-tools').getByRole('button', { name: /^Redo: / }).click();
  await expect(page.locator('body')).toContainText('Your trip · made from our');
  expect((await lists(page)).plans).toHaveLength(1);
});

test('Reset to our plan after a conversion replaces the trip with a fresh copy, and Undo brings the converted trip back', async ({ page, site, request }) => {
  test.setTimeout(180_000);
  const days = await seed(page, site, request);
  test.skip(days === null, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
  await page.goto(`${site.url}/t/${ID}/?edit=1&view=day`);
  await expect(page.getByTestId('make-it-yours')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('make-it-yours').getByRole('button', { name: 'Your driving and pace' }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  await sheet.getByTestId('convert-notice').getByRole('button', { name: 'Continue' }).click();
  await expect(toast(page, 'Made this your own trip')).toBeVisible({ timeout: 20_000 });
  await sheet.getByLabel('Close').click();

  await page.getByRole('button', { name: 'Trip actions' }).first().click();
  await page.getByRole('menuitem', { name: 'Reset to our plan' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('replaces your trip with a fresh copy of our Canadian Rockies plan');
  await confirm.getByRole('button', { name: 'Reset' }).click();
  await expect(toast(page, 'Reset to our plan')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('body')).toContainText('Your copy · from our');
  expect(await lists(page)).toMatchObject({ copies: 1, plans: [] });
  await page.locator('.edit-tools').getByRole('button', { name: /^Undo: Reset to our plan/ }).click();
  await expect(page.locator('body')).toContainText('Your trip · made from our');
  expect((await lists(page)).plans).toHaveLength(1);
});

test('Rebuild on a copy meets the notice first, then converts and rebuilds', async ({ page, site, request }) => {
  test.setTimeout(240_000);
  const days = await seed(page, site, request);
  test.skip(days === null, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
  const probe = await request.get(`${site.url}/plan/`);
  test.skip(probe.status() === 404, 'needs the build with both builder flags on');
  // the build POST is sent on without its Origin header (as plan-flow.spec.ts does)
  await page.route('**/api/v1/plan/build/', async (route) => {
    const headers = { ...route.request().headers() };
    delete headers.origin;
    delete headers.referer;
    await route.fulfill({ response: await route.fetch({ headers }) });
  });
  await page.goto(`${site.url}/t/${ID}/?edit=1&view=day`);
  await expect(page.locator('li.tl-day').first()).toBeVisible({ timeout: 20_000 });
  await page.locator('.edit-tools').getByRole('button', { name: 'Settings' }).click();
  const sheet = page.getByRole('dialog', { name: 'Settings' });
  await sheet.getByRole('button', { name: 'Rebuild' }).click();
  await expect(sheet.getByTestId('convert-notice')).toContainText('This makes it your own trip');
  expect((await lists(page)).copies).toBe(1);
  await sheet.getByTestId('convert-notice').getByRole('button', { name: 'Continue' }).click();
  await expect(toast(page, /^Rebuilt \d+ days?/)).toBeVisible({ timeout: 90_000 });
  const after = await lists(page);
  expect(after.copies).toBe(0);
  expect(after.plans[0]).toMatchObject({ id: ID, seed: SLUG });
});
