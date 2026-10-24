import { execFile } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { FAKE_GOOGLE_JS } from './fake-google-page';
import { expect, startNext, test, type Server } from './fixtures';

// TRP2b2 evidence (review MUST-8): the trip route map's screens at 1440 x 900 and 390 x 844, light and dark, 2x. Opt in with TRP2B2_SHOTS_DIR=<folder>;
// the folder is outside Playwright's output folder, which is emptied on every run.
//
// HONEST LABEL: the site is built with a FAKE Google key and Map ID and served the stand-in Maps script of fake-google-page.ts (as trip-routes.spec.ts
// does), so there is NO basemap. The stand-in draws nothing, so `overlay` below paints, on a plain surface, the polylines the real adapter handed to
// it (their paths, colours and weights come from the real `legParts` and the real token palette) and places the real pin elements at a linear
// projection of their positions. Everything else (key, chip, label row, export menus, print view, themes, layout) is the real page. This shows
// the geometry, the hierarchy of line styles and the layout; it does NOT show a Google basemap (so SHOULD-2's dark contrast on land and forest stays
// open). Run under `--project=chromium` (Metal GPU flags).
const OUT = process.env.TRP2B2_SHOTS_DIR;
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = '.fixture-trp2b2-shots';
const SIZES = [{ width: 1440, height: 900 }, { width: 390, height: 844 }] as const;
const THEMES = ['light', 'dark'] as const;
const ROCKIES = '/trips/canadian-rockies-2029/';
const DOLOMITES = '/trips/dolomites-2027/';
const MAPS = /maps\.googleapis\.com\/maps\/api\/js/;

/** Runs in the page: a plain surface under the stand-in's marker layer, redrawn every 150 ms from what the adapter has asked the stand-in to draw. */
function installOverlay(): void {
  type Pt = { lat: number; lng: number };
  type Icon = { icon: { strokeColor: string; strokeWeight: number; strokeOpacity: number; scale: number } };
  type Poly = { map?: unknown; o: { map?: unknown; path: Pt[]; strokeOpacity?: number; strokeColor?: string; strokeWeight?: number; zIndex?: number; icons?: Icon[] } };
  const w = window as unknown as { __fg: { polylines: Poly[] }; __fgMap?: { layer: HTMLElement } };
  const NS = 'http://www.w3.org/2000/svg';
  const draw = () => {
    const layer = w.__fgMap?.layer;
    if (!layer) return;
    let svg = layer.querySelector<SVGSVGElement>('svg[data-overlay]');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('data-overlay', '');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      layer.style.background = 'var(--well)';
      layer.prepend(svg);
    }
    const live = w.__fg.polylines.filter((p) => (p.map === undefined ? p.o.map : p.map));
    const markers = [...layer.querySelectorAll<HTMLElement & { position?: Pt }>('fake-advanced-marker')];
    // the frame is fitted to what matters: the numbered pins and bases and every line (dim dots of other days stay where they fall, possibly off the surface)
    const keep = markers.filter((m) => m.querySelector('[data-numbered], .tp-base, .tp-dot:not([data-dim])'));
    const linePts = live.flatMap((p) => p.o.path);
    // fit to the routed lines when there are any (a day view); other days' bases would shrink them to a dot
    const pts: Pt[] = linePts.length ? linePts : keep.flatMap((m) => (m.position ? [m.position] : []));
    if (!pts.length) return;
    const r = layer.getBoundingClientRect();
    const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const padX = 56, padY = 56;
    const sx = (r.width - 2 * padX) / Math.max(1e-9, (maxLng - minLng) * k), sy = (r.height - 2 * padY) / Math.max(1e-9, maxLat - minLat);
    const s = Math.min(sx, sy);
    const cx = (minLng + maxLng) / 2, cy = (minLat + maxLat) / 2;
    const at = (p: Pt): [number, number] => [r.width / 2 + (p.lng - cx) * k * s, r.height / 2 - (p.lat - cy) * s];
    svg.replaceChildren();
    for (const p of [...live].sort((a, b) => (a.o.zIndex ?? 0) - (b.o.zIndex ?? 0))) {
      const d = p.o.path.map((q, i) => `${i ? 'L' : 'M'}${at(q).join(',')}`).join('');
      const dash = p.o.icons?.[0]?.icon;
      const el = document.createElementNS(NS, 'path');
      el.setAttribute('d', d);
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke-linejoin', 'round');
      if ((p.o.strokeOpacity ?? 0) > 0) {
        el.setAttribute('stroke', p.o.strokeColor ?? 'currentColor');
        el.setAttribute('stroke-opacity', String(p.o.strokeOpacity));
        el.setAttribute('stroke-width', String(p.o.strokeWeight ?? 2));
        el.setAttribute('stroke-linecap', 'round');
      } else if (dash) {
        // the symbol's path is 'M 0,-1 0,1' scaled by `scale` (2 x scale long) repeated every 14 px
        el.setAttribute('stroke', dash.strokeColor);
        el.setAttribute('stroke-opacity', String(dash.strokeOpacity));
        el.setAttribute('stroke-width', String(dash.strokeWeight));
        el.setAttribute('stroke-dasharray', `${2 * dash.scale} ${14 - 2 * dash.scale}`);
      } else continue;
      svg.append(el);
    }
    for (const m of markers) {
      if (!m.position) continue;
      const [x, y] = at(m.position);
      m.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%)`;
    }
  };
  window.setInterval(draw, 150);
  draw();
}

test.describe('TRP2b2 screenshots (stand-in Google script, plain-surface overlay, no basemap)', () => {
  test.skip(!OUT, 'set TRP2B2_SHOTS_DIR to a folder');
  test.setTimeout(1_800_000);
  let server: Server;

  test.beforeAll(async () => {
    rmSync(path.join(WEB, DIST), { recursive: true, force: true });
    const status = await new Promise<{ code: number | null; err: string }>((resolve) => {
      const env: NodeJS.ProcessEnv = { ...process.env, NEXT_DIST_DIR: DIST, HUB_TODAY: '2026-10-17', NEXT_PUBLIC_GOOGLE_MAPS_KEY: 'fake-key-for-tests', NEXT_PUBLIC_GOOGLE_MAP_ID: 'fake-map-id', NEXT_PUBLIC_TRIP_MAP_FAMILY: '' };
      const child = execFile(process.execPath, [path.join(WEB, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], { cwd: WEB, maxBuffer: 64 * 1024 * 1024, env }, (_e, _out, err) => resolve({ code: child.exitCode, err: String(err).slice(-800) }));
    });
    expect(status.code, status.err).toBe(0);
    server = await startNext(DIST);
  });
  test.afterAll(() => server?.stop());

  async function open(browser: import('@playwright/test').Browser, size: (typeof SIZES)[number], theme: (typeof THEMES)[number]) {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'en-CA' });
    const page = await context.newPage();
    await page.addInitScript((t) => { try { window.localStorage.setItem('travel:v1:theme', t); } catch { /* storage unavailable */ } }, theme);
    await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (route) => route.abort());
    // registered last, so it wins over the abort above
    await page.route(MAPS, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_GOOGLE_JS }));
    return { context, page };
  }
  const settle = async (page: Page) => {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1800); // the legs hold is 1.2 s
  };
  const toMap = async (page: Page, phone: boolean) => {
    if (phone) {
      await page.getByRole('button', { name: /^Map$/ }).first().click();
    } else {
      await page.locator('#route').scrollIntoViewIfNeeded();
    }
    await page.locator('[data-trip-map][data-phase="ready"]').waitFor({ timeout: 20_000 });
    await page.evaluate(installOverlay);
    await page.waitForTimeout(1500);
  };
  const file = (name: string, size: (typeof SIZES)[number], theme: string) => {
    mkdirSync(OUT!, { recursive: true });
    return path.join(OUT!, `${name}-${size.width}-${theme}.png`);
  };

  const scenes: [string, string, ((page: Page, phone: boolean) => Promise<void>)?][] = [
    ['rockies-day8', `${ROCKIES}?p=family-6#day-8`],
    ['rockies-day5', `${ROCKIES}?p=family-6#day-5`],
    ['rockies-day3', `${ROCKIES}?p=family-6#day-3`],
    ['dolomites-day4', `${DOLOMITES}?p=family-4#day-4`],
    ['dolomites-day3', `${DOLOMITES}?p=family-4#day-3`],
    ['rockies-all-days', `${ROCKIES}?p=family-6#day-5`, async (page) => { await page.getByRole('radio', { name: 'All days' }).click(); await page.waitForTimeout(2000); }],
    ['dolomites-all-days', `${DOLOMITES}?p=family-4#day-4`, async (page) => { await page.getByRole('radio', { name: 'All days' }).click(); await page.waitForTimeout(2000); }],
  ];
  for (const [name, url, prep] of scenes) {
    test(name, async ({ browser }) => {
      for (const theme of THEMES) for (const size of SIZES) {
        const { context, page } = await open(browser, size, theme);
        await page.goto(`${server.url}${url}`);
        await settle(page);
        await toMap(page, size.width < 640);
        if (prep) await prep(page, size.width < 640);
        await page.screenshot({ path: file(name, size, theme) });
        await context.close();
      }
    });
  }

  for (const [name, url] of [['phone-key', `${ROCKIES}?p=family-6#day-5`], ['phone-key-dolomites', `${DOLOMITES}?p=family-4#day-4`]] as const) {
    test(`${name}: collapsed and open (a mixed day)`, async ({ browser }) => {
      for (const theme of THEMES) {
        const size = SIZES[1];
        const { context, page } = await open(browser, size, theme);
        await page.goto(`${server.url}${url}`);
        await settle(page);
        await toMap(page, true);
        await page.screenshot({ path: file(`${name}-collapsed`, size, theme) });
        await page.getByRole('button', { name: 'Map key' }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: file(`${name}-open`, size, theme) });
        await context.close();
      }
    });
  }

  test('hover: a stop row on a routed day (desktop)', async ({ browser }) => {
    for (const theme of THEMES) {
      const size = SIZES[0];
      const { context, page } = await open(browser, size, theme);
      await page.goto(`${server.url}${ROCKIES}?p=family-6#day-8`);
      await settle(page);
      await toMap(page, false);
      await page.locator('#day-8 li.tl-entry[data-pin]').nth(1).hover();
      await page.waitForTimeout(600);
      await page.screenshot({ path: file('hover-row', size, theme) });
      await context.close();
    }
  });

  test('export menus: the page top, the plan bar (desktop) and the phone', async ({ browser }) => {
    for (const theme of THEMES) for (const size of SIZES) {
      const { context, page } = await open(browser, size, theme);
      await page.goto(`${server.url}${ROCKIES}?p=family-6#day-8`);
      await settle(page);
      await page.locator('.trip-cover').getByRole('button', { name: 'Export trip', exact: true }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: file('export-menu-top', size, theme) });
      await page.keyboard.press('Escape');
      if (size.width >= 1024) {
        await page.locator('.tl-planbar').getByRole('button', { name: 'Export trip', exact: true }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: file('export-menu-planbar', size, theme) });
      }
      await context.close();
    }
  });

  test('print: the print view as Chromium prints it (PDF and print-media screenshot)', async ({ browser }) => {
    for (const [trip, p] of [[ROCKIES, 'family-6'], [DOLOMITES, 'family-4']] as const) {
      const size = SIZES[0];
      const { context, page } = await open(browser, size, 'dark'); // print forces light tokens: a dark page must still print on white
      await page.addInitScript(() => { window.print = () => undefined; });
      await page.goto(`${server.url}${trip}?p=${p}#day-3`);
      await settle(page);
      await page.locator('.trip-cover').getByRole('button', { name: 'Export trip', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Print or save as PDF' }).click();
      await expect(page.getByTestId('trip-print-view')).toBeVisible({ timeout: 5000 }).catch(() => undefined);
      await page.emulateMedia({ media: 'print' });
      await page.waitForTimeout(500);
      const slug = trip.split('/')[2]!;
      mkdirSync(OUT!, { recursive: true });
      await page.pdf({ path: path.join(OUT!, `print-${slug}.pdf`), format: 'A4', printBackground: true });
      await page.screenshot({ path: path.join(OUT!, `print-${slug}-1440-dark-forced-light.png`), fullPage: true });
      await context.close();
    }
  });
});
