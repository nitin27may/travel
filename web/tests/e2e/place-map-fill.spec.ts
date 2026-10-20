import { expect, test } from './fixtures';

// REVIEW4 4.22: the place map's canvas fills its frame, and follows the frame when the layout changes (rail beside the page, column under it).
const WIDTHS = [1440, 1024, 390];
const PAGES = ['/places/lago-di-sorapis/', '/places/moraine-lake/'];

const boxes = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const frame = document.querySelector('.map-surface') as HTMLElement | null;
    const canvas = document.querySelector('.map-surface canvas.maplibregl-canvas') as HTMLCanvasElement | null;
    if (!frame || !canvas) return null;
    const c = canvas.getBoundingClientRect();
    // the frame's border is not map: compare with the inside of the frame
    return { frameW: frame.clientWidth, frameH: frame.clientHeight, canvasW: c.width, canvasH: c.height };
  });

test.describe('place map fills its frame', () => {
  test.use({ allowRemote: true });
  for (const url of PAGES) {
    test(`${url} at 1440, 1024 and 390, and after a resize`, async ({ page, site }) => {
      await page.setViewportSize({ width: WIDTHS[0]!, height: 900 });
      await page.goto(`${site.url}${url}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.pl-mapcard').scrollIntoViewIfNeeded();
      await expect(page.locator('.map-surface canvas.maplibregl-canvas')).toBeVisible({ timeout: 20_000 });
      // 1440 first, then resize the same page down and back: the canvas must follow the frame each time
      for (const w of [...WIDTHS, 1440]) {
        await page.setViewportSize({ width: w, height: 900 });
        await expect
          .poll(async () => {
            const b = await boxes(page);
            return b ? Math.max(Math.abs(b.frameW - b.canvasW), Math.abs(b.frameH - b.canvasH)) : 999;
          }, { message: `canvas fills the frame at ${w}`, timeout: 8000 })
          .toBeLessThanOrEqual(2);
        const b = (await boxes(page))!;
        expect(b.canvasW, `canvas is not collapsed at ${w}`).toBeGreaterThan(250);
      }
    });
  }
});
