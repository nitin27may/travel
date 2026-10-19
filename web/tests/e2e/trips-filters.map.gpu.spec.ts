import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { expect, test } from './fixtures';

// Trips map clusters re-form after every camera move (L3b round 5, R1). On the real GPU with real tiles, like the globe deep-link spec;
// skips without the Arc-GPU Chromium or a network.
const CHROME = process.env.GPU_CHROME ?? path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
const ARGS = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const zoomOf = (url: string) => Number((new URL(url).searchParams.get('c') ?? '').split(',')[2] ?? 'NaN');

test.describe('trips map re-clusters after the camera moves (GPU, real tiles)', () => {
  test.skip(!existsSync(CHROME), 'no GPU Chromium at GPU_CHROME');
  test.setTimeout(120_000);
  let browser: Browser;
  test.beforeAll(async () => {
    if (existsSync(CHROME)) browser = await chromium.launch({ executablePath: CHROME, args: ARGS });
  });
  test.afterAll(async () => { await browser?.close(); });

  test('a cluster click flies in, writes c=, and the members become separate pins', async ({ site }) => {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto(`${site.url}/trips/?view=map`);
    const clusters = page.locator('[data-pin-id^="cluster:"]');
    await expect(clusters.first()).toBeAttached({ timeout: 45_000 });
    const before = await page.locator('[data-pin-id]').count();
    const id = (await clusters.first().getAttribute('data-pin-id'))!;
    await clusters.first().dispatchEvent('click');
    // the camera lands and is reported: the address bar gains c=, and the cluster is gone or smaller
    await expect.poll(() => zoomOf(page.url()), { timeout: 45_000, intervals: [500] }).toBeGreaterThan(2);
    await expect.poll(async () => (await page.locator(`[data-pin-id="${id}"]`).count()) === 0 || (await page.locator('[data-pin-id]').count()) > before, { timeout: 30_000, intervals: [500] }).toBe(true);
    expect(await page.locator('[data-pin-id]').count()).toBeGreaterThanOrEqual(before);
  });

  test('the five trips that had no base now have a sourced pin, so none is an area-only ring and none is spread by hand (3.41)', async ({ site }) => {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto(`${site.url}/trips/?view=map`);
    await expect(page.locator('[data-pin-id]').first()).toBeAttached({ timeout: 45_000 });
    await expect(page.locator('[data-pin-id][aria-label*="area only" i]')).toHaveCount(0);
    const members = await page.locator('[data-pin-id^="cluster:"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.textContent ?? ''));
    for (const m of members) expect(m).not.toMatch(/area only/i);
  });
});
