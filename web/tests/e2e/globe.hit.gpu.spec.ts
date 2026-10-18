import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { expect, test } from './fixtures';

// A search hit for a range or sea opens the globe at its camera with a named marker (`?c=` and `?m=`). Needs the GPU Chromium.
const CHROME = process.env.GPU_CHROME ?? path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');

test.describe('globe search-hit marker (GPU)', () => {
  test.skip(!existsSync(CHROME), 'no GPU Chromium at GPU_CHROME');
  test.setTimeout(90_000);
  let browser: Browser;
  test.beforeAll(async () => {
    if (!existsSync(CHROME)) return;
    browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  });
  test.afterAll(async () => { await browser?.close(); });

  test('the header search sends "alps" to the range, framed, with a marker that keeps its name', async ({ site }) => {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto(`${site.url}/about/data/`);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('combobox').fill('alps');
    await expect(page.getByRole('option').first()).toContainText('Alps');
    await page.keyboard.press('Enter');
    await expect(page.locator('.globe-hit-pin')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.globe-hit-label')).toHaveText('Alps');
    await expect.poll(() => new URL(page.url()).searchParams.get('c')?.split(',').map(Number)[2] ?? 0, { timeout: 30_000 }).toBeGreaterThanOrEqual(4);
    expect(new URL(page.url()).searchParams.get('m')).toBe('Alps');
    await page.context().close();
  });
});
