import { expect, test } from '@playwright/test';
import { shoot } from './shots';

// Writes test-results/shots/L3/<name>-<width>-<theme>.png (and 1600 px tiles for the tall pages).
// Needs a running site: TRIPS_SHOT_URL=http://127.0.0.1:3413 (dev server) or a served `web/out`.
const BASE = process.env.TRIPS_SHOT_URL;
const LANE = 'L3';

test.describe('trips screenshots', () => {
  test.skip(!BASE, 'set TRIPS_SHOT_URL to a running site');
  test.setTimeout(480_000);

  const pages: [string, string, { fullPage?: boolean; tile?: boolean }?][] = [
    ['trips-cards', '/trips/'],
    ['trips-cards-filtered', '/trips/?country=IT,CA&kid=8&sort=nights&dir=desc'],
    ['trips-list', '/trips/?view=list&group=country'],
    ['trips-table', '/trips/?view=table'],
    ['trips-map', '/trips/?view=map'],
    ['dolomites', '/trips/dolomites-2027/', { fullPage: true, tile: true }],
    ['dolomites-category', '/trips/dolomites-2027/?view=category#trails', { fullPage: true, tile: true }],
    ['rockies-day5', '/trips/canadian-rockies-2029/#day-5', { fullPage: true, tile: true }],
    ['patagonia', '/trips/patagonia-2027/', { fullPage: true, tile: true }],
    ['vermont-done', '/trips/vermont-fall-2026/', { fullPage: true, tile: true }],
    ['switzerland', '/trips/switzerland-2027/', { fullPage: true, tile: true }],
  ];
  for (const [name, url, opts] of pages) {
    test(name, async ({ browser }) => {
      const written = await shoot(browser, BASE as string, LANE, name, url, {
        ...opts,
        prepare: async (page) => {
          await page.waitForTimeout(name.includes('map') || name.includes('day') || name === 'dolomites' ? 6000 : 800);
        },
      });
      expect(written.length).toBeGreaterThan(0);
    });
  }

  test('dolomites day 3 expanded', async ({ browser }) => {
    await shoot(browser, BASE as string, LANE, 'dolomites-day3', '/trips/dolomites-2027/#day-3', { prepare: async (page) => page.waitForTimeout(6000) });
  });
});
