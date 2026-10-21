// Screenshots of the map adapter fixture. Usage:
//   cp tests/map/fixtures/MapFixture.tsx app/map-fixture-lm/page.tsx   (mkdir the folder first; remove after)
//   next dev -p 3402   (add NEXT_PUBLIC_GOOGLE_MAPS_KEY=fake-key for the facade and embed scenes)
//   node tests/map/shoot.mjs <outDir> [baseUrl] [scenes...]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const out = process.argv[2] ?? 'map-shots';
const base = process.argv[3] ?? 'http://localhost:3402';
const scenes = process.argv.slice(4).length ? process.argv.slice(4) : ['dolomites'];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
for (const scene of scenes) {
  const [name, query = ''] = scene.split('?');
  for (const theme of ['light', 'dark']) {
    for (const [sz, viewport] of Object.entries(sizes)) {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.goto(`${base}/map-fixture-lm/?scene=${name}&theme=${theme}${query ? `&${query}` : ''}`, { waitUntil: 'load' });
      await page.waitForTimeout(name === 'dolomites' || name === 'trail' ? 9000 : 2500);
      await page.screenshot({ path: path.join(out, `${scene.replace(/[?&=]/g, '_')}-${theme}-${sz}.png`) });
      await ctx.close();
    }
  }
}
await browser.close();
