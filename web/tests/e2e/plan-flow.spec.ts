import { expect, test } from './fixtures';

// TB-W1: the trip builder's stages 0 to 4 and Build my days, on the production build with NEXT_PUBLIC_PLAN_BUILDER=1 and
// NEXT_PUBLIC_TRIP_EDIT=1 (the real routes, the real public catalogue). Run alone on a free port:
//   PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test plan-flow
// The server must run with NODE_ENV=test: a production server fails a build closed (`plan_paused`) without the quota store and its secret, which this
// run has not. With either flag off /plan/ answers 404 and every test skips. A start needs a public hub: without data/reference/hubs.json the flow
// shows its "cannot plan from a starting point yet" state, which the first test pins; the walk tests skip then.
const LIST_KEY = 'travel.plans.local';
const UI_KEY = 'travel.plans.ui';

async function needsBuilder(site: { url: string }, request: import('@playwright/test').APIRequestContext) {
  const r = await request.get(`${site.url}/plan/`);
  test.skip(r.status() === 404, 'needs the build with both builder flags on');
}
/**
 * The build route accepts a browser's POST only from an https origin when NODE_ENV is production (lib/server/same-origin.ts), and the e2e
 * server is plain http. The real route still answers: the browser's request is sent on without its Origin header (a server-to-server call,
 * which the guard allows), so the engine, the catalogue and the contract checks all run for real.
 */
async function allowHttpBuild(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/plan/build/', async (route) => {
    const headers = { ...route.request().headers() };
    delete headers.origin;
    delete headers.referer;
    await route.fulfill({ response: await route.fetch({ headers }) });
  });
}
async function hubs(site: { url: string }, request: import('@playwright/test').APIRequestContext): Promise<{ id: string; name: string }[]> {
  const r = await request.get(`${site.url}/api/v1/plan/starts/`);
  return r.ok() ? ((await r.json()) as { hubs: { id: string; name: string }[] }).hubs : [];
}

test('stage 0 shows six kind tiles and nothing is marked on a first visit', async ({ page, site, request }) => {
  await needsBuilder(site, request);
  await page.goto(`${site.url}/plan/`);
  await expect(page.getByRole('heading', { name: 'What kind of trip?', level: 2 })).toBeVisible();
  const tiles = page.locator('.kind-tile');
  await expect(tiles).toHaveCount(6);
  await expect(page.locator('.kind-tile[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^A week by air/ })).toContainText('fly somewhere');
  await expect(page.getByRole('button', { name: /^Weekend/ })).toContainText('by car');
});

test('without a published start a car trip says so and cannot go on; a trip by air can', async ({ page, site, request }) => {
  await needsBuilder(site, request);
  test.skip((await hubs(site, request)).length > 0, 'hubs are published here');
  await page.goto(`${site.url}/plan/`);
  await page.getByRole('button', { name: /^Weekend/ }).click();
  await expect(page.getByText('We cannot plan from a starting point yet')).toBeVisible();
  await expect(page.getByRole('button', { name: /Next: Pick/ }).filter({ visible: true })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Plan a trip by air instead' }).click();
  await expect(page.getByRole('button', { name: /Next: Where/ }).filter({ visible: true })).not.toHaveAttribute('aria-disabled', 'true');
});

test('the air flow: country, areas, picks, days, then Build my days hands the trip to its page', async ({ page, site, request }) => {
  test.setTimeout(120_000);
  await needsBuilder(site, request);
  await allowHttpBuild(page);
  const seen: string[] = [];
  page.on('request', (r) => seen.push(r.url()));
  await page.goto(`${site.url}/plan/`);
  await page.getByRole('button', { name: /^A week by air/ }).click();
  await expect(page.getByText('Flying from')).toBeVisible();
  await page.getByRole('button', { name: /Next: Where/ }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Where', level: 1 })).toBeVisible();
  // Next is off until a country and an area are chosen, and says why
  await expect(page.getByRole('button', { name: /Next: Pick/ }).filter({ visible: true })).toHaveAttribute('aria-disabled', 'true');
  await page.getByLabel('Country').selectOption('CA');
  const first = page.locator('.region-row input[type="checkbox"]:not([disabled])').first();
  await first.check({ force: true });
  await page.getByRole('button', { name: /Next: Pick/ }).filter({ visible: true }).click();
  await expect(page.locator('.cand').first()).toBeVisible({ timeout: 20_000 });
  await page.locator('.pick-btn').nth(0).click();
  await page.locator('.pick-btn').nth(1).click();
  await expect(page.locator('.pick-btn[aria-pressed="true"]')).toHaveCount(2);

  // leaving and coming back keeps the draft on this device (the pause before autosave is flushed when the page is left)
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pick', level: 1 })).toBeVisible();
  await expect(page.locator('.pick-btn[aria-pressed="true"]')).toHaveCount(2, { timeout: 20_000 });
  const list = await page.evaluate((k) => localStorage.getItem(k), LIST_KEY);
  expect(JSON.parse(list!).items).toHaveLength(1);
  expect(list).not.toMatch(/adults|children|walkKm|10\.5|-140\.5/);

  await page.getByRole('button', { name: /Next: Days/ }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Days and driving' })).toBeVisible();
  await expect(page.getByText(/need about/)).toBeVisible();
  await page.getByRole('button', { name: 'More nights' }).click();
  await page.getByRole('button', { name: /^Build my days/ }).filter({ visible: true }).click();
  await page.waitForURL(/\/t\/[0-9a-f-]{36}\/\?edit=1/, { timeout: 60_000 });

  // the hand-off: a built document in the device list, the screen state cleared, no household data in any address
  const after = await page.evaluate(([l, u]) => ({ list: localStorage.getItem(l!), ui: localStorage.getItem(u!) }), [LIST_KEY, UI_KEY]);
  const doc = JSON.parse(after.list!).items[0];
  expect(doc.lastBuild.days.length).toBeGreaterThan(0);
  // RB-004: the document keeps the party the build used, as an age snapshot on this device; it is in no request address
  expect(doc.party).toBe('trip');
  expect(doc.travellers).toEqual({ adults: 2, children: [] });
  expect(after.ui).toBeNull();
  for (const u of seen) expect(u).not.toMatch(/adults|children|walkKm|10\.5|-140\.5/);
});

test('a car weekend walks all the stages when a start is published', async ({ page, site, request }) => {
  test.setTimeout(120_000);
  await needsBuilder(site, request);
  const list = await hubs(site, request);
  test.skip(list.length === 0, 'needs a published hub');
  // RB-010: the start and the party band never ride in an address; the candidates go as a no-store POST body
  const seen: string[] = [];
  const answers: string[] = [];
  page.on('request', (r) => seen.push(r.url()));
  page.on('response', (r) => {
    if (r.request().method() === 'POST' && r.url().includes('/api/v1/plan/candidates')) answers.push(r.headers()['cache-control'] ?? '');
  });
  const hub = list.find((h) => h.id === 'calgary') ?? list[0]!;
  await page.goto(`${site.url}/plan/`);
  await page.getByRole('button', { name: /^Weekend/ }).click();
  await page.getByLabel('Starting from').selectOption(`hub:${hub.id}`);
  // RB-028: the month chip is one control, the native menu
  await page.getByLabel('Month').selectOption('7');
  await expect(page.locator('.plan-chip-select')).toContainText('July');
  await page.getByRole('button', { name: /Next: Pick/ }).filter({ visible: true }).click();
  await expect(page.locator('.cand').first()).toBeVisible({ timeout: 20_000 });
  await page.locator('.pick-btn').nth(0).click();
  await page.getByRole('button', { name: /Next: Days/ }).filter({ visible: true }).click();
  await expect(page.getByRole('button', { name: 'Fewer nights' })).toBeVisible();
  // Moves and day-out driving are not asked for a weekend (S1)
  await expect(page.getByText('Moves', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Driving on a day out/)).toHaveCount(0);

  expect(answers.length).toBeGreaterThan(0);
  for (const c of answers) expect(c).toBe('no-store');
  const startRe = new RegExp(`from=|hub(:|%3A)${hub.id}\\b|[?&]p=|family-\\d|adults|children|10\\.5|-140\\.5`);
  for (const u of seen) expect(u, u).not.toMatch(startRe);
  // and no storage key names them (values may hold the draft's own start reference, which stays on this device)
  const keys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
  for (const k of keys) expect(k).not.toMatch(new RegExp(`${hub.id}|family-|hub:`));
});

for (const phone of [false, true]) {
test(`the ${phone ? 'phone shows the step header and its count' : 'desktop step rail names the stages'}`, async ({ page, site, request }) => {
  await needsBuilder(site, request);
  await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await page.goto(`${site.url}/plan/`);
  await page.getByRole('button', { name: /^A week by air/ }).click();
  if (phone) {
    await expect(page.locator('.step-header')).toBeVisible();
    await expect(page.locator('.step-count')).toContainText('1 of 4');
    await expect(page.locator('.site-header')).toBeHidden();
  } else {
    await expect(page.getByRole('navigation', { name: 'Steps' })).toContainText('Where');
    await expect(page.locator('.step-rail [aria-current="step"]')).toContainText('Start');
  }
});
}
