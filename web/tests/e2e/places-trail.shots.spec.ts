import { test } from './fixtures';
import { shoot } from './shots';

// Writes test-results/shots/L4b/<name>-<width>-<theme>.png (and 1600 px tiles) for the verifier.
const LANE = 'L4b';

test.describe('trail screenshots (L4b)', () => {
  test.setTimeout(480_000);

  for (const [name, url] of [
    ['sorapis-confirmed', '/places/lago-di-sorapis/'],
    ['tre-cime-segments', '/places/tre-cime-di-lavaredo-loop/'],
    ['fanes-dashed', '/places/cascate-di-fanes/'],
    ['rockies-no-track', '/places/larch-valley-to-sentinel-pass/'],
    ['rockies-with-point', '/places/bourgeau-lake/'],
    ['wilcox-pass', '/places/wilcox-pass/'],
  ] as const) {
    test(name, async ({ browser, site }) => {
      await shoot(browser, site.url, LANE, name, url, { fullPage: true, tile: true });
    });
  }

  test('sorapis profile mid-scrub', async ({ browser, site }) => {
    await shoot(browser, site.url, LANE, 'sorapis-scrub', '/places/lago-di-sorapis/', {
      prepare: async (page) => {
        await page.waitForLoadState('networkidle');
        const svg = page.getByRole('img', { name: /Elevation profile along the stored route/ });
        await svg.scrollIntoViewIfNeeded();
        const box = await svg.boundingBox();
        await page.mouse.move((box?.x ?? 0) + 10, (box?.y ?? 0) + 10);
        await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.55, (box?.y ?? 0) + (box?.height ?? 0) * 0.5, { steps: 6 });
        await page.waitForTimeout(400);
      },
    });
  });

  test('fanes export menu', async ({ browser, site }) => {
    await shoot(browser, site.url, LANE, 'fanes-export', '/places/cascate-di-fanes/', {
      prepare: async (page) => {
        await page.getByRole('button', { name: /Export/ }).click();
        await page.waitForTimeout(300);
      },
    });
  });
});
