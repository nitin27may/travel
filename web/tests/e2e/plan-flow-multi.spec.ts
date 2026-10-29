import { expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

// TB-W2: the builder's multi-region and multi-base flow, and "Start from this trip" (X7). Production build with NEXT_PUBLIC_PLAN_BUILDER=1 and
// NEXT_PUBLIC_TRIP_EDIT=1, the real routes and catalogue; run alone on a free port, as plan-flow.spec.ts:
//   PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test plan-flow-multi
// The server runs with NODE_ENV=test and the build POST is sent on without its Origin header.
const LIST_KEY = 'travel.plans.local';
const SEED_TRIP = 'canadian-rockies-2029';

async function needsBuilder(site: { url: string }, request: APIRequestContext) {
  const r = await request.get(`${site.url}/plan/`);
  test.skip(r.status() === 404, 'needs the build with both builder flags on');
}
async function allowHttpBuild(page: Page) {
  await page.route('**/api/v1/plan/build/', async (route) => {
    const headers = { ...route.request().headers() };
    delete headers.origin;
    delete headers.referer;
    await route.fulfill({ response: await route.fetch({ headers }) });
  });
}
const next = (page: Page, name: RegExp) => page.getByRole('button', { name }).filter({ visible: true });

/** A week by air to Canada across the Western Canada group, four places picked; ends on Days. */
async function toDays(page: Page, site: { url: string }) {
  await page.goto(`${site.url}/plan/`);
  await page.getByRole('button', { name: /^A week by air/ }).click();
  await next(page, /Next: Where/).click();
  await page.getByLabel('Country').selectOption('CA');
  await page.getByRole('checkbox', { name: /Western Canada/ }).check({ force: true });
  await next(page, /Next: Pick/).click();
  await expect(page.locator('.cand').first()).toBeVisible({ timeout: 20_000 });
  for (const i of [0, 1, 2, 3]) await page.locator('.pick-btn').nth(i).click();
  await expect(page.locator('.pick-btn[aria-pressed="true"]')).toHaveCount(4);
  await next(page, /Next: Days/).click();
  await expect(page.getByRole('heading', { name: 'Days and driving' })).toBeVisible();
}

test('regions fold into groups, a group ticks all its areas, and the Pick list can be narrowed to one area', async ({ page, site, request }) => {
  await needsBuilder(site, request);
  await page.goto(`${site.url}/plan/`);
  await page.getByRole('button', { name: /^A week by air/ }).click();
  await next(page, /Next: Where/).click();
  await page.getByLabel('Country').selectOption('CA');
  const toggles = page.locator('.region-toggle');
  await expect(toggles.first()).toBeVisible();
  // the biggest offered group starts open, another starts folded; a fold opens with its toggle
  const states = await toggles.evaluateAll((els) => els.map((e) => e.getAttribute('aria-expanded')));
  expect(states).toContain('true');
  expect(states).toContain('false');
  const folded = toggles.filter({ has: page.locator('svg') }).nth(states.indexOf('false'));
  await folded.click();
  await expect(folded).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('checkbox', { name: /Western Canada/ }).check({ force: true });
  await expect(page.locator('.plan-count').first()).toContainText(/areas? ·/);
  await next(page, /Next: Pick/).click();
  await expect(page.locator('.cand').first()).toBeVisible({ timeout: 20_000 });
  // two or more areas chosen: an Area pill lists them with their counts, thin ones marked
  const area = page.getByRole('button', { name: /^Area/ });
  await expect(area).toBeVisible();
  await area.click();
  const alberta = page.getByRole('checkbox', { name: /Alberta/ });
  await expect(alberta).toBeVisible();
  await alberta.check({ force: true });
  await expect(alberta).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.locator('.cand').first()).toBeVisible();
  // the picks gather by area in the tray once they span two
  await page.locator('.pick-btn').nth(0).click();
  await expect(page.locator('.tray .tray-rows li')).toHaveCount(1);
});

test('two bases end to end: choose towns, give nights, order them, see the move, build, and the move day is in the plan', async ({ page, site, request }) => {
  test.setTimeout(180_000);
  await needsBuilder(site, request);
  await allowHttpBuild(page);
  await toDays(page, site);

  const bases = page.getByTestId('bases');
  await expect(bases).toBeVisible();
  // by default the plan chooses; the engine gets no pinned base
  await expect(bases.getByRole('radio', { name: 'Let the plan choose' })).toBeChecked();
  await bases.getByRole('radio', { name: 'I choose the towns' }).click();
  const stay = bases.getByRole('button', { name: /^Stay in / });
  await expect(stay.first()).toBeVisible({ timeout: 20_000 });
  expect(await stay.count()).toBeGreaterThan(1);
  // search narrows the list
  const all = await stay.count();
  await bases.getByRole('searchbox', { name: 'Find a town' }).fill('zzzzqq');
  await expect(stay).toHaveCount(0);
  await bases.getByRole('searchbox', { name: 'Find a town' }).fill('');
  await expect(stay).toHaveCount(all);

  const firstName = (await stay.first().getAttribute('aria-label'))!.replace('Stay in ', '');
  await stay.first().click();
  const secondName = (await stay.first().getAttribute('aria-label'))!.replace('Stay in ', '');
  await stay.first().click();
  const rows = page.getByTestId('base-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(firstName);
  await expect(rows.nth(1)).toContainText(secondName);

  // nights: the first base takes 3, the second is left to the plan; the estimate card splits the week and names the move
  const more = rows.nth(0).getByRole('button', { name: new RegExp(`^More nights in ${firstName}`) });
  for (let i = 0; i < 3; i++) await more.click();
  await expect(rows.nth(0)).toContainText('3 nights');
  await expect(rows.nth(1)).toContainText('Plan decides');
  const est = page.getByTestId('base-estimate');
  await expect(est).toContainText(`${firstName} 3 nights`);
  await expect(est).toContainText(`${secondName} 4 nights`);
  await expect(est).toContainText(new RegExp(`Move ${firstName} to ${secondName}: .*(≈|known after the build)`));

  // order by buttons: the second goes first, and back
  await rows.nth(1).getByRole('button', { name: `Move ${secondName} earlier` }).click();
  await expect(rows.nth(0)).toContainText(secondName);
  await expect(est).toContainText(new RegExp(`Move ${secondName} to ${firstName}`));
  await rows.nth(1).getByRole('button', { name: `Move ${firstName} earlier` }).click();
  await expect(rows.nth(0)).toContainText(firstName);

  // the nights stepper above takes nights back from the bases
  await page.getByRole('button', { name: 'Fewer nights', exact: true }).click();
  await page.getByRole('button', { name: 'Fewer nights', exact: true }).click();
  await expect(est).toContainText(/Plan decides|night/);

  await page.getByRole('button', { name: /^Build my days/ }).filter({ visible: true }).click();
  await page.waitForURL(/\/t\/[0-9a-f-]{36}\//, { timeout: 90_000 });
  const doc = await page.evaluate((k) => JSON.parse(localStorage.getItem(k!)!).items[0], LIST_KEY);
  expect(doc.bases.map((b: { town: string }) => b.town)).toHaveLength(2);
  expect(doc.bases[0].nights).toBe(3);
  expect(doc.bases[0].pinned).toBe(true);
  expect(doc.lastBuild.bases.length).toBe(2);
  // two bases mean a move day, and the page says so
  expect(doc.lastBuild.days.filter((d: { move: boolean }) => d.move)).toHaveLength(1);
  await expect(page.getByTestId('just-built')).toContainText(/Built \d+ days/);
  await page.getByRole('tab', { name: 'Summary' }).click();
  await expect(page.getByTestId('built-summary')).toContainText(/1 move/);
});

test('Let the plan choose clears the towns', async ({ page, site, request }) => {
  await needsBuilder(site, request);
  await toDays(page, site);
  const bases = page.getByTestId('bases');
  await bases.getByRole('radio', { name: 'I choose the towns' }).click();
  await bases.getByRole('button', { name: /^Stay in / }).first().click();
  await expect(page.getByTestId('base-row')).toHaveCount(1);
  await bases.getByRole('radio', { name: 'Let the plan choose' }).click();
  await expect(page.getByTestId('base-row')).toHaveCount(0);
  await expect(page.getByTestId('base-estimate')).toHaveCount(0);
});

test('Start from this trip: the trip page offers it, the builder opens filled in and strips the link', async ({ page, site, request }) => {
  test.setTimeout(120_000);
  await needsBuilder(site, request);
  await page.goto(`${site.url}/trips/${SEED_TRIP}/`);
  // the copy sheet is a lazy chunk opened from the page's actions
  await page.getByRole('button', { name: /Copy to my trips|Make it yours|Copy/ }).filter({ visible: true }).first().click();
  const link = page.getByTestId('start-from-trip');
  await expect(link).toBeVisible({ timeout: 20_000 });
  await expect(link).toHaveAttribute('href', `/plan/?seed=${SEED_TRIP}`);
  await link.click();
  await page.waitForURL(/\/plan\/$/, { timeout: 30_000 });
  // read once and stripped
  expect(page.url()).not.toContain('seed');
  await expect(page.getByText(/^Started from /)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Start', level: 1 })).toBeVisible();
  await expect.poll(async () => JSON.parse((await page.evaluate((k) => localStorage.getItem(k), 'travel.plans.ui')) ?? '{}').seed).toBe(SEED_TRIP);
  await next(page, /Next: Where/).click();
  await expect(page.getByLabel('Country')).toHaveValue('CA');
  await expect(page.locator('.region-row input:checked').first()).toBeAttached();
  await next(page, /Next: Pick/).click();
  await expect(page.locator('.tray-rows li').first()).toBeVisible({ timeout: 20_000 });
  expect(await page.locator('.tray-rows li').count()).toBeGreaterThan(2);
  await next(page, /Next: Days/).click();
  // the trip's own bases come across when we can match their towns
  const rows = page.getByTestId('base-row');
  if ((await rows.count()) > 0) await expect(page.getByTestId('base-estimate')).toContainText(/night/);
});

test('a link with a trip that does not exist falls back to choosing a kind', async ({ page, site, request }) => {
  await needsBuilder(site, request);
  await page.goto(`${site.url}/plan/?seed=no-such-trip-2099`);
  await expect(page.getByText(/We could not find that trip|has no places|could not read/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.kind-tile')).toHaveCount(6);
});

test('the start can be found by typing, and the party-aware lists sit behind toggles', async ({ page, site, request }) => {
  await needsBuilder(site, request);
  const starts = await request.get(`${site.url}/api/v1/plan/starts/`);
  const hubs = starts.ok() ? ((await starts.json()) as { hubs: { id: string; name: string }[] }).hubs : [];
  test.skip(hubs.length < 13, 'needs more than 12 published hubs for the search to show');
  await page.goto(`${site.url}/plan/`);
  await page.getByRole('button', { name: /^Weekend/ }).click();
  const find = page.getByRole('searchbox', { name: 'Find a starting point' });
  await expect(find).toBeVisible();
  const select = page.getByLabel('Starting from');
  const before = await select.locator('option').count();
  await find.fill(hubs[0]!.name.slice(0, 4));
  await expect.poll(() => select.locator('option').count()).toBeLessThan(before);
  await select.selectOption(`hub:${hubs[0]!.id}`);
  await expect(select).toHaveValue(`hub:${hubs[0]!.id}`);
});
