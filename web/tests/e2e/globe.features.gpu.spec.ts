import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { expect, forwardData, SITE, test } from './fixtures';

// GLB2 part a (backlog 9.7, 9.4, 9.8): Fly here moves the camera for every feature class and ends inside the feature's box; a river draws
// its own line; the Natural features switch (`nf=0`) removes the features from search and picking and survives a reload of the link.
// GPU Chromium with real tiles. On macOS the browser is the bundled Chromium on Metal; on Linux the Arc GPU path.
/**
 * A static server over .site with a deep accept queue. Each page asks for a few dozen files at once, and the fixture's `python -m http.server`
 * has a queue of 5, so a loaded machine resets connections and the globe never paints; nothing here is about the globe.
 */
async function serveSite(): Promise<{ url: string; stop: () => void }> {
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.png': 'image/png' };
  const file = (p: string): string | null => {
    const f = path.join(SITE, decodeURIComponent(p));
    if (!f.startsWith(SITE) || !existsSync(f)) return null;
    return statSync(f).isDirectory() ? (existsSync(path.join(f, 'index.html')) ? path.join(f, 'index.html') : null) : f;
  };
  const server = http.createServer((req, res) => {
    if (forwardData(req, res)) return;
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;
    // /globe/<anything> is one page on the host (the /globe/* rewrite in web/redirects.json)
    const f = file(pathname) ?? (pathname.startsWith('/globe/') ? file('/globe/') : null) ?? file('/404.html');
    res.writeHead(f && file(pathname) ? 200 : 404, { 'content-type': types[path.extname(f ?? '')] ?? 'application/octet-stream' });
    if (f) createReadStream(f).pipe(res); else res.end();
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', 1024, ok));
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, stop: () => { server.close(); } };
}

const MAC = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const LINUX = path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
const CHROME = process.env.GPU_CHROME ?? (process.platform === 'darwin' ? MAC : LINUX);
const ARGS = ['--use-gl=angle', `--use-angle=${process.platform === 'darwin' ? 'metal' : 'gl'}`, '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

interface MapLike {
  getZoom(): number; getCenter(): { lng: number; lat: number }; isMoving(): boolean;
  querySourceFeatures(source: string): { geometry: { type: string } }[];
}
const camera = (page: Page) => page.evaluate(() => {
  const m = (document.querySelector('.globe-map') as unknown as { __map: MapLike }).__map;
  return { z: m.getZoom(), lng: m.getCenter().lng, lat: m.getCenter().lat, moving: m.isMoving() };
});
const shapeTypes = (page: Page) => page.evaluate(() => {
  const m = (document.querySelector('.globe-map') as unknown as { __map: MapLike }).__map;
  return m.querySourceFeatures('feature-shape').map((f) => f.geometry.type);
});

/** [name, search text, option text, kind label, box [w, s, e, n], draws a line or outline] */
const CASES = [
  ['river', 'Danube', 'Danube', 'River', [8.1, 43.6, 28.8, 49.1]],
  ['plain', 'Ganges Plain', 'Ganges Plain', 'Landform', [76.6, 21.7, 91.4, 30.6]],
  ['delta', 'Ganges Delta', 'Ganges Delta', 'Landform', [87.5, 21.5, 91.5, 24.5]],
  ['lake', 'Great Lakes', 'Great Lakes', 'Landform', [-92.2, 41.6, -79.6, 49.1]],
  ['range', 'Alps', 'Alps', 'Landform', [5.1, 43.6, 16.2, 48.2]],
] as const;

test.describe('globe natural features (GPU, real tiles)', () => {
  test.skip(!existsSync(CHROME), 'no GPU Chromium at GPU_CHROME');
  test.setTimeout(240_000);
  let browser: Browser;
  let site: { url: string; stop: () => void };
  // a failed assertion must not leave a WebGL context behind: the next test would paint late
  const contexts: BrowserContext[] = [];
  test.afterEach(async () => { await Promise.all(contexts.splice(0).map((c) => c.close().catch(() => undefined))); });
  test.beforeAll(async () => { site = await serveSite(); if (existsSync(CHROME)) browser = await chromium.launch({ executablePath: CHROME, args: ARGS }); });
  test.afterAll(async () => { await browser?.close(); site?.stop(); });

  async function open(url: string, vp = { width: 1440, height: 900 }): Promise<Page> {
    const ctx = await browser.newContext({ viewport: vp, ...(vp.width < 500 ? { hasTouch: true, isMobile: true } : {}) });
    contexts.push(ctx);
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('travel:v1:globe', JSON.stringify({ spin: false })));
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('.globe-canvas')?.getAttribute('data-painted') === 'true', null, { timeout: 120_000 });
    return page;
  }
  const rest = async (page: Page) => { await expect.poll(async () => !(await camera(page)).moving, { timeout: 40_000 }).toBe(true); await page.waitForTimeout(600); };
  const inBox = (c: { lng: number; lat: number }, b: readonly number[]) => c.lng >= b[0] && c.lng <= b[2] && c.lat >= b[1] && c.lat <= b[3];

  for (const [cls, text, name, kind, box] of CASES) {
    test(`${cls}: a search pick lands inside the ${name} box, Fly here moves the camera and stays inside it`, async () => {
      const page = await open(`${site.url}/globe/`);
      await page.getByRole('combobox', { name: 'Search the globe' }).fill(text);
      const option = page.getByRole('option').filter({ hasText: name }).filter({ hasText: kind }).first();
      await expect(option).toBeVisible();
      await option.click();
      await expect(page.locator('.globe-feature')).toBeVisible({ timeout: 40_000 });
      await rest(page);
      const landed = await camera(page);
      expect(inBox(landed, box), `search landing ${landed.lng.toFixed(2)},${landed.lat.toFixed(2)} inside ${box}`).toBe(true);
      await page.getByRole('button', { name: 'Fly here' }).click();
      await expect.poll(async () => (await camera(page)).z, { timeout: 40_000 }).not.toBeCloseTo(landed.z, 1);
      await rest(page);
      const after = await camera(page);
      expect(inBox(after, box), `Fly here ends at ${after.lng.toFixed(2)},${after.lat.toFixed(2)} inside ${box}`).toBe(true);
      expect(after.z, 'Fly here fits tighter than the search landing').toBeGreaterThan(landed.z);
      // the feature draws its own line or outline, never a state: a river a line, an area a ring
      await expect.poll(async () => (await shapeTypes(page)).length, { timeout: 40_000, message: `${name} draws its own shape` }).toBeGreaterThan(0);
      const types = await shapeTypes(page);
      expect(types.every((t) => (cls === 'river' ? /LineString/.test(t) : /Polygon/.test(t)))).toBe(true);
      await page.context().close();
    });
  }

  for (const river of ['Ganges', 'Nile']) {
    test(`${river} draws a line when picked from search`, async () => {
      const page = await open(`${site.url}/globe/`);
      await page.getByRole('combobox', { name: 'Search the globe' }).fill(river);
      await page.getByRole('option', { name: new RegExp(`^${river}\\s*River`) }).first().click();
      await expect(page.locator('.globe-feature')).toBeVisible({ timeout: 40_000 });
      await expect.poll(async () => (await shapeTypes(page)).length, { timeout: 40_000 }).toBeGreaterThan(0);
      expect((await shapeTypes(page)).every((t) => /LineString/.test(t))).toBe(true);
      await page.context().close();
    });
  }

  test('nf=0 removes features from search, the switch writes it into the link, and it survives a reload', async () => {
    const page = await open(`${site.url}/globe/`);
    const search = page.getByRole('combobox', { name: 'Search the globe' });
    await search.fill('Danube');
    await expect(page.getByRole('option').filter({ hasText: 'River' }).first()).toBeVisible();
    await search.fill('');
    await page.getByRole('button', { name: 'Map options' }).first().click();
    const sw = page.getByRole('switch', { name: /Natural features/ });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => new URL(page.url()).searchParams.get('nf')).toBe('0');
    await search.fill('Danube');
    await expect(page.getByRole('option').filter({ hasText: /River|Landform|Sea/ })).toHaveCount(0);
    const link = page.url();
    await page.context().close();
    // a reload of the link keeps it off, and nothing was stored
    const again = await open(link);
    await again.getByRole('button', { name: 'Map options' }).first().click();
    await expect(again.getByRole('switch', { name: /Natural features/ })).toHaveAttribute('aria-checked', 'false');
    await again.getByRole('combobox', { name: 'Search the globe' }).fill('Alps');
    await expect(again.getByRole('option').filter({ hasText: 'Landform' })).toHaveCount(0);
    expect(await again.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain('nf');
    await again.context().close();
  });

  test('nf=0 stops the map picking a river; with it on the same click selects the river', async () => {
    for (const nf of [false, true]) {
      const page = await open(`${site.url}/globe/?c=19.05,47.5,9.5${nf ? '' : '&nf=0'}`);
      await page.waitForTimeout(6000);
      const at = await page.evaluate(() => {
        const m = (document.querySelector('.globe-map') as unknown as { __map: { queryRenderedFeatures(box?: [[number, number], [number, number]]): { sourceLayer?: string; properties: Record<string, string>; geometry: { type: string; coordinates: unknown } }[]; project(c: [number, number]): { x: number; y: number } } }).__map;
        // a vertex of a drawn Danube segment inside the free area (clear of the side panel and the controls)
        for (const f of m.queryRenderedFeatures()) {
          if (f.sourceLayer !== 'waterway' || !/Duna|Danube/.test(f.properties.name ?? '') || f.geometry.type !== 'LineString') continue;
          for (const c of f.geometry.coordinates as [number, number][]) {
            const s = m.project(c);
            // project() is relative to the canvas; the mouse is relative to the page
            const box = (document.querySelector('.globe-map') as HTMLElement).getBoundingClientRect();
            if (s.x <= 150 || s.x >= 850 || s.y <= 160 || s.y >= 760) continue;
            // a spot where the river is the only named thing within the hit box, so the click can only mean the river
            const near = m.queryRenderedFeatures([[s.x - 8, s.y - 8], [s.x + 8, s.y + 8]]).filter((x) => ['place', 'water_name', 'mountain_peak', 'park'].includes(x.sourceLayer ?? ''));
            if (!near.length) return { x: s.x + box.left, y: s.y + box.top };
          }
        }
        return null;
      });
      expect(at, 'the Danube is drawn at Budapest').toBeTruthy();
      await page.mouse.click(at!.x, at!.y);
      await page.waitForTimeout(800);
      if (nf) await expect(page.locator('.globe-feature')).toContainText(/Duna|Danube/);
      else await expect(page.locator('.globe-feature')).toHaveCount(0);
      await page.context().close();
    }
  });

  test('nf=0: a query that matches only a natural feature says so and Turn on brings it back with the query kept', async () => {
    const page = await open(`${site.url}/globe/?nf=0`);
    const search = page.getByRole('combobox', { name: 'Search the globe' });
    await search.fill('Ganges');
    await expect(page.getByText('Ganges is a natural feature. Natural features are off.')).toBeVisible();
    await page.getByRole('button', { name: 'Turn on' }).click();
    await expect(search).toHaveValue('Ganges');
    await expect.poll(() => new URL(page.url()).searchParams.get('nf')).toBeNull();
    await expect(page.getByRole('option').filter({ hasText: 'River' }).first()).toBeVisible();
  });

  test('desktop: after Fly here the card does not sit on the river it describes', async () => {
    const page = await open(`${site.url}/globe/`);
    await page.getByRole('combobox', { name: 'Search the globe' }).fill('Ganges');
    await page.getByRole('option', { name: /^Ganges\s*River/ }).first().click();
    await expect(page.locator('.globe-feature')).toBeVisible({ timeout: 40_000 });
    await rest(page);
    await page.getByRole('button', { name: 'Fly here' }).click();
    await rest(page);
    await expect.poll(async () => (await page.locator('.globe-feature').boundingBox())?.x ?? 0, { timeout: 10_000 }).toBeGreaterThan(0);
    const covered = await page.evaluate(() => {
      const m = (document.querySelector('.globe-map') as unknown as { __map: { querySourceFeatures(s: string): { geometry: { coordinates: [number, number][][] } }[]; project(c: [number, number]): { x: number; y: number } } }).__map;
      const box = document.querySelector('.globe-map')!.getBoundingClientRect();
      const card = document.querySelector('.globe-feature')!.getBoundingClientRect();
      let n = 0, total = 0;
      for (const f of m.querySourceFeatures('feature-shape')) for (const c of (f.geometry.coordinates as unknown as number[]).flat(3).reduce<[number, number][]>((a, v, i) => { if (i % 2) a[a.length - 1].push(v); else a.push([v] as unknown as [number, number]); return a; }, [])) {
        const p = m.project(c); const x = p.x + box.left, y = p.y + box.top; total++;
        if (x > card.left && x < card.right && y > card.top && y < card.bottom) n++;
      }
      return { n, total };
    });
    expect(covered.total).toBeGreaterThan(10);
    expect(covered.n, `${covered.n} of ${covered.total} river vertices under the card`).toBe(0);
  });

  test('phone: the feature card is docked at the bottom, the river clear of it', async () => {
    const page = await open(`${site.url}/globe/`, { width: 390, height: 844 });
    await page.getByRole('combobox', { name: 'Search the globe' }).fill('Ganges');
    await page.getByRole('option', { name: /^Ganges\s*River/ }).first().click();
    await expect(page.locator('.globe-feature')).toBeVisible({ timeout: 40_000 });
    await rest(page);
    await page.getByRole('button', { name: 'Fly here' }).click();
    await rest(page);
    const card = (await page.locator('.globe-feature').boundingBox())!;
    expect(card.y, 'docked in the lower part of the screen').toBeGreaterThan(844 * 0.55);
    expect(card.y + card.height, 'above the bottom bar').toBeLessThanOrEqual(844 - 40);
    const under = await page.evaluate(() => {
      const m = (document.querySelector('.globe-map') as unknown as { __map: { querySourceFeatures(s: string): { geometry: { coordinates: [number, number][][] } }[]; project(c: [number, number]): { x: number; y: number } } }).__map;
      const box = document.querySelector('.globe-map')!.getBoundingClientRect();
      const card = document.querySelector('.globe-feature')!.getBoundingClientRect();
      let n = 0;
      for (const f of m.querySourceFeatures('feature-shape')) for (const c of (f.geometry.coordinates as unknown as number[]).flat(3).reduce<[number, number][]>((a, v, i) => { if (i % 2) a[a.length - 1].push(v); else a.push([v] as unknown as [number, number]); return a; }, [])) {
        const p = m.project(c); const x = p.x + box.left, y = p.y + box.top;
        if (x > card.left && x < card.right && y > card.top && y < card.bottom) n++;
      }
      return n;
    });
    expect(under, 'river vertices under the card').toBe(0);
  });

  test('landscape phone (844 x 390): the card clears the river, Copy link stays on one line, no pin sits under the zoom rail', async () => {
    const page = await open(`${site.url}/globe/`, { width: 844, height: 390 });
    await page.getByRole('combobox', { name: 'Search the globe' }).fill('Ganges');
    await page.getByRole('option', { name: /^Ganges\s*River/ }).first().click();
    await expect(page.locator('.globe-feature')).toBeVisible({ timeout: 40_000 });
    await rest(page);
    await page.getByRole('button', { name: 'Fly here' }).click();
    await rest(page);
    const copy = (await page.getByRole('button', { name: 'Copy link' }).boundingBox())!;
    expect(copy.height, 'Copy link on one line').toBeLessThan(26);
    const r = await page.evaluate(() => {
      const m = (document.querySelector('.globe-map') as unknown as { __map: { querySourceFeatures(s: string): { geometry: { coordinates: unknown } }[]; project(c: [number, number]): { x: number; y: number } } }).__map;
      const box = document.querySelector('.globe-map')!.getBoundingClientRect();
      const card = document.querySelector('.globe-feature')!.getBoundingClientRect();
      let under = 0;
      for (const f of m.querySourceFeatures('feature-shape')) {
        const nums = (f.geometry.coordinates as number[]).flat(4);
        for (let i = 0; i + 1 < nums.length; i += 2) { const p = m.project([nums[i], nums[i + 1]]); const x = p.x + box.left, y = p.y + box.top; if (x > card.left && x < card.right && y > card.top && y < card.bottom) under++; }
      }
      const rail = document.querySelector('.globe-zoom')!.getBoundingClientRect();
      const pins = [...document.querySelectorAll('.globe-marker')].filter((e) => getComputedStyle(e).visibility !== 'hidden').filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > rail.left && b.left < rail.right && b.bottom > rail.top && b.top < rail.bottom; }).length;
      return { under, pins };
    });
    expect(r.under, 'river vertices under the card').toBe(0);
    expect(r.pins, 'visible pins under the zoom rail').toBe(0);
  });
});
