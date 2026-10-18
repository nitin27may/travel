import { test } from './fixtures';
import { shoot } from './shots';

// Writes test-results/shots/L0/<name>-<width>-<theme>.png (and 1600 px tiles for tall pages) for the verifier and for
// the side-by-side with docs/v2/design/foundation/specimen.html. The assertions are only that the pages render.
const LANE = 'L0';

test.describe('foundation screenshots', () => {
  test.setTimeout(240_000);

  test('specimen, with tiles', async ({ browser, site }) => {
    await shoot(browser, site.url, LANE, 'specimen', '/specimen/', { fullPage: true, tile: true });
  });

  for (const [name, url] of [
    ['trips', '/trips/'],
    ['places', '/places/'],
    ['places-table', '/places/?view=table'],
    ['sign-in', '/sign-in/'],
    ['not-found', '/404/'],
  ] as const) {
    test(`${name}`, async ({ browser, site }) => {
      await shoot(browser, site.url, LANE, name, url, { fullPage: false });
    });
  }

  test('open overlays: detail sheet and phone filter sheet', async ({ browser, site }) => {
    await shoot(browser, site.url, LANE, 'places-sheet', '/places/?focus=CA/AB/banff-national-park/lake-louise');
    await shoot(browser, site.url, LANE, 'specimen-side-sheet', '/specimen/', {
      prepare: async (page) => {
        await page.getByRole('button', { name: 'Open side sheet' }).click();
        await page.getByRole('dialog').waitFor();
        await page.waitForTimeout(400);
      },
    });
    await shoot(browser, site.url, LANE, 'specimen-bottom-sheet', '/specimen/', {
      prepare: async (page) => {
        await page.getByRole('button', { name: 'Open bottom sheet' }).click();
        await page.getByRole('dialog').waitFor();
        await page.waitForTimeout(600);
      },
    });
  });
});
