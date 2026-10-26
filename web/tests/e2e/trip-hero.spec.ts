import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, SITE, test } from './fixtures';
import { setTheme } from './shots';

// Backlog 4.25: a long trip title wraps inside the hero and never clips, on every trip, on a phone, in both themes.
const slugs = () => readdirSync(path.join(SITE, 'trips'), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(path.join(SITE, 'trips', d.name, 'index.html'))).map((d) => d.name);

const SIZES = [
  { width: 390, height: 844 },
  { width: 320, height: 640 },
  { width: 844, height: 390 },
];

test.describe('trip hero title (backlog 4.25)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`every trip's title is fully visible at 390, 320 and 844x390, ${theme}`, async ({ page, site }) => {
      await setTheme(page, theme);
      const list = slugs();
      expect(list.length).toBeGreaterThan(3);
      for (const size of SIZES) {
        await page.setViewportSize(size);
        for (const slug of list) {
          await page.goto(`${site.url}/trips/${slug}/`);
          const r = await page.evaluate(() => {
            const t = document.querySelector<HTMLElement>('.trip-title')!;
            const c = document.querySelector<HTMLElement>('.trip-cover')!;
            const tb = t.getBoundingClientRect();
            const cb = c.getBoundingClientRect();
            return {
              left: tb.left, right: tb.right, top: tb.top, bottom: tb.bottom, cTop: cb.top, cBottom: cb.bottom, vw: document.documentElement.clientWidth,
              wideText: t.scrollWidth > t.clientWidth + 1, coverClipped: c.scrollHeight > c.clientHeight + 1,
            };
          });
          const id = `${slug} ${size.width}x${size.height} ${theme}`;
          expect(r.left, id).toBeGreaterThanOrEqual(0);
          expect(r.right, id).toBeLessThanOrEqual(r.vw + 0.5);
          expect(r.top, `${id}: title starts inside the cover`).toBeGreaterThanOrEqual(r.cTop);
          expect(r.bottom, `${id}: title ends inside the cover`).toBeLessThanOrEqual(r.cBottom + 0.5);
          expect(r.wideText, `${id}: no word wider than the title box`).toBe(false);
          expect(r.coverClipped, `${id}: cover content is not clipped`).toBe(false);
        }
      }
    });
  }
});

// Backlog 4.23: the route map's key names the dashed line, and the label counts a stop that is not on the map.
test('the trip route key says "Straight line, not a route" and names the numbered day', async ({ page, site }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${site.url}/trips/canadian-rockies-2029/?view=day`);
  const key = page.locator('#trip-map-key-list');
  await expect(key).toContainText('Straight line, not a route');
  await expect(key).not.toContainText('Picked day');
});
