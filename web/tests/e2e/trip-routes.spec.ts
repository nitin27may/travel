import { execFile } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { FAKE_GOOGLE_JS } from './fake-google-page';
import { expect, startNext, test, type Server } from './fixtures';

// TRP2b: routed legs on the Google trip map, and Export trip. Built once with a FAKE key and Map ID (as trip-google-map.spec.ts does), so the
// Google family runs against the stand-in Maps script; the legs and the exports are the real ones from the real API.
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = '.fixture-trip-routes';
const ROCKIES = '/trips/canadian-rockies-2029/';
const MAPS = /maps\.googleapis\.com\/maps\/api\/js/;
const LEGS = /\/api\/v1\/trips\/[^/]+\/legs\//;

interface Poly { map?: unknown; o: { map?: unknown; strokeOpacity?: number; strokeColor?: string; strokeWeight?: number; icons?: unknown[] } }
/** The polylines on the map now (a line taken off the map by a day change is not counted). */
const lines = (page: Page) => page.evaluate(() => (window as unknown as { __fg: { polylines: Poly[] } }).__fg.polylines.filter((p) => (p.map === undefined ? p.o.map : p.map)).map((p) => ({ op: p.o.strokeOpacity, weight: p.o.strokeWeight, colour: p.o.strokeColor, icons: p.o.icons?.length ?? 0 })));
/** The Export trip button at the top of the page (the end of the page has one too). */
const top = (page: Page) => page.locator('.trip-cover').getByRole('button', { name: 'Export trip', exact: true });
const ready = (page: Page) => expect(page.locator('[data-trip-map][data-phase="ready"]')).toBeVisible({ timeout: 20_000 });
async function withFake(page: Page) {
  await page.route(MAPS, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_GOOGLE_JS }));
}
/** The real legs answer, changed by `edit`. */
async function legsAs(page: Page, edit: (j: { legs: { geometry: string | null }[] }) => void) {
  await page.route(LEGS, async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    edit(json);
    await route.fulfill({ response: res, json });
  });
}

test.describe('routed legs and Export trip on the Google family (fake key)', () => {
  test.setTimeout(600_000);
  let server: Server;
  const errors: string[] = [];

  test.beforeAll(async () => {
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

  test('a leg with geometry is drawn solid amber over a casing; the key says Road route and the credit chip sits top left', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/v1/trips/')) requests.push(new URL(r.url()).pathname); });
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    await expect(page.locator('.tl-mapcol-label')).toContainText('Day 8');
    // the legs came from their own request, once, and the trip detail was never asked for (D-E5)
    await expect.poll(() => requests.filter((p) => LEGS.test(p)).length).toBe(1);
    expect(requests.filter((p) => !LEGS.test(p))).toEqual([]);
    await expect.poll(async () => (await lines(page)).filter((l) => l.op === 1).length).toBeGreaterThan(0);
    const l = await lines(page);
    const solid = l.filter((x) => x.op === 1 && x.icons === 0);
    expect(solid.map((x) => x.weight).sort()).toEqual([3.5, 5.5]); // amber over its casing, the picked day
    expect(solid.find((x) => x.weight === 3.5)!.colour).not.toBe(solid.find((x) => x.weight === 5.5)!.colour);
    // a route that stops short of its pin gets a dashed stub; whatever is dashed is an estimate, never solid
    for (const x of l.filter((y) => y.op === 0)) expect(x.icons).toBe(1);
    const key = page.locator('.trip-map-key');
    await expect(key).toContainText('Road route');
    await expect(key).not.toContainText('Road routes are not drawn yet');
    const chip = page.getByTestId('route-credit');
    await expect(chip).toHaveText('Route lines © OpenStreetMap contributors');
    await expect(chip.getByRole('link', { name: 'OpenStreetMap contributors' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    await expect(chip).toHaveAttribute('title', /OpenRouteService/);
    const [c, m] = await Promise.all([chip.boundingBox(), page.locator('.tl-mapbox').boundingBox()]);
    expect(c!.x - m!.x).toBeLessThanOrEqual(12);
    expect(c!.y - m!.y).toBeLessThanOrEqual(12);
    await expect(page.getByRole('link', { name: /Directions for Day 8/ })).toBeVisible();
  });

  test('a leg without geometry stays dashed with its label, and with no routed leg the old sentence returns and there is no credit', async ({ page }) => {
    await withFake(page);
    await legsAs(page, (j) => { for (const x of j.legs) x.geometry = null; });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    const key = page.locator('.trip-map-key');
    await expect(key).toContainText('Straight line, not a route');
    await expect(key).toContainText("Road routes are not drawn yet. Lines join each day's stops in order; use Directions for the drive.");
    await expect(key).not.toContainText(/Road route(?!s)/);
    await expect(page.getByTestId('route-credit')).toHaveCount(0);
    const l = await lines(page);
    expect(l.length).toBeGreaterThan(0);
    for (const x of l) expect(x).toMatchObject({ op: 0, icons: 1 });
    await expect(page.getByRole('link', { name: /Directions for Day 8/ })).toBeVisible();
  });

  test('a failed legs request leaves the estimates and no error', async ({ page }) => {
    await withFake(page);
    await page.route(LEGS, (route) => route.fulfill({ status: 500, body: 'no' }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    await expect(page.locator('.trip-map-key')).toContainText('Straight line, not a route');
    await expect(page.getByTestId('route-credit')).toHaveCount(0);
  });

  test('All days with some legs routed and some not: both lines, both key items, and the mixed sentence', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    await page.getByRole('radio', { name: 'All days' }).click();
    const key = page.locator('.trip-map-key');
    await expect(key).toContainText('Road route');
    await expect(key).toContainText('Straight line, not a route');
    await expect(key).toContainText(/car park or trailhead.*on foot, by lift or by boat/);
    await expect(page.getByTestId('route-credit')).toBeVisible();
    const l = await lines(page);
    expect(l.some((x) => x.op === 1)).toBe(true);
    expect(l.some((x) => x.op === 0 && x.icons === 1)).toBe(true);
  });

  test('Export trip: at the page top and in the plan bar; each file downloads and parses; the routed geometry is in the GPX and KML', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    await expect(top(page)).toBeVisible();
    await expect(page.locator('.tl-planbar').getByRole('button', { name: 'Export trip', exact: true })).toBeVisible();
    const open = async (name: RegExp) => {
      await page.locator('.tl-planbar').getByRole('button', { name: 'Export trip', exact: true }).click();
      return Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name }).click()]);
    };
    const parse = (xml: string) => page.evaluate((s) => {
      const d = new DOMParser().parseFromString(s, 'application/xml');
      return { error: !!d.querySelector('parsererror'), trk: [...d.querySelectorAll('trk > name')].filter((n) => /^Day \d+: /.test(n.textContent ?? '')).length, lines: [...d.querySelectorAll('LineString')].length };
    }, xml);

    const [gpx] = await open(/^GPX/);
    expect(gpx.suggestedFilename()).toBe('canadian-rockies-2029.gpx');
    const gpxText = readFileSync((await gpx.path())!, 'utf8');
    const g = await parse(gpxText);
    expect(g.error).toBe(false);
    expect(g.trk).toBeGreaterThan(10);
    expect(gpxText).toContain('OpenRouteService');
    await expect(page.locator('.toast-region')).toContainText(/Downloaded canadian-rockies-2029\.gpx · \d+ points, \d+ road routes/);

    const [kml] = await open(/^KML/);
    const k = await parse(readFileSync((await kml.path())!, 'utf8'));
    expect(k.error).toBe(false);
    expect(k.lines).toBeGreaterThan(10);

    const [csv] = await open(/^CSV/);
    expect(readFileSync((await csv.path())!, 'utf8')).toContain('Day,Time,Name,Kind,Category,Area,Lat,Lon,Approximate,Links');

    for (const text of [gpxText]) expect(text).not.toMatch(/whitby/i);
    await page.locator('.tl-planbar').getByRole('button', { name: 'Export trip', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /^Calendar/ })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Print or save as PDF' })).toBeVisible();
  });

  test('Print renders the print view from the export model, with the times of the page, and removes it afterwards', async ({ page }) => {
    await withFake(page);
    await page.addInitScript(() => {
      (window as unknown as { __printed: unknown[] }).__printed = [];
      window.print = () => {
        const view = document.querySelector('[data-testid="trip-print-view"]');
        (window as unknown as { __printed: unknown[] }).__printed.push({ text: view?.textContent ?? null, on: document.documentElement.hasAttribute('data-print-model'), parent: view?.parentElement?.tagName });
        window.dispatchEvent(new Event('afterprint'));
      };
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    await top(page).click();
    await page.getByRole('menuitem', { name: 'Print or save as PDF' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: unknown[] }).__printed.length)).toBe(1);
    const printed = (await page.evaluate(() => (window as unknown as { __printed: { text: string; on: boolean; parent: string }[] }).__printed))[0]!;
    expect(printed.on).toBe(true);
    expect(printed.parent).toBe('BODY');
    expect(printed.text).toContain('Day 1: ');
    expect(printed.text).toContain('Day 15: ');
    expect(printed.text).toContain('Planned for ');
    expect(printed.text).not.toMatch(/Lane [ABC]/);
    expect(printed.text).toMatch(/\d\d:\d\d · /);
    expect(printed.text).toContain('Source: Trip Plans');
    expect(printed.text).not.toMatch(/whitby/i);
    await expect(page.getByTestId('trip-print-view')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-print-model'))).toBe(false);
  });

  test('on a phone the page-top Export trip is the only one', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await expect(top(page)).toBeVisible();
    await expect(page.locator('.tl-planbar').getByRole('button', { name: 'Export trip', exact: true })).toBeHidden();
  });
});
