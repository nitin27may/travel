import { test } from './fixtures';
import { shoot } from './shots';

// Writes test-results/shots/S1b/<name>-<width>-<theme>.png (and 1600 px tiles) for the verifier and the design review.
const LANE = 'S1b';
const PAGES: [string, string][] = [
  ['lake-louise', '/places/lake-louise/'],
  ['larch-valley', '/places/larch-valley-to-sentinel-pass/'],
  ['moraine-lakeshore', '/places/moraine-lakeshore/'],
  ['trail-bald-hills', '/places/bald-hills/'],
  ['viewpoint-peyto', '/places/peyto-lake-lookout/'],
  ['culture-otzi', '/places/otzi-south-tyrol-museum-of-archaeology/'],
  ['waterfall-takakkaw', '/places/takakkaw-falls-walk/'],
  ['town-bolzano', '/places/bolzano/'],
  ['area-capri', '/places/capri/'],
  ['lift-lagazuoi', '/places/lagazuoi-cable-car-and-tunnels/'],
  ['places-cards', '/places/?q=lake'],
];

test.describe('S1b screenshots', () => {
  test.setTimeout(900_000);
  for (const [name, url] of PAGES) {
    test(name, async ({ browser, site }) => {
      await shoot(browser, site.url, LANE, name, url, { fullPage: name !== 'places-cards', tile: true });
    });
  }
  test('timeline entries', async ({ browser, site }) => {
    await shoot(browser, site.url, LANE, 'day5-default', '/trips/canadian-rockies-2029/#day-5');
    await shoot(browser, site.url, LANE, 'day5-family3', '/trips/canadian-rockies-2029/?p=family-3#day-5');
  });
});
