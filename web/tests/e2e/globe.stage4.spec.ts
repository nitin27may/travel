import { existsSync, readFileSync, createReadStream, statSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import sharp from 'sharp';
import { expect, SITE, test } from './fixtures';

// Stage-4 globe fixes (lane GLB; review L2b S1 to S10, backlog 3.46, 3.3b). GPU Chromium with real tiles, like the motion spec:
// the globe needs WebGL, and the scenes below need the style to land. Skipped where there is no GPU Chromium.
const CHROME = process.env.GPU_CHROME ?? path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
const ARGS = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const VIEWPORTS = [[1440, 900], [1024, 768], [390, 844], [844, 390]] as const;

interface MapLike { getZoom(): number; getCenter(): { lng: number; lat: number }; isMoving(): boolean; jumpTo(o: unknown): void; getPaintProperty(id: string, p: string): unknown }
const map = (page: Page) => page.evaluate(() => { const m = (document.querySelector('.globe-map') as unknown as { __map: MapLike }).__map; return { z: m.getZoom(), lng: m.getCenter().lng, lat: m.getCenter().lat, moving: m.isMoving() }; });

/** The `status 200` rules of web/redirects.json, as a static host applies them: the file wins, then the first matching rewrite. */
function rewrites(): { from: string; to: string }[] {
  const rules = JSON.parse(readFileSync(path.join(SITE, '..', 'web', 'redirects.json'), 'utf8')) as { from: string; to: string; status: number }[];
  return rules.filter((r) => r.status === 200);
}

/** A static server over .site with the rewrites applied (python's http.server answers 404 for a level with no file). */
async function serveWithRewrites(dir: string): Promise<{ url: string; stop: () => void }> {
  const rules = rewrites();
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.png': 'image/png' };
  const file = (p: string): string | null => {
    const f = path.join(dir, decodeURIComponent(p));
    if (!f.startsWith(dir) || !existsSync(f)) return null;
    return statSync(f).isDirectory() ? (existsSync(path.join(f, 'index.html')) ? path.join(f, 'index.html') : null) : f;
  };
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;
    let f = file(pathname);
    let status = 200;
    if (!f) {
      const rule = rules.find((r) => (r.from.endsWith('*') ? pathname.startsWith(r.from.slice(0, -1)) : pathname === r.from));
      f = rule ? file(rule.to) : null;
    }
    if (!f) { f = file('/404.html'); status = 404; }
    res.writeHead(status, { 'content-type': types[path.extname(f ?? '')] ?? 'application/octet-stream' });
    if (f) createReadStream(f).pipe(res); else res.end();
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, stop: () => server.close() };
}

const contrast = (fg: [number, number, number], bg: [number, number, number]): number => {
  const lum = (c: [number, number, number]) => { const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const a = lum(fg), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

test.describe('globe stage 4 (GPU, real tiles)', () => {
  test.skip(!existsSync(CHROME), 'no GPU Chromium at GPU_CHROME');
  test.setTimeout(180_000);
  let browser: Browser;
  test.beforeAll(async () => { if (existsSync(CHROME)) browser = await chromium.launch({ executablePath: CHROME, args: ARGS }); });
  test.afterAll(async () => { await browser?.close(); });

  async function open(url: string, o: { w?: number; h?: number; dark?: boolean } = {}): Promise<Page> {
    const w = o.w ?? 1440, h = o.h ?? 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 900 || h < 500, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.addInitScript(([dark]) => {
      localStorage.setItem('travel:v1:globe', JSON.stringify({ spin: false }));
      if (dark) localStorage.setItem('travel:v1:theme', 'dark');
    }, [!!o.dark]);
    await page.goto(url);
    return page;
  }
  const painted = (page: Page) => page.waitForFunction(() => document.querySelector('.globe-canvas')?.getAttribute('data-painted') === 'true', null, { timeout: 60_000 });
  const rest = async (page: Page, ms = 2500) => { await expect.poll(async () => !(await map(page)).moving, { timeout: 40_000 }).toBe(true); await page.waitForTimeout(ms); };

  // ---- S2: a level with no file reloads under the host's /globe/* rewrite ---------------------------------------------------
  test('the /globe/* rewrite is in redirects.json, last among the globe rules, and every level URL the UI reaches reloads under it (S2)', async () => {
    const rules = rewrites();
    expect(rules.some((r) => r.from === '/globe/*' && r.to === '/globe/'), 'the rewrite rule').toBe(true);
    const srv = await serveWithRewrites(SITE);
    try {
      // a country with places, a state, a district, a country with no places at all, and a state nobody has saved anything in
      for (const [url, crumb] of [['/globe/ca/ontario/', /Ontario/], ['/globe/gb/', /United Kingdom/], ['/globe/br/', /Brazil/], ['/globe/ca/nunavut/', /Nunavut/]] as const) {
        const res = await fetch(`${srv.url}${url}`);
        expect(res.status, `${url} answers 200 through the rewrite`).toBe(200);
        const page = await open(`${srv.url}${url}`);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await painted(page);
        await expect(page.getByRole('navigation', { name: 'Globe level' })).toContainText(crumb, { timeout: 30_000 });
        await expect(page.locator('.globe-panel')).toBeVisible();
        expect(errors, url).toEqual([]);
        await page.context().close();
      }
    } finally { srv.stop(); }
  });

  // ---- S1: the panel lists only what is inside the level --------------------------------------------------------------------
  test('Ontario lists its own trip and not the Rockies; Alberta the reverse; a country with nothing shows the empty-state card (S1, P1, T5)', async () => {
    const srv = await serveWithRewrites(SITE);
    try {
      let page = await open(`${srv.url}/globe/ca/ontario/`);
      await painted(page);
      const panel = page.locator('.globe-panel');
      await expect(panel).toContainText('Algonquin', { timeout: 30_000 });
      await expect(panel).not.toContainText('Canadian Rockies');
      await expect(panel).not.toContainText(/Québec|Quebec/);
      await page.context().close();
      page = await open(`${srv.url}/globe/ca/alberta/`);
      await painted(page);
      await expect(page.locator('.globe-panel')).toContainText('Canadian Rockies', { timeout: 30_000 });
      await expect(page.locator('.globe-panel')).not.toContainText('Algonquin');
      await page.context().close();
      page = await open(`${srv.url}/globe/gb/`);
      await painted(page);
      await expect(page.locator('.globe-country-card')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.globe-status')).toHaveCount(0); // no "could not be loaded" for a country with no pins file
      await page.context().close();
    } finally { srv.stop(); }
  });

  // ---- S5: an approximate pin frames its district ----------------------------------------------------------------------
  test('an approximate place (Lago di Braies) frames its district, and the crumb and the camera agree (S5, T5)', async ({ site }) => {
    const page = await open(`${site.url}/globe/place/lago-di-braies/`);
    await painted(page);
    await expect(page.locator('.globe-card')).toBeVisible({ timeout: 60_000 });
    await rest(page);
    const m = await map(page);
    await expect(page.getByRole('navigation', { name: 'Globe level' })).toContainText('Braies');
    expect(m.z, 'a district, not the whole country (the country box stops at zoom 6)').toBeGreaterThan(7.5);
    expect(Math.abs(m.lng - 12.08), 'centred on South Tyrol, not on Italy').toBeLessThan(1.2);
    expect(Math.abs(m.lat - 46.7), 'centred on South Tyrol, not on Italy').toBeLessThan(1.2);
    await page.context().close();
  });

  // ---- S10: the card photo is the 640 rendition ------------------------------------------------------------------------------
  test('a card photo asks for the 320 and 640 renditions only, never the 960 (S10, P8)', async ({ site }) => {
    const page = await open(`${site.url}/globe/place/lago-di-braies/`, { w: 1440, h: 900 });
    await painted(page);
    const img = page.locator('.globe-card-photo img').first();
    await expect(img).toBeVisible({ timeout: 60_000 });
    const [src, srcset] = await img.evaluate((el: HTMLImageElement) => [el.getAttribute('src') ?? '', el.getAttribute('srcset') ?? '']);
    expect(src).toMatch(/640/);
    expect(srcset).not.toMatch(/960/);
    expect(srcset).toMatch(/320w/);
    await page.context().close();
  });

  // ---- S3 / S9 / 4.5: no overlap at any size, on the real layout ------------------------------------------------------------
  const BOXES: Record<string, string> = { search: '.globe-search', crumbs: '.globe-crumbs', rail: '.globe-zoom', options: '.globe-card-pill, .globe-options-btn', attrib: '.maplibregl-ctrl-attrib', scale: '.maplibregl-ctrl-scale', card: '.globe-card-sheet, .globe-card-dock, .globe-card-anchor .globe-card', panel: '.globe-panel' };
  const collisions = (page: Page) => page.evaluate((boxes) => {
    const rect = new Map<string, DOMRect>();
    for (const [k, sel] of Object.entries(boxes)) {
      const el = [...document.querySelectorAll(sel)].find((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !(e as HTMLElement).hidden; });
      if (el) rect.set(k, el.getBoundingClientRect());
    }
    const out: string[] = [];
    const keys = [...rect.keys()];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = rect.get(keys[i])!, b = rect.get(keys[j])!;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 1 && h > 1) out.push(`${keys[i]} x ${keys[j]} ${Math.round(w)}x${Math.round(h)}`);
    }
    return out;
  }, BOXES);
  for (const [w, h] of VIEWPORTS) {
    test(`the card, crumb, search, rail, options, attribution and scale bar do not overlap at ${w}x${h} (S3, S9)`, async ({ site }) => {
      const page = await open(`${site.url}/globe/place/adolf-munkel-weg/`, { w, h });
      await painted(page);
      await expect(page.locator('.globe-card').first()).toBeVisible({ timeout: 60_000 });
      await rest(page, 3000);
      expect(await collisions(page)).toEqual([]);
      await page.context().close();
    });
  }

  // ---- S8: immersive is full screen ----------------------------------------------------------------------------------------
  test('immersive mode takes the whole viewport: no site header, the globe from the top edge to the bottom (S8)', async ({ site }) => {
    const page = await open(`${site.url}/globe/`);
    await painted(page);
    await page.keyboard.press('.');
    await expect(page.locator('.globe-root')).toHaveAttribute('data-immersive', 'true');
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => { const b = document.querySelector('.globe-root')!.getBoundingClientRect(); const h = document.querySelector('.site-header')?.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, height: b.height, vh: innerHeight, header: h && h.height > 0 && getComputedStyle(document.querySelector('.site-header')!).display !== 'none' }; });
    expect(r.top).toBe(0);
    expect(Math.round(r.height)).toBe(r.vh);
    expect(r.header, 'the site header is gone').toBeFalsy();
    await page.keyboard.press('Escape');
    await expect(page.locator('.globe-root')).not.toHaveAttribute('data-immersive', 'true');
    expect(await page.evaluate(() => document.querySelector('.globe-root')!.getBoundingClientRect().top)).toBeGreaterThan(40);
    await page.context().close();
  });

  // ---- S4: the home cover ---------------------------------------------------------------------------------------------------
  test('home cover: no two discs overlap, and the attribution reads at 4.5:1 in dark (S4)', async ({ site }) => {
    const page = await open(`${site.url}/`, { dark: true });
    await page.locator('.globe-cover [data-globe-pin]').first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2500);
    const discs = await page.evaluate(() => [...document.querySelectorAll('.globe-cover [data-globe-pin]')].filter((e) => getComputedStyle(e).visibility !== 'hidden').map((e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.width / 2, t: e.textContent }; }));
    expect(discs.length).toBeGreaterThan(2);
    for (let i = 0; i < discs.length; i++) for (let j = i + 1; j < discs.length; j++) {
      expect(discs[i].r + discs[j].r - Math.hypot(discs[i].x - discs[j].x, discs[i].y - discs[j].y), `discs ${discs[i].t} and ${discs[j].t}`).toBeLessThanOrEqual(0.5);
    }
    const colours = await page.evaluate(() => {
      const el = document.querySelector('.globe-cover .maplibregl-ctrl-attrib a, .globe-cover .maplibregl-ctrl-attrib') as HTMLElement;
      const box = document.querySelector('.globe-cover .maplibregl-ctrl-attrib') as HTMLElement;
      const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number);
      return { fg: rgb(getComputedStyle(el).color), bg: rgb(getComputedStyle(box).backgroundColor), page: rgb(getComputedStyle(document.body).backgroundColor) };
    });
    const a = colours.bg[3] ?? 1;
    const bg = [0, 1, 2].map((i) => colours.bg[i] * a + colours.page[i] * (1 - a)) as [number, number, number];
    expect(contrast(colours.fg.slice(0, 3) as [number, number, number], bg)).toBeGreaterThanOrEqual(4.5);
    await page.context().close();
  });

  // ---- 3.3b: the south pole is land in Relief, not an ocean-coloured hole ---------------------------------------------------------
  test('Relief draws the south pole as Antarctic land, not an ocean-coloured disc (3.3b)', async ({ site }) => {
    const page = await open(`${site.url}/globe/`);
    await page.addInitScript(() => localStorage.setItem('travel:v1:globe', JSON.stringify({ spin: false, style: 'relief' })));
    await page.reload();
    await painted(page);
    await page.waitForTimeout(3000);
    const at = await page.evaluate(() => {
      const m = (document.querySelector('.globe-map') as unknown as { __map: MapLike & { project(c: [number, number]): { x: number; y: number } } }).__map;
      m.jumpTo({ center: [0, -60], zoom: 1.9, pitch: 0 });
      const p = m.project([0, -90]);
      const r = document.querySelector('.globe-map')!.getBoundingClientRect();
      return { x: Math.round(r.left + p.x), y: Math.round(r.top + p.y) };
    });
    await page.waitForTimeout(5000);
    expect(at.y, 'the pole is on screen at this camera').toBeLessThan(880);
    const shot = await page.screenshot({ clip: { x: at.x - 4, y: at.y - 4, width: 8, height: 8 } });
    const { data } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    const [r, g, b] = [data[0], data[1], data[2]];
    // Relief land is a warm cream (blue below red); the sea is blue (blue above red): the old hole read (169, 196, 211)
    expect(b, `pole pixel rgb(${r} ${g} ${b})`).toBeLessThan(r);
    await page.context().close();
  });
});
