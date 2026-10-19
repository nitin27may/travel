import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Deep links frame their area (backlog 2.29): the camera is checked on the real GPU with real tiles, because the
// regression lived in the first style load, which the tile-blocked specs never reach. Runs only on the chromium project,
// on a machine with the Arc-GPU Chromium and network; otherwise it skips.
const CHROME = process.env.GPU_CHROME ?? path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
const ARGS = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];

const ITALY: [number, number, number, number] = [6.6, 35.5, 18.8, 47.1];
const SOUTH_TYROL: [number, number, number, number] = [10.3, 46.2, 12.5, 47.2];
const inBox = (c: { lng: number; lat: number }, b: [number, number, number, number]) => c.lng >= b[0] && c.lng <= b[2] && c.lat >= b[1] && c.lat <= b[3];
const camOf = (url: string) => {
  const raw = new URL(url).searchParams.get('c');
  if (!raw) return null;
  const [lng, lat, zoom] = raw.split(',').map(Number);
  return { lng, lat, zoom };
};

test.describe('globe deep links frame the area (GPU, real tiles)', () => {
  test.skip(!existsSync(CHROME), 'no GPU Chromium at GPU_CHROME');
  test.setTimeout(120_000);
  let browser: Browser;
  test.beforeAll(async () => {
    if (!existsSync(CHROME)) return;
    browser = await chromium.launch({ executablePath: CHROME, args: ARGS });
  });
  test.afterAll(async () => { await browser?.close(); });

  async function open(url: string): Promise<{ page: Page; writes: string[] }> {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const writes: string[] = [];
    await page.exposeFunction('__recordUrl', (u: string) => writes.push(u));
    await page.addInitScript(() => {
      const o = history.replaceState.bind(history);
      history.replaceState = (s, t, u) => { (window as unknown as { __recordUrl: (u: string) => void }).__recordUrl(String(u)); return o(s, t, u); };
    });
    await page.goto(url);
    return { page, writes };
  }
  async function framed(page: Page, atLeast: number): Promise<{ lng: number; lat: number; zoom: number }> {
    await expect.poll(() => camOf(page.url())?.zoom ?? 0, { timeout: 45_000, intervals: [500] }).toBeGreaterThanOrEqual(atLeast);
    await page.waitForTimeout(1500); // the fly may still be landing; read it again
    return camOf(page.url())!;
  }

  test('/globe/it/ lands on Italy and never writes the world camera', async ({ site }) => {
    const { page, writes } = await open(`${site.url}/globe/it/`);
    const c = await framed(page, 4);
    expect(inBox(c, ITALY), JSON.stringify(c)).toBe(true);
    for (const w of writes) {
      const cam = camOf(`http://x${w}`);
      if (cam) expect(cam.zoom, `a world camera was written: ${w}`).toBeGreaterThan(2.5);
    }
    await page.context().close();
  });

  test('/globe/it/south-tyrol/ lands on the state', async ({ site }) => {
    const { page } = await open(`${site.url}/globe/it/south-tyrol/`);
    const c = await framed(page, 7);
    expect(inBox(c, SOUTH_TYROL), JSON.stringify(c)).toBe(true);
    await page.context().close();
  });

  test('a trip deep link lands near its pin', async ({ site }) => {
    const { page } = await open(`${site.url}/globe/trip/dolomites-2027/`);
    const c = await framed(page, 6);
    expect(inBox(c, [10.0, 45.8, 13.0, 47.3]), JSON.stringify(c)).toBe(true);
    await page.context().close();
  });

  test('a country pin on the home cover opens that country framed', async ({ site }) => {
    const { page } = await open(`${site.url}/`);
    const pin = page.getByRole('link', { name: /^Italy, \d+ items/ });
    await pin.waitFor({ state: 'visible', timeout: 45_000 });
    // the cover pauses its spin while the pointer is over it: a link that keeps moving cannot be clicked
    await page.locator('.globe-cover').hover({ position: { x: 4, y: 4 } });
    await page.waitForTimeout(1200);
    await pin.click();
    await expect(page).toHaveURL(/\/globe\/it\//);
    const c = await framed(page, 4);
    expect(inBox(c, ITALY), JSON.stringify(c)).toBe(true);
    await page.context().close();
  });
});
