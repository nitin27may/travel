import { expect, test } from './fixtures';

// Backlog 2.40: the Places and Trips tables scroll sideways inside their frame, keep the first column in view, show an edge
// cue while columns wait to the right, and never cut a label short.
for (const [name, url] of [['places', '/places/?view=table'], ['trips', '/trips/?view=table']] as const) {
  test.describe(`${name} table at 390`, () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('scrolls to the last column with a sticky first column and a cue that goes away at the end', async ({ page, site }) => {
      await page.goto(`${site.url}${url}`);
      const frame = page.locator('.table-frame');
      const scroller = page.locator('.table-scroll');
      await expect(scroller).toBeVisible();

      // columns wait to the right: the cue shows
      await expect(frame).toHaveAttribute('data-more', 'true');
      await expect(page.locator('.table-hint')).toBeVisible();
      const heads = page.locator('.data-table thead th');
      expect(await heads.count()).toBeGreaterThan(3);

      // the page itself never scrolls sideways
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

      const firstHead = heads.first();
      const x0 = (await firstHead.boundingBox())!.x;
      await scroller.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      await expect(frame).not.toHaveAttribute('data-more', 'true');
      await expect(frame).toHaveAttribute('data-scrolled', 'true');

      // the last column's header is inside the frame, and the first column has not moved
      const box = (await scroller.boundingBox())!;
      const last = (await heads.last().boundingBox())!;
      expect(last.x + last.width).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(last.x).toBeGreaterThanOrEqual(box.x - 1);
      const x1 = (await firstHead.boundingBox())!.x;
      expect(Math.abs(x1 - x0)).toBeLessThanOrEqual(1);
      const firstCell = page.locator('.data-table tbody tr[data-row] td').first();
      expect(Math.abs((await firstCell.boundingBox())!.x - box.x)).toBeLessThanOrEqual(3);
    });

    test('no cell is cut short: text wraps instead of ending in an ellipsis', async ({ page, site }) => {
      await page.goto(`${site.url}${url}`);
      await expect(page.locator('.data-table tbody tr[data-row]').first()).toBeVisible();
      const cut = await page.evaluate(() => {
        const bad: string[] = [];
        for (const td of document.querySelectorAll<HTMLElement>('.data-table tbody td')) {
          const cs = getComputedStyle(td);
          if (cs.textOverflow === 'ellipsis' || cs.whiteSpace === 'nowrap' || cs.overflow === 'hidden') bad.push(td.textContent ?? '');
          else if (td.scrollWidth > td.clientWidth + 1) bad.push(td.textContent ?? '');
        }
        return bad.slice(0, 5);
      });
      expect(cut).toEqual([]);
    });
  });
}
