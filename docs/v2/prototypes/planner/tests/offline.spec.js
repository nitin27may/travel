const { test, expect, watch, open } = require('./helpers.js');

test('a service worker caches the planner shell and the open trip; Today loads offline and the badge follows navigator.onLine', async ({ page, context, base }) => {
  const errors = watch(page);
  await open(page, base, '/planner/today.html?id=t-dolomites&day=2');
  await expect(page.locator('#net-badge')).toHaveAttribute('data-online', 'true');
  await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active); });
  // reload once so the worker controls the page, then wait for the shell and the trip copy to be cached
  await page.reload();
  await page.waitForFunction(async () => {
    const shell = await caches.open('planner-shell-v1'), trips = await caches.open('planner-trips-v1');
    return !!(await shell.match('/planner/today.html')) && !!(await shell.match('/shared/engine.js')) && !!(await trips.match('/planner/__trip/t-dolomites.json'));
  }, null, { timeout: 15000 });
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  await expect(page.locator('#net-badge')).toHaveAttribute('data-online', 'false');
  await expect(page.locator('#net-badge')).toContainText('Offline');
  await expect(page.locator('#net')).toBeVisible();
  await expect(page.locator('#day-map [data-pin]').first()).toBeVisible(); // the map script came from the cache
  await expect(page.locator('[data-sun=rise]')).toBeVisible();

  await context.setOffline(false);
  await expect(page.locator('#net-badge')).toHaveAttribute('data-online', 'true');
  expect(errors().filter((e) => !/Failed to load resource|net::ERR/.test(e))).toEqual([]);
});

test('offline, the trip home and My trips load from the cache too', async ({ page, context, base }) => {
  await open(page, base, '/planner/trip.html?id=t-banff');
  await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active); });
  await page.reload();
  await page.goto(base + '/planner/index.html');
  await page.waitForFunction(async () => (await (await caches.open('planner-shell-v1')).keys()).length > 15, null, { timeout: 15000 });
  await context.setOffline(true);
  await page.goto(base + '/planner/trip.html?id=t-banff');
  await expect(page.getByRole('textbox', { name: /Trip name/ })).toHaveValue('Banff long weekend');
  await page.goto(base + '/planner/index.html');
  await expect(page.getByRole('heading', { name: 'My trips', level: 1 })).toBeVisible();
  await context.setOffline(false);
});

test('the open trip is restored from the worker copy when the browser lost it', async ({ page, base }) => {
  await open(page, base, '/planner/today.html?id=t-dolomites');
  await page.waitForFunction(async () => { const c = await caches.open('planner-trips-v1'); return !!(await c.match('/planner/__trip/t-dolomites.json')); }, null, { timeout: 15000 });
  await page.evaluate(() => { localStorage.setItem('proto.planner', JSON.stringify({ noSeed: true })); localStorage.setItem('proto.trips', '[]'); });
  await page.goto(base + '/planner/today.html?id=t-dolomites');
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible({ timeout: 10000 });
});
