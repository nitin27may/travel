import { expect, test } from './fixtures';
import sharp from 'sharp';

// Backlog 3.65: a faint ring stayed at the south pole, where the sea box (to -85) showed through the chords of Antarctica's polar ring.
// Real GPU, real tiles. The polar cap must be one flat colour: no step between neighbouring pixels above a few grey levels.
test.use({ allowRemote: true });
test.setTimeout(90_000);

test('the south pole shows no ring', async ({ page, site }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('travel:v1:globe', JSON.stringify({ spin: false })));
  await page.goto(`${site.url}/globe/?c=0,-80,2.6,0,0`);
  await expect(page.locator('.globe-map canvas')).toBeVisible();
  await page.waitForTimeout(9000);
  const buf = await page.screenshot({ clip: { x: 560, y: 730, width: 340, height: 120 } });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, c = info.channels;
  let step = 0;
  for (let y = 0; y < info.height - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = (y * w + x) * c;
    step = Math.max(step, Math.abs(data[i] - data[i + c]), Math.abs(data[i] - data[i + w * c]));
  }
  expect(step, 'the largest step between neighbouring pixels in the cap').toBeLessThan(8);
});
