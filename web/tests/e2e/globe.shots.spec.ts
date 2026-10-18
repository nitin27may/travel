import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from './fixtures';
import { SIZES, THEMES, setTheme, shotPath } from './shots';

// Screenshots of the globe with real tiles, so it needs the network and a GL-capable Chromium. Off by default:
//   GLOBE_SHOTS=1 pnpm --dir web e2e tests/e2e/globe.shots.spec.ts
// Writes test-results/shots/L2/<name>-<width>-<theme>.png and a fly-in frame sequence.
const LANE = 'L2';
const CHROME = path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

test.describe('globe screenshots', () => {
  test.skip(!process.env.GLOBE_SHOTS, 'set GLOBE_SHOTS=1 (needs network for tiles)');
  test.setTimeout(900_000);

  const scenes: { name: string; url: string; wait?: number; prepare?: (page: import('@playwright/test').Page, phone: boolean) => Promise<void> }[] = [
    { name: 'world', url: '/globe/', wait: 9000 },
    { name: 'italy', url: '/globe/it/', wait: 14000 },
    { name: 'south-tyrol', url: '/globe/it/south-tyrol/', wait: 14000 },
    { name: 'place', url: '/globe/place/lago-di-braies/', wait: 15000 },
    { name: 'trip', url: '/globe/trip/dolomites-2027/', wait: 15000 },
    {
      name: 'options', url: '/globe/', wait: 9000,
      prepare: async (page, phone) => { if (phone) { await page.getByRole('button', { name: 'Map options' }).click(); await page.waitForTimeout(800); } },
    },
  ];

  test('scenes at both sizes in both themes', async ({ site }) => {
    const browser = await chromium.launch({ executablePath: CHROME, args: ARGS });
    for (const theme of THEMES) {
      for (const size of SIZES) {
        for (const sc of scenes) {
          const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'en-CA' });
          const page = await ctx.newPage();
          await setTheme(page, theme);
          // spin paused so the world shot is steady
          await page.addInitScript(() => { try { localStorage.setItem('travel:v1:globe', JSON.stringify({ spin: false })); } catch { /* none */ } });
          await page.goto(`${site.url}${sc.url}`, { waitUntil: 'load' });
          await page.waitForTimeout(sc.wait ?? 9000);
          await sc.prepare?.(page, size.width < 500);
          const file = shotPath(LANE, sc.name, size.width, theme);
          mkdirSync(path.dirname(file), { recursive: true });
          await page.screenshot({ path: file });
          await ctx.close();
        }
      }
    }
    await browser.close();
  });

  test('fly-in frame sequence: world to Italy', async ({ site }) => {
    const browser = await chromium.launch({ executablePath: CHROME, args: ARGS });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-CA' });
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('travel:v1:globe', JSON.stringify({ spin: false })); } catch { /* none */ } });
    await page.goto(`${site.url}/globe/`, { waitUntil: 'load' });
    await page.waitForTimeout(9000);
    await page.locator('.globe-panel').getByRole('button', { name: /Italy/ }).click();
    const dir = path.join(path.dirname(shotPath(LANE, 'x', 1440, 'light')), 'flyin');
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 8; i++) {
      await page.screenshot({ path: path.join(dir, `frame-${String(i).padStart(2, '0')}.png`) });
      await page.waitForTimeout(250);
    }
    await browser.close();
  });
});
