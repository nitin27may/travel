import { test } from './fixtures';
import { shoot } from './shots';

// Writes test-results/shots/L4/<name>-<width>-<theme>.png (and 1600 px tiles for tall pages) for the verifier.
const LANE = 'L4';

test.describe('places screenshots', () => {
  test.setTimeout(480_000);

  for (const [name, url] of [
    ['list-cards', '/places/'],
    ['list-list', '/places/?view=list'],
    ['list-table', '/places/?view=table&group=country&sort=elevation&dir=desc'],
    ['list-map', '/places/?view=map'],
  ] as const) {
    test(name, async ({ browser, site }) => {
      await shoot(browser, site.url, LANE, name, url, { fullPage: false });
    });
  }

  test('kind pill open', async ({ browser, site }) => {
    await shoot(browser, site.url, LANE, 'list-kind-menu', '/places/', {
      prepare: async (page) => {
        const phone = (page.viewportSize()?.width ?? 1440) < 640;
        await page.locator(phone ? 'button:has-text("Filters")' : '.pill-trigger:has-text("Kind")').first().click();
        await page.waitForTimeout(300);
      },
    });
  });

  test('table, compact, grouped by kind', async ({ browser, site }) => {
    await shoot(browser, site.url, LANE, 'list-table-compact', '/places/?view=table&group=kind', {
      prepare: async (page) => {
        await page.getByRole('radio', { name: 'Compact' }).click();
        await page.waitForTimeout(300);
      },
    });
  });

  for (const [name, url] of [
    ['trail-tre-cime', '/places/tre-cime-di-lavaredo-loop/'],
    ['lake-braies', '/places/lago-di-braies/'],
    ['viewpoint', '/places/cadini-di-misurina-viewpoint/'],
    ['town', '/places/bolzano/'],
    ['area', '/places/capri/'],
    ['draft-sight', '/places/million-dollar-highway/'],
    ['draft-unconfirmed', '/places/monte-piana/'],
  ] as const) {
    test(name, async ({ browser, site }) => {
      await shoot(browser, site.url, LANE, name, url, { fullPage: true, tile: true });
    });
  }

  test('trail with the profile scrubbed', async ({ browser, site }) => {
    await shoot(browser, site.url, LANE, 'trail-scrubbed', '/places/tre-cime-di-lavaredo-loop/', {
      prepare: async (page) => {
        const svg = page.getByRole('img', { name: /(Sketch of the elevation profile|Elevation profile along the stored route)/ });
        await svg.scrollIntoViewIfNeeded();
        const box = await svg.boundingBox();
        await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.55, (box?.y ?? 0) + (box?.height ?? 0) * 0.5);
        await page.waitForTimeout(200);
      },
    });
  });
});
