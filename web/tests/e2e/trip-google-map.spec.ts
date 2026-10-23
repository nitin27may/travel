import { execFile } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { FAKE_GOOGLE_JS } from './fake-google-page';
import { expect, startNext, test, type Server } from './fixtures';

// Builds the site once with a FAKE key and Map ID, so the trip route map is the Google family, and serves a stand-in for the Maps script (fake-google-page.ts).
// The real Google map is looked at by hand with the owner's key (screenshots); this spec holds what the page does with whatever map it is given.
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = '.fixture-trip-google';
const ROCKIES = '/trips/canadian-rockies-2029/';
const MAPS = /maps\.googleapis\.com\/maps\/api\/js/;

interface Fg { maps: number; markerCreates: number; polylineCreates: number; calls: unknown[][]; mapOpts: Record<string, unknown> }
const fg = (page: Page) => page.evaluate(() => (window as unknown as { __fg: Fg }).__fg);

async function withFake(page: Page, requests?: string[]) {
  await page.route(MAPS, (route) => {
    requests?.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_GOOGLE_JS });
  });
}
const ready = (page: Page) => expect(page.locator('[data-trip-map][data-phase="ready"]')).toBeVisible({ timeout: 20_000 });

test.describe('trip route map on the google-js family with a fake key and Map ID', () => {
  test.setTimeout(600_000);
  let server: Server;
  const errors: string[] = [];

  test.beforeAll(async () => {
    // PW_REUSE_FIXTURE=1 reuses the last fixture build (repeat runs of unchanged code); a normal run always builds fresh
    if (process.env.PW_REUSE_FIXTURE === '1' && existsSync(path.join(WEB, DIST, 'BUILD_ID'))) {
      server = await startNext(DIST);
      return;
    }
    rmSync(path.join(WEB, DIST), { recursive: true, force: true });
    const status = await new Promise<{ code: number | null; err: string }>((resolve) => {
      const child = execFile(process.execPath, [path.join(WEB, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
        cwd: WEB,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, NEXT_DIST_DIR: DIST, NEXT_PUBLIC_GOOGLE_MAPS_KEY: 'fake-key-for-tests', NEXT_PUBLIC_GOOGLE_MAP_ID: 'fake-map-id', NEXT_PUBLIC_TRIP_MAP_FAMILY: '', HUB_TODAY: '2026-10-17' },
      }, (_e, _out, err) => resolve({ code: child.exitCode, err: String(err).slice(-800) }));
    });
    expect(status.code, status.err).toBe(0);
    server = await startNext(DIST);
  });
  test.afterAll(() => server?.stop());
  test.beforeEach(({ page }) => {
    errors.length = 0;
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  });
  test.afterEach(() => expect(errors).toEqual([]));

  test('one family, our Map ID and the options of the note; the script is requested once with the key', async ({ page }) => {
    const reqs: string[] = [];
    await withFake(page, reqs);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    expect(await page.locator('[data-map-family]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-map-family')))])).toEqual(['google-js']);
    expect(await page.locator('.maplibregl-canvas').count()).toBe(0);
    expect(reqs).toHaveLength(1);
    expect(new URL(reqs[0]!).searchParams.get('key')).toBe('fake-key-for-tests');
    const o = (await fg(page)).mapOpts;
    expect(o).toMatchObject({ mapId: 'fake-map-id', disableDefaultUI: true, clickableIcons: false, gestureHandling: 'cooperative', keyboardShortcuts: true });
    expect(['LIGHT', 'DARK']).toContain(o.colorScheme);
    expect(o.mapId).not.toBe('DEMO_MAP_ID');
  });

  test('the pins are the numbered rows of the day, the key says what is drawn, and the label counts agree', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    await expect(page.locator('.tl-mapcol-label')).toContainText('Day 8');
    const nums = await page.locator('#day-8 .tl-badge').evaluateAll((els) => [...new Set(els.map((e) => e.textContent))]);
    expect(nums).toEqual(['1', '2']);
    await expect(page.locator('.tp[data-numbered]')).toHaveCount(nums.length);
    await expect(page.locator('.tl-mapcol-label')).toContainText(`${nums.length} stops on the map`);
    await expect(page.locator('#day-8 .tl-nomap')).toHaveCount(1);
    await expect(page.locator('.tl-mapcol-label').getByRole('button', { name: '1 not on the map' })).toBeVisible();
    // no pin for the Icefields Parkway, a road
    expect(await page.locator('[data-fake-marker]').evaluateAll((els) => els.map((e) => (e as HTMLElement).title))).not.toContain('Icefields Parkway (Hwy 93N) scenic drive');
    const key = page.locator('.trip-map-key');
    await expect(key).toContainText('Straight line, not a route');
    await expect(key).toContainText("Road routes are not drawn yet. Lines join each day's stops in order; use Directions for the drive.");
    await expect(key).not.toContainText(/Road route(?!s)/);
    // every leg is a dashed estimate: no amber and no solid line
    const lines = await page.evaluate(() => (window as unknown as { __fg: { polylines: { o: { strokeOpacity?: number; strokeColor?: string; icons?: unknown[] } }[] } }).__fg.polylines.map((p) => ({ op: p.o.strokeOpacity, icons: p.o.icons?.length ?? 0 })));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).toEqual({ op: 0, icons: 1 });
    const dir = page.getByRole('link', { name: /Directions for Day 8/ });
    const href = (await dir.getAttribute('href'))!;
    expect(href).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?/);
    expect(href).toMatch(/origin=\d+\.\d{5},-\d+\.\d{5}/);
    expect(href).toMatch(/destination=/);
  });

  test('"not on the map" lists the stop names outside the canvas and a name leads to its row', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    await page.locator('.tl-mapcol-label').getByRole('button', { name: '1 not on the map' }).click();
    const list = page.locator('#tl-nomap-list');
    await expect(list).toContainText('Toe of Athabasca Glacier');
    expect(await list.evaluate((el) => !!el.closest('[data-trip-map]'))).toBe(false);
    await list.getByRole('button').first().click();
    await expect(page.locator('#day-8 [data-flash]')).toHaveCount(1);
  });

  test('hover links the row and the pin both ways without redrawing; a click scrolls, flashes and focuses but does not expand', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    const before = await fg(page);
    const row = page.locator('#day-8 li.tl-entry[data-pin]').nth(1);
    const pin = await row.getAttribute('data-pin');
    await row.hover();
    await expect(page.locator(`.tp-hit[data-ring][data-pin="${pin}"]`)).toHaveCount(1);
    await page.mouse.move(5, 5);
    await expect(page.locator('.tp-hit[data-ring]')).toHaveCount(0);
    // the pin to the row
    await page.locator(`.tp-hit[data-pin="${pin}"] .tp`).hover();
    await expect(row).toHaveAttribute('data-hover', '');
    await expect(row.locator('.tl-badge')).toBeVisible();
    const after = await fg(page);
    expect(after.markerCreates).toBe(before.markerCreates);
    expect(after.polylineCreates).toBe(before.polylineCreates);
    // click
    await page.locator(`.tp-hit[data-pin="${pin}"] .tp`).click();
    await expect(row).toHaveAttribute('data-flash', '');
    await expect(row.locator('.tl-title a, .tl-title:not(:has(a))').first()).toBeFocused();
    await expect(row.locator('.tl-why')).toHaveCount(0);
    await expect(row.locator('.tl-more')).toHaveAttribute('aria-expanded', 'false');
  });

  test('the picked day\'s pins are the only tab stops, in number order, and Enter equals a click', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    const stops = await page.locator('[data-fake-marker][data-clickable]').evaluateAll((els) => els.map((e) => e.querySelector('.tp')?.textContent));
    expect(stops).toEqual(['1', '2']);
    await page.locator('[data-fake-marker][data-clickable]').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#day-8 [data-flash]')).toHaveCount(1);
  });

  test('a day change redraws overlays on the same map; scrolling to day 9 relabels and refits', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    const a = await fg(page);
    await page.evaluate(() => document.getElementById('day-9')!.scrollIntoView());
    await expect(page.locator('.tl-mapcol-label')).toContainText('Day 9', { timeout: 10_000 });
    const b = await fg(page);
    expect(b.maps).toBe(1);
    expect(b.calls.filter((c) => c[0] === 'fitBounds').length).toBeGreaterThan(a.calls.filter((c) => c[0] === 'fitBounds').length);
    // padding and the note's wide-map value
    const fit = b.calls.filter((c) => c[0] === 'fitBounds').at(-1)!;
    expect(fit[2]).toEqual({ top: 56, right: 176, bottom: 48, left: 48 });
  });

  test('All days pauses, draws dots for every stop and no numbers; Fit is on the map', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    await page.getByRole('radio', { name: 'All days' }).click();
    await expect(page.locator('.tl-mapcol-label')).toContainText('Paused');
    await expect(page.locator('.tp[data-numbered]')).toHaveCount(0);
    expect(await page.locator('.tp-dot').count()).toBeGreaterThan(5);
    await expect(page.getByText('Pick a day for directions')).toBeVisible();
  });

  test('the Google logo strip is on screen: the column is fitted to the window at 1440 x 900 and 1024 x 768', async ({ page }) => {
    await withFake(page);
    for (const [w, h] of [[1440, 900], [1024, 768]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`${server.url}${ROCKIES}#day-8`);
      await ready(page);
      await page.waitForTimeout(500);
      const box = (await page.locator('.tl-mapcol .tl-mapbox').boundingBox())!;
      expect(box.y + box.height, `${w}x${h}`).toBeLessThanOrEqual(h);
      const col = (await page.locator('.tl-mapcol').boundingBox())!;
      expect(col.y + col.height, `${w}x${h}`).toBeLessThanOrEqual(h);
      expect(box.height).toBeGreaterThanOrEqual(320);
    }
  });

  test('a theme change makes a new map in the other scheme', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    const first = (await fg(page)).mapOpts.colorScheme;
    await page.getByRole('button', { name: /dark|light|theme/i }).first().click();
    await expect.poll(async () => (await fg(page)).maps).toBe(2);
    expect((await fg(page)).mapOpts.colorScheme).not.toBe(first);
    // the page may have moved a little while the theme changed: look at day 8 again
    await page.evaluate(() => document.getElementById('day-8')!.scrollIntoView());
    await expect(page.locator('.tp[data-numbered]')).toHaveCount(2);
  });

  test('reduced motion: the camera jumps with moveCamera, never an animated fit', async ({ page }) => {
    await withFake(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    await page.evaluate(() => document.getElementById('day-9')!.scrollIntoView());
    await expect(page.locator('.tl-mapcol-label')).toContainText('Day 9', { timeout: 10_000 });
    const c = (await fg(page)).calls;
    expect(c.some((x) => x[0] === 'moveCamera')).toBe(true);
    expect(c.some((x) => x[0] === 'fitBounds')).toBe(false);
  });

  test('phone: nothing loads until the Map button opens the sheet; the page keeps scrolling; Esc closes and returns focus', async ({ page }) => {
    const reqs: string[] = [];
    await withFake(page, reqs);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await page.waitForTimeout(2500);
    expect(reqs).toHaveLength(0);
    const btn = page.locator('.tl-planbar .tl-mapbtn');
    await btn.click();
    await ready(page);
    expect(reqs).toHaveLength(1);
    await expect(page.locator('#route')).toBeVisible();
    await expect(page.locator('.tl-mapcol-label')).toBeFocused();
    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.move(195, 150);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
    await page.keyboard.press('Escape');
    await expect(page.locator('#route')).toBeHidden();
    await expect(btn).toBeFocused();
    // a number on a row opens the sheet and rings the pin
    await page.locator('#day-8 .tl-badge').first().scrollIntoViewIfNeeded();
    await page.locator('#day-8 .tl-badge').first().click();
    await expect(page.locator('#route')).toBeVisible();
    await expect(page.locator('.tp-hit[data-ring]')).toHaveCount(1);
  });

  test('tablet uses the sheet too, and the Map button shows', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 800, height: 1000 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    const btn = page.locator('.tl-planbar .tl-mapbtn');
    await expect(btn).toBeVisible();
    expect(((await page.locator('#route').boundingBox())?.y ?? 0) >= 0 && (await page.locator('#route').isVisible())).toBe(false);
    await btn.click();
    await ready(page);
    await expect(page.locator('#route')).toBeVisible();
    await page.getByRole('button', { name: 'Close map' }).click();
    await expect(btn).toBeFocused();
  });

  test('a refused script shows the failure with Try again, and Directions still works', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await expect(page.getByRole('alert').filter({ hasText: 'The map could not load. Every stop is in the day list, and Directions still works.' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Directions for Day 8/ })).toBeVisible();
  });

  test('a Map ID without Advanced Markers says our pins cannot be drawn', async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { __fgNoMarkers: boolean }).__fgNoMarkers = true; });
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await expect(page.getByRole('alert').filter({ hasText: 'Our pins cannot be drawn on this map' })).toBeVisible({ timeout: 20_000 });
  });

  test('Save-Data shows the stops as text with a "Load the map" button and requests nothing until it is pressed', async ({ page }) => {
    const reqs: string[] = [];
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }));
    await withFake(page, reqs);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    const facade = page.locator('[data-trip-facade]');
    await expect(facade).toBeVisible({ timeout: 15_000 });
    await expect(facade).toContainText('Athabasca Falls');
    await expect(page.getByRole('link', { name: /Directions for Day 8/ })).toBeVisible();
    expect(reqs).toHaveLength(0);
    await facade.getByRole('button', { name: 'Load the map' }).click();
    await ready(page);
    expect(reqs).toHaveLength(1);
  });
});
