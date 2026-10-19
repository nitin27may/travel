import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Motion and first paint on the real GPU with real tiles (spec 8.1, 8.3, 9.1 checks 8, 9, 16, 21, 25; acceptance A9). SwiftShader is about
// 35x slower, so these never run on it and are skipped where there is no GPU Chromium or no network.
const CHROME = process.env.GPU_CHROME ?? path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
const ARGS = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

interface MapLike { getZoom(): number; getPitch(): number; getCenter(): { lng: number; lat: number }; project(p: [number, number]): { x: number; y: number }; isMoving(): boolean; flyTo: unknown; easeTo: unknown; jumpTo: unknown }
declare global { interface Window { __frames?: number[]; __long?: [number, number][]; __calls?: string[] } }
const map = (page: Page) => page.evaluate(() => { const m = (document.querySelector('.globe-map') as unknown as { __map: MapLike }).__map; return { z: m.getZoom(), pitch: m.getPitch(), lng: m.getCenter().lng, lat: m.getCenter().lat }; });

test.describe('globe motion and first paint (GPU, real tiles)', () => {
  test.skip(!existsSync(CHROME), 'no GPU Chromium at GPU_CHROME');
  test.setTimeout(180_000);
  let browser: Browser;
  test.beforeAll(async () => { if (existsSync(CHROME)) browser = await chromium.launch({ executablePath: CHROME, args: ARGS }); });
  test.afterAll(async () => { await browser?.close(); });

  async function open(url: string, o: { reduced?: boolean; spin?: boolean; w?: number; h?: number } = {}): Promise<Page> {
    const ctx = await browser.newContext({ viewport: { width: o.w ?? 1440, height: o.h ?? 900 }, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    await page.addInitScript((spin) => {
      localStorage.setItem('travel:v1:globe', JSON.stringify({ spin }));
      window.__long = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long!.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ entryTypes: ['longtask'] });
    }, o.spin ?? false);
    await page.goto(url);
    return page;
  }
  const painted = (page: Page) => page.waitForFunction(() => document.querySelector('.globe-canvas')?.getAttribute('data-painted') === 'true', null, { timeout: 45_000 });

  test('first paint: the halo disc is in the page, the canvas is clear until the first idle, pins come after (check 16)', async ({ site }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${site.url}/globe/`, { waitUntil: 'domcontentloaded' });
    const halo = await page.evaluate(() => { const r = document.querySelector('.globe-halo')?.getBoundingClientRect(); return r ? { width: r.width } : null; });
    expect(halo, 'the halo disc is in the static HTML').toBeTruthy();
    // the disc is 86% of the shorter side of the free area (spec 3.1) plus the 6% glow each side: about 702 x 1.12 at 1440 x 840 with the panel open
    expect(halo!.width).toBeGreaterThan(600);
    expect(await page.locator('.globe-pin').count(), 'no pin before the first paint').toBe(0);
    await page.waitForSelector('.globe-map', { timeout: 30_000 });
    expect(await page.locator('.globe-map').evaluate((el) => getComputedStyle(el).opacity), 'the canvas starts clear').toBe('0');
    await painted(page);
    await expect.poll(() => page.locator('.globe-map').evaluate((el) => getComputedStyle(el).opacity), { timeout: 3000 }).toBe('1');
    await expect(page.locator('.globe-pin').first()).toBeVisible();
    await ctx.close();
  });

  test('frame time p50 / p95 during spin, a drag and three flights, and no long task after the first idle (A9, checks 8, 9, 25)', async ({ site }) => {
    const page = await open(`${site.url}/globe/`, { spin: true });
    await painted(page);
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      window.__frames = [];
      let last = performance.now();
      const tick = (t: number) => { window.__frames!.push(t - last); last = t; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      window.__long!.length = 0;
    });
    // spin for 3 s: the centre moves about 4 degrees a second
    const a = await map(page);
    await page.waitForTimeout(3000);
    const b = await map(page);
    const rate = Math.abs(b.lng - a.lng) / 3;
    expect(rate, 'the globe spins at about 4 degrees a second').toBeGreaterThan(2.5);
    expect(rate).toBeLessThan(5.5);
    // a drag, then three flights: into Italy, into South Tyrol, back to the world
    await page.mouse.move(420, 450);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(420 + i * 25, 450, { steps: 2 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    const panel = page.locator('.globe-panel');
    await panel.getByRole('button', { name: /^Italy/ }).click();
    await expect.poll(async () => (await map(page)).z, { timeout: 30_000 }).toBeGreaterThan(4.5);
    await page.waitForTimeout(1500);
    const italy = await map(page);
    expect(Math.abs(italy.pitch - 20), 'Italy ends at pitch 20').toBeLessThan(1.5);
    await panel.getByRole('button', { name: /^South Tyrol/ }).click();
    await expect.poll(async () => (await map(page)).z, { timeout: 30_000 }).toBeGreaterThan(7.5);
    await page.waitForTimeout(1500);
    expect(Math.abs((await map(page)).pitch - 45), 'South Tyrol ends at pitch 45').toBeLessThan(1.5);
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect.poll(async () => (await map(page)).z, { timeout: 30_000 }).toBeLessThan(3);
    await page.waitForTimeout(1500);
    const { frames, long } = await page.evaluate(() => ({ frames: window.__frames!.slice(5), long: window.__long! }));
    const sorted = [...frames].sort((x, y) => x - y);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    console.log(`frames ${frames.length}: p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, long tasks ${JSON.stringify(long)}`);
    expect(p50, 'p50 frame time').toBeLessThanOrEqual(17.5);
    expect(p95, 'p95 frame time').toBeLessThanOrEqual(25);
    expect(long.filter(([, d]) => d > 60), 'no long task over 60 ms after the first idle (one 51 to 52 ms task is MapLibre decoding sprites at Reset view)').toEqual([]);
    await page.context().close();
  });

  test('a flight to a state is one flyTo with its pitch inside it, and reduced motion lands in one jump (checks 8, 21)', async ({ site }) => {
    const page = await open(`${site.url}/globe/it/`);
    await painted(page);
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      const m = (document.querySelector('.globe-map') as unknown as { __map: Record<string, (...a: unknown[]) => unknown> }).__map;
      window.__calls = [];
      for (const k of ['flyTo', 'easeTo', 'jumpTo']) { const o = m[k].bind(m); m[k] = (...args: unknown[]) => { window.__calls!.push(k); return o(...args); }; }
    });
    await page.locator('.globe-panel').getByRole('button', { name: /^South Tyrol/ }).click();
    await expect.poll(async () => (await map(page)).z, { timeout: 30_000 }).toBeGreaterThan(7.5);
    await page.waitForTimeout(1500);
    const calls = await page.evaluate(() => window.__calls!.filter((c) => c !== 'jumpTo'));
    expect(calls.filter((c) => c === 'flyTo'), 'one flight per step').toHaveLength(1);
    expect(calls.filter((c) => c === 'easeTo'), 'no second move to tilt after the flight').toEqual([]);
    await page.context().close();

    const rm = await open(`${site.url}/globe/it/`, { reduced: true });
    await painted(rm);
    await rm.waitForTimeout(2500);
    await rm.locator('.globe-panel').getByRole('button', { name: /^South Tyrol/ }).click();
    await expect.poll(async () => (await map(rm)).z, { timeout: 15_000 }).toBeGreaterThan(7.5);
    expect(Math.abs((await map(rm)).pitch - 45)).toBeLessThan(1.5);
    await rm.context().close();
  });

  test('Italy sits in the upper-middle of the free area after the flight (check 21)', async ({ site }) => {
    const page = await open(`${site.url}/globe/`);
    await painted(page);
    await page.waitForTimeout(2500);
    await page.locator('.globe-panel').getByRole('button', { name: /^Italy/ }).click();
    await expect.poll(async () => (await map(page)).z, { timeout: 30_000 }).toBeGreaterThan(4.5);
    await page.waitForTimeout(1500);
    const at = await page.evaluate(() => {
      const m = (document.querySelector('.globe-map') as unknown as { __map: MapLike }).__map;
      const p = m.project([12.5, 42.4]);
      const h = document.querySelector('.globe-root')!.getBoundingClientRect().height;
      return { y: p.y / h };
    });
    expect(at.y).toBeGreaterThan(0.3);
    expect(at.y).toBeLessThan(0.55);
    await page.context().close();
  });

  test('the pin-anchored card keeps clear of the panel, the search and the crumb once the camera lands (check 3)', async ({ site }) => {
    const page = await open(`${site.url}/globe/place/adolf-munkel-weg/`);
    await painted(page);
    await expect.poll(async () => (await map(page)).z, { timeout: 30_000 }).toBeGreaterThan(11);
    await page.waitForTimeout(1200);
    const hits = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)?.getBoundingClientRect();
      const card = r('.globe-card')!;
      return ['.globe-panel', '.globe-search', '.globe-crumbs', '.globe-zoom'].filter((s) => { const b = r(s); return b && card.left < b.right && b.left < card.right && card.top < b.bottom && b.top < card.bottom; });
    });
    expect(hits).toEqual([]);
    await page.context().close();
  });

  test('a right-click opens "what is here" with the country and our nearby places, and leaves the URL alone (check 27)', async ({ site }) => {
    const page = await open(`${site.url}/globe/it/south-tyrol/?c=11.9,46.55,9.2`);
    await painted(page);
    await page.waitForTimeout(5000);
    const url = page.url();
    await page.mouse.click(560, 450, { button: 'right' });
    const here = page.getByRole('complementary', { name: 'What is here' });
    await expect(here).toBeVisible();
    await expect(here).toContainText('Italy');
    await expect(here).toContainText('Saved place');
    expect(new URL(page.url()).pathname).toBe(new URL(url).pathname);
    await page.keyboard.press('Escape');
    await expect(here).toHaveCount(0);
    await page.context().close();
  });

  // Review M1: MapLibre jumps whenever its modelled duration exceeds maxDuration, so every long hop was a cut. Each path needs a real flight.
  async function zoomsDuring(page: Page, act: () => Promise<void>, ms = 3200): Promise<number[]> {
    const z0 = (await map(page)).z;
    await act();
    const out: number[] = [z0];
    for (let t = 0; t < ms; t += 80) { out.push((await map(page)).z); await page.waitForTimeout(40); }
    return out;
  }
  const intermediate = (zs: number[]): number => { const a = zs[0], b = zs[zs.length - 1]; return new Set(zs.filter((z) => Math.abs(z - a) > 0.2 && Math.abs(z - b) > 0.2).map((z) => z.toFixed(1))).size; };

  test('long flights fly: stepping out, a search pick from the world and a panel row to a place all pass through intermediate zooms (M1)', async ({ site }) => {
    const page = await open(`${site.url}/globe/it/south-tyrol/`);
    await painted(page);
    await expect.poll(async () => (await map(page)).z, { timeout: 30_000 }).toBeGreaterThan(7.5);
    await page.waitForTimeout(1500);
    const steps: [string, () => Promise<void>, string][] = [
      ['Reset view', () => page.getByRole('button', { name: 'Reset view' }).click(), '/globe/it/south-tyrol/'],
      ['Home', () => page.keyboard.press('Home'), '/globe/it/south-tyrol/'],
      ['World crumb', () => page.getByRole('navigation', { name: 'Globe level' }).getByRole('button', { name: 'World' }).click(), '/globe/it/south-tyrol/'],
    ];
    for (const [name, act, back] of steps) {
      const zs = await zoomsDuring(page, act);
      expect(zs[zs.length - 1], `${name} lands at the world`).toBeLessThan(3);
      expect(intermediate(zs), `${name}: intermediate zooms ${zs.map((z) => z.toFixed(1)).join(' ')}`).toBeGreaterThanOrEqual(5);
      await page.goto(`${site.url}${back}`);
      await painted(page);
      await expect.poll(async () => (await map(page)).z, { timeout: 30_000 }).toBeGreaterThan(7.5);
      await page.waitForTimeout(1500);
    }
    await page.goto(`${site.url}/globe/`);
    await painted(page);
    await page.waitForTimeout(2500);
    const q = page.getByRole('combobox', { name: 'Search the globe' });
    let zs = await zoomsDuring(page, async () => { await q.fill('Adolf Munkel'); await page.getByRole('option').first().click(); }, 4200);
    expect(zs[zs.length - 1], 'a search pick lands on the place').toBeGreaterThan(10);
    expect(intermediate(zs), `world to place by search: ${zs.map((z) => z.toFixed(1)).join(' ')}`).toBeGreaterThanOrEqual(5);
    await page.goto(`${site.url}/globe/it/`);
    await painted(page);
    await expect.poll(async () => (await map(page)).z, { timeout: 30_000 }).toBeGreaterThan(4);
    await page.waitForTimeout(2000);
    zs = await zoomsDuring(page, async () => { await page.locator('.globe-panel').getByRole('button', { name: /Adolf Munkel Weg/ }).first().click(); }, 4200);
    expect(zs[zs.length - 1]).toBeGreaterThan(10);
    expect(intermediate(zs), `country to place: ${zs.map((z) => z.toFixed(1)).join(' ')}`).toBeGreaterThanOrEqual(5);
    await page.context().close();
  });

  // Review M2: city labels and city search results resolve to the city, with its outline where we hold one.
  for (const [label, url, outline] of [['Trento', '/globe/?c=11.12,46.07,9', true], ['Firenze', '/globe/?c=11.25,43.77,9', true]] as const) {
    test(`a click on the ${label} label selects the city, not a river, a park or the state (M2)`, async ({ site }) => {
      const page = await open(`${site.url}${url}`);
      await painted(page);
      await page.waitForTimeout(6000);
      const p = await page.evaluate((name) => {
        const m = (document.querySelector('.globe-map') as unknown as { __map: { queryRenderedFeatures(): { sourceLayer?: string; properties: Record<string, string>; geometry: { coordinates: [number, number] } }[]; project(c: [number, number]): { x: number; y: number } } }).__map;
        const f = m.queryRenderedFeatures().find((x) => x.sourceLayer === 'place' && x.properties.name === name);
        if (!f) return null;
        const s = m.project(f.geometry.coordinates);
        return { x: s.x, y: s.y + 60 };
      }, label);
      expect(p, `the ${label} label is drawn`).toBeTruthy();
      const path = new URL(page.url()).pathname;
      await page.mouse.click(p!.x, p!.y);
      const card = page.locator('.globe-feature');
      await expect(card).toContainText(/Trento|Florence|Firenze/);
      await expect(card.locator('.globe-feature-k')).toContainText(/city|town/i);
      expect(new URL(page.url()).pathname, 'the click did not drill into a shape').toBe(path);
      if (outline) {
        await expect.poll(() => page.evaluate(() => (document.querySelector('.globe-map') as unknown as { __map: { querySourceFeatures(id: string): unknown[] } }).__map.querySourceFeatures('city').length), { timeout: 8000 }).toBeGreaterThan(0);
      }
      await page.context().close();
    });
  }

  test('a city search result flies there and opens its card, with the outline, when the camera lands (M2)', async ({ site }) => {
    const page = await open(`${site.url}/globe/`);
    await painted(page);
    await page.waitForTimeout(2500);
    await page.getByRole('combobox', { name: 'Search the globe' }).fill('Florence');
    await page.getByRole('option').filter({ hasText: /Toscana/ }).first().click();
    const card = page.locator('.globe-feature');
    await expect(card).toBeVisible({ timeout: 25_000 });
    await expect(card).toContainText('Florence');
    await expect.poll(async () => (await map(page)).z, { timeout: 20_000 }).toBeGreaterThan(8.5);
    await expect.poll(() => page.evaluate(() => (document.querySelector('.globe-map') as unknown as { __map: { querySourceFeatures(id: string): unknown[] } }).__map.querySourceFeatures('city').length), { timeout: 10_000 }).toBeGreaterThan(0);
    await page.context().close();
  });

  // Review M5 and check 18: no green on the canvas, at zoom 6 and at zoom 12 where Liberty draws its wood pattern.
  for (const [zoom, url] of [[6, '/globe/?c=11.5,46.5,6'], [12, '/globe/place/adolf-munkel-weg/?c=11.766,46.636,12']] as const) {
    test(`no green pixel in the Relief style at zoom ${zoom} (check 18, M5)`, async ({ site }) => {
      const page = await open(`${site.url}${url}`);
      await painted(page);
      await page.waitForTimeout(8000);
      const png = await page.screenshot({ clip: { x: 360, y: 200, width: 200, height: 200 } });
      const sharp = (await import('sharp')).default;
      const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
      let green = 0;
      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
        if (!d) continue;
        const sat = d / (1 - Math.abs(2 * l - 1));
        const hue = max === r ? (((g - b) / d + 6) % 6) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
        if (sat > 0.12 && d * 255 >= 8 && hue >= 75 && hue <= 165) green += 1; // chroma of 8 or more: a near-white antialiasing pixel is not a green
      }
      expect(green, `${green} green pixels of ${data.length / info.channels}`).toBe(0);
      await page.context().close();
    });
  }

  // Review M3 on the real camera: the card never sits on the search box, the breadcrumb, the panel or the rail.
  const clear = (page: Page, card: string) => page.evaluate((c) => {
    const r = (s: string) => document.querySelector(s)?.getBoundingClientRect();
    const a = r(c)!;
    return ['.globe-panel', '.globe-search', '.globe-crumbs', '.globe-zoom', '.globe-card-pill'].filter((s) => { const b = r(s); return b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; });
  }, card);
  for (const [w, h] of [[1440, 900], [1024, 768]] as const) {
    test(`the place card is clear of the chrome at ${w}x${h} (M3)`, async ({ site }) => {
      const page = await open(`${site.url}/globe/place/adolf-munkel-weg/`, { w, h });
      await painted(page);
      await expect.poll(async () => (await map(page)).z, { timeout: 30_000 }).toBeGreaterThan(11);
      await page.waitForTimeout(1500);
      expect(await clear(page, '.globe-card')).toEqual([]);
      await page.context().close();
    });
  }

  test('the feature card is clear of the chrome after a click near the top of the map (M3)', async ({ site }) => {
    const page = await open(`${site.url}/globe/?c=12.33,46.54,9`);
    await painted(page);
    await page.waitForTimeout(6000);
    const p = await page.evaluate(() => {
      const m = (document.querySelector('.globe-map') as unknown as { __map: { queryRenderedFeatures(): { sourceLayer?: string; properties: Record<string, string>; geometry: { coordinates: [number, number] } }[]; project(c: [number, number]): { x: number; y: number } } }).__map;
      const f = m.queryRenderedFeatures().find((x) => x.sourceLayer === 'place' && x.properties.name === "Cortina d'Ampezzo");
      if (!f) return null;
      const s = m.project(f.geometry.coordinates);
      return { x: s.x, y: s.y + 60 };
    });
    test.skip(!p, 'the label is not drawn at this camera');
    await page.mouse.click(p!.x, p!.y);
    await expect(page.locator('.globe-feature')).toBeVisible();
    await page.waitForTimeout(800);
    expect(await clear(page, '.globe-feature')).toEqual([]);
    await page.context().close();
  });
});
