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

/** The legs request waits here until `release()`; the real answer is then passed through. */
async function gateLegs(page: Page) {
  let release!: () => void;
  const open = new Promise<void>((r) => { release = r; });
  await page.route(LEGS, async (route) => {
    await open;
    await route.continue().catch(() => undefined);
  });
  return { release };
}
/** Virtual time: the page's timers and frames run only when the test advances the clock, so a hold cannot lapse on a slow machine. */
async function freezeClock(page: Page) {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
}
/** `ready` with a frozen clock: frames and timers need a nudge, so advance in small steps (well inside the 1.2 s hold in total) until the map is ready. */
async function readyFrozen(page: Page) {
  const map = page.locator('[data-trip-map][data-phase="ready"]');
  for (let i = 0; i < 60 && !(await map.isVisible()); i++) { await page.clock.runFor(10); await page.waitForTimeout(50); }
  await expect(map).toBeVisible();
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

  test('SHOULD-3: pins draw at once, the line layer and the key sentence wait for the legs, and the first lines drawn are amber', async ({ page }) => {
    await withFake(page);
    // the legs answer only when the test releases them, and the page's clock is frozen at load: the 1.2 s hold cannot lapse under CPU load
    const gate = await gateLegs(page);
    await freezeClock(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await readyFrozen(page);
    await expect(page.locator('.tp-hit').first()).toBeVisible();
    // virtual time since the freeze (1000): the hold is 1200 ms from the map's mount, so this proves we are inside it, with the request still pending
    expect(await page.evaluate(() => Date.now()) - 1000).toBeLessThan(1200);
    // held: pins, no lines, and a key that makes no claim about lines yet
    expect(await lines(page)).toEqual([]);
    const key = page.locator('.trip-map-key');
    await expect(key).not.toContainText('not drawn yet');
    await expect(key).not.toContainText('Straight line, not a route');
    // settled: the first lines drawn include the solid amber route, never a dashed line that is then replaced by it
    gate.release();
    await expect.poll(async () => { await page.clock.runFor(50); return (await lines(page)).length; }).toBeGreaterThan(0);
    const first = await lines(page);
    expect(first.some((x) => x.op === 1 && x.icons === 0)).toBe(true);
    await expect(key).toContainText('Road route');
    expect(await page.evaluate(() => (window as unknown as { __fg: { polylines: unknown[] } }).__fg.polylines.length)).toBe(first.length);
  });

  test('SHOULD-3: legs later than 1.2 s leave the estimates after the hold, with their sentence, and the amber swaps in without a new map', async ({ page }) => {
    await withFake(page);
    const gate = await gateLegs(page);
    await freezeClock(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await readyFrozen(page);
    expect(await page.evaluate(() => Date.now()) - 1000).toBeLessThan(1200); // still inside the hold
    expect(await lines(page)).toEqual([]);
    await expect(page.locator('.trip-map-key')).not.toContainText('not drawn yet');
    await page.clock.runFor(1250); // past the 1.2 s hold whenever it began, the legs still pending
    await expect(page.locator('.trip-map-key')).toContainText('not drawn yet');
    expect((await lines(page)).length).toBeGreaterThan(0);
    expect((await lines(page)).some((x) => x.op === 1 && x.icons === 0)).toBe(false);
    // the legs arrive late: amber swaps in, on the same map
    gate.release();
    await expect.poll(async () => { await page.clock.runFor(50); return (await lines(page)).some((x) => x.op === 1 && x.icons === 0); }).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __fg: { maps: number } }).__fg.maps)).toBe(1);
  });

  test('SHOULD-4: hovering a stop on a routed day thickens its amber leg (5 px over 7 px), and it goes back on leave', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await ready(page);
    await expect(page.locator('.tl-mapcol-label')).toContainText('Day 8');
    await expect(page.getByTestId('route-credit')).toBeVisible();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const weights = async () => (await lines(page)).filter((x) => x.op === 1 && x.icons === 0).map((x) => x.weight).sort();
    await expect.poll(weights).toEqual([3.5, 5.5]);
    // the second stop's pin: the leg from the first stop runs into it (pin 1 has no leg into it on this day, as there is no base on the map)
    await page.locator('#day-8 li.tl-entry[data-pin]').nth(1).hover();
    await expect.poll(weights).toEqual([5, 7]);
    await page.mouse.move(5, 5);
    await expect.poll(weights).toEqual([3.5, 5.5]);
  });

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
    await page.goto(`${server.url}${ROCKIES}?p=family-6#day-8`);
    await ready(page);
    await expect(top(page)).toBeVisible();
    await expect(page.locator('.tl-planbar').getByRole('button', { name: 'Export trip', exact: true })).toBeVisible();
    const open = async (name: RegExp) => {
      await page.locator('.tl-planbar').getByRole('button', { name: 'Export trip', exact: true }).click();
      return Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name }).click()]);
    };
    const parse = (xml: string) => page.evaluate((s) => {
      const d = new DOMParser().parseFromString(s, 'application/xml');
      return { error: !!d.querySelector('parsererror'), trk: [...d.querySelectorAll('trk > name')].filter((n) => /^Day \d+(, [^:]+)?: /.test(n.textContent ?? '')).length, lines: [...d.querySelectorAll('LineString')].length };
    }, xml);

    // the row says what the file is for and its counts for THIS plan (family-6, Standard): 10 routes, not every version's
    await page.locator('.tl-planbar').getByRole('button', { name: 'Export trip', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /^For a GPS or hiking app \(GPX\): \d+ points, 10 routes$/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /^For Google Earth or My Maps \(KML\): \d+ points, 10 routes$/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /^For a spreadsheet \(CSV\): \d+ stops$/ })).toBeVisible();
    await page.keyboard.press('Escape');
    const [gpx] = await open(/^For a GPS or hiking app/);
    expect(gpx.suggestedFilename()).toBe('canadian-rockies-2029.gpx');
    const gpxText = readFileSync((await gpx.path())!, 'utf8');
    const g = await parse(gpxText);
    expect(g.error).toBe(false);
    expect(g.trk).toBe(10); // exactly the routes the map draws for family-6 (B1, B4): the family's version, each step once
    expect(gpxText).toContain('OpenRouteService');
    expect(gpxText).not.toContain('Paint Pots Walk to Johnston Canyon'); // the drive the family's day never takes
    expect(gpxText).toMatch(/Johnston Canyon to Marble Canyon Walk/);
    await expect(page.locator('.toast-region')).toContainText(/Downloaded canadian-rockies-2029\.gpx · \d+ points, 10 road routes/);

    const [kml] = await open(/^For Google Earth/);
    const k = await parse(readFileSync((await kml.path())!, 'utf8'));
    expect(k.error).toBe(false);
    expect(k.lines).toBe(10);

    const [csv] = await open(/^For a spreadsheet/);
    expect(readFileSync((await csv.path())!, 'utf8')).toContain('Day,Time,Name,Kind,Category,Area,Lat,Lon,Approximate,Links');

    for (const text of [gpxText]) expect(text).not.toMatch(/whitby/i);
    await page.locator('.tl-planbar').getByRole('button', { name: 'Export trip', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /^Calendar/ })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Print or save as PDF' })).toBeVisible();
  });

  test('Export for adults: no route lines is said and is true (the adults\' Rockies days are single hikes)', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}?p=adults#day-8`);
    await ready(page);
    await page.locator('.tl-planbar').getByRole('button', { name: 'Export trip', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /^For a GPS or hiking app \(GPX\): \d+ points, no route lines for this plan$/ })).toBeVisible();
    const [gpx] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^For a GPS or hiking app/ }).click()]);
    const text = readFileSync((await gpx.path())!, 'utf8');
    expect(text).not.toMatch(/<name>Day \d+(, [^:<]+)?: /);
    await expect(page.locator('.toast-region')).toContainText(/Downloaded canadian-rockies-2029\.gpx · \d+ points$/);
  });

  test('Print renders the print view from the export model, with the times of the page, and removes it afterwards', async ({ page }) => {
    await withFake(page);
    await page.addInitScript(() => {
      (window as unknown as { __printed: unknown[] }).__printed = [];
      window.print = () => {
        const view = document.querySelector('[data-testid="trip-print-view"]');
        (window as unknown as { __printed: unknown[] }).__printed.push({ text: view?.textContent ?? null, on: document.documentElement.hasAttribute('data-print-model'), parent: view?.parentElement?.tagName, rows: [...(view?.querySelectorAll('li') ?? [])].map((li) => ({ lead: li.querySelector('b')?.textContent ?? '', text: li.textContent ?? '' })) });
        window.dispatchEvent(new Event('afterprint'));
      };
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${server.url}${ROCKIES}?p=family-6#day-8`);
    await ready(page);
    await top(page).click();
    await page.getByRole('menuitem', { name: 'Print or save as PDF' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: unknown[] }).__printed.length)).toBe(1);
    const printed = (await page.evaluate(() => (window as unknown as { __printed: { text: string; on: boolean; parent: string; rows: { lead: string; text: string }[] }[] }).__printed))[0]!;
    expect(printed.on).toBe(true);
    expect(printed.parent).toBe('BODY');
    expect(printed.text).toContain('Day 1: ');
    expect(printed.text).toContain('Day 15: ');
    expect(printed.text).toContain('Planned for Family, 6 · Standard');
    expect(printed.text).not.toMatch(/Lane [ABC]/);
    expect(printed.text).toMatch(/\d\d:\d\d · /);
    // B2: every stop the page shows, shows on paper with the same time word ("~" for a suggested time) and the same duration
    const rows = await page.evaluate(() => [...document.querySelectorAll('li.tl-entry[data-kind="visit"], li.tl-entry[data-kind="trail"]')]
      .filter((li) => !li.hasAttribute('data-inside') && !li.hasAttribute('data-lane-off') && li.closest('.tl-day'))
      .map((li) => ({ conf: li.getAttribute('data-conf'), time: li.querySelector('.tl-time span')?.textContent ?? '', tz: li.querySelector('.tl-tz')?.textContent ?? '', title: (li.querySelector('.tl-title')?.textContent ?? '').replace(/^After dark\s*/, ''), dur: li.querySelector('.tl-dur')?.textContent ?? '' })));
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.some((r) => r.conf === 'suggested')).toBe(true);
    for (const r of rows) {
      const word = `${r.conf === 'suggested' ? `~${r.time}` : r.time}${r.tz ? ` ${r.tz}` : ''}`;
      expect(printed.text, `${word} ${r.title}`).toContain(`${word} · ${r.title}`);
      // the printed row itself: its time word leads, its title follows, and its duration is the page's own text, after the title (and area), before any note
      const row = printed.rows.find((p) => p.lead === `${word} · ` && p.text.startsWith(`${word} · ${r.title}`));
      expect(row, `printed row for ${word} ${r.title}`).toBeTruthy();
      if (r.dur) expect(row!.text, `${r.title} duration ${r.dur}`).toContain(` · ${r.dur}`);
      else expect(row!.text, `${r.title} has no duration on the page`).not.toMatch(/ · (\d+ min|\d+h( \d+m)?)(\s|$)/);
    }
    expect(printed.text).toContain('Source: Trip Plans');
    expect(printed.text).not.toMatch(/whitby/i);
    await expect(page.getByTestId('trip-print-view')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-print-model'))).toBe(false);
  });

  test('B3: on a phone the opened key is a panel over the map, which keeps 240 px and its controls', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${server.url}${ROCKIES}?p=family-6#day-5`);
    await page.getByRole('button', { name: 'Map', exact: true }).first().click();
    await ready(page);
    const surface = page.locator('.tl-mapbox .trip-map-surface');
    await expect(page.getByTestId('route-credit')).toBeVisible();
    const closed = (await surface.boundingBox())!;
    expect(closed.height).toBeGreaterThanOrEqual(240);
    await page.getByRole('button', { name: 'Map key' }).click();
    await page.getByRole('button', { name: 'Map key' }).focus(); // Safari does not focus a button on click; Escape is a keyboard user's, who has it focused
    const panel = page.getByTestId('trip-map-key-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Road or path route');
    await expect(panel).toContainText('Straight line, not a route');
    const open = (await surface.boundingBox())!;
    expect(open.height).toBeGreaterThanOrEqual(240);
    expect(Math.abs(open.height - closed.height)).toBeLessThan(2); // the map did not move or shrink
    // the zoom column is not under the panel, and its targets are tappable
    const [pb, zi, zo] = await Promise.all([panel.boundingBox(), page.getByRole('button', { name: 'Zoom in' }).boundingBox(), page.getByRole('button', { name: 'Zoom out' }).boundingBox()]);
    for (const z of [zi!, zo!]) {
      expect(z.width).toBeGreaterThanOrEqual(32);
      expect(z.height).toBeGreaterThanOrEqual(32);
      expect(pb!.x + pb!.width).toBeLessThanOrEqual(z.x + 1);
    }
    // the panel stays inside the sheet and scrolls instead of growing
    expect(pb!.y + pb!.height).toBeLessThanOrEqual(open.y + open.height);
    // Escape closes it and gives focus back to the toggle
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Map key' })).toBeFocused();
  });

  test('on a phone the page-top Export trip is the only one', async ({ page }) => {
    await withFake(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${server.url}${ROCKIES}#day-8`);
    await expect(top(page)).toBeVisible();
    await expect(page.locator('.tl-planbar').getByRole('button', { name: 'Export trip', exact: true })).toBeHidden();
  });
});
