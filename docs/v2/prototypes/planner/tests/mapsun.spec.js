const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { test, expect, watch, open, trips } = require('./helpers.js');
const ROOT = path.resolve(__dirname, '../../../../..');

test('Overview draws the route with shared/map.js: a pin per located stop, day colours, tap opens the stop', async ({ page, base }) => {
  const errors = watch(page);
  await open(page, base, '/planner/trip.html?id=t-dolomites');
  const t = (await trips(page)).find((x) => x.id === 't-dolomites');
  const stops = t.days.flatMap((d) => d.items).length;
  await expect(page.locator('#route-map svg')).toBeVisible();
  expect(await page.locator('#route-map [data-pin]').count()).toBe(stops);
  const first = page.locator('#route-map [data-pin]').first();
  const label = await first.getAttribute('aria-label');
  expect(label).toMatch(/^Day 1, stop 1: /);
  await first.click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText(label.replace(/^Day 1, stop 1: /, ''));
  await dlg.getByRole('button', { name: 'Show in itinerary' }).click();
  await expect(page.getByRole('tab', { name: 'Itinerary' })).toHaveAttribute('aria-selected', 'true');
  expect(errors()).toEqual([]);
});

test('map pins can be opened with the keyboard', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-algonquin');
  await page.locator('#route-map [data-pin]').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('Today shows sun times from shared/sun.js that match core/bin/sun.ts for the base', async ({ page, base }) => {
  await open(page, base, '/planner/today.html?id=t-dolomites&day=1');
  await expect(page.locator('[data-sun=rise]')).toContainText('05:32');
  await expect(page.locator('[data-sun=set]')).toContainText('21:06');
  const core = JSON.parse(execFileSync('node', ['core/bin/sun.ts', '--lat', '46.575', '--lon', '11.671', '--zone', 'Europe/Rome', '--date', '2027-07-13', '--json'], { cwd: ROOT }).toString())[0];
  expect(core.sunrise).toBe('05:32');
  expect(core.sunset).toBe('21:06');
  await expect(page.locator('#day-map [data-pin]').first()).toBeVisible();
});

test('Today in Canada uses the right zone and a Reykjavik-style negative longitude is not flipped', async ({ page, base }) => {
  await open(page, base, '/planner/today.html?id=t-banff&day=1');
  const r = await page.evaluate(() => {
    const t = window.P.get('t-banff'), d = t.days[0], s = window.P.sunFor(t, d);
    const rey = window.ProtoSun.sunFor(64.15, -21.94, '2027-06-21', 'Atlantic/Reykjavik');
    return { lat: s.lat, lon: s.lon, zone: s.zone, rise: s.sunrise, set: s.sunset, iso: s.iso, rey };
  });
  expect(r.zone).toBe('America/Edmonton');
  expect(r.iso).toBe('2026-09-04');
  const core = JSON.parse(execFileSync('node', ['core/bin/sun.ts', '--lat', String(r.lat), '--lon', String(r.lon), '--zone', 'America/Edmonton', '--date', '2026-09-04', '--json'], { cwd: ROOT }).toString())[0];
  expect(r.rise).toBe(core.sunrise);
  expect(r.set).toBe(core.sunset);
  const rey = JSON.parse(execFileSync('node', ['core/bin/sun.ts', '--lat', '64.15', '--lon', '-21.94', '--zone', 'Atlantic/Reykjavik', '--date', '2027-06-21', '--json'], { cwd: ROOT }).toString())[0];
  expect(r.rey.sunrise).toBe(rey.sunrise);
});

test('a stop that ends after sunset minus 30 minutes is flagged on Today; weather stays a labelled placeholder', async ({ page, base }) => {
  await open(page, base, '/planner/today.html?id=t-algonquin&day=1');
  await page.evaluate(() => {
    const a = window.P.trips();
    a[0].days[0].items[0].time = '16:30'; a[0].days[0].items[0].durMin = 120;
    window.P.save(a);
  });
  await page.reload();
  await expect(page.getByText('Ends after sunset').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Weather/ })).toContainText('Placeholder');
});
