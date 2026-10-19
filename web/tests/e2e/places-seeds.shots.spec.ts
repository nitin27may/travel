import { test } from './fixtures';
import { shoot } from './shots';

// Writes test-results/shots/L4c/<name>-<width>-<theme>.png (and 1600 px tiles) for the verifier: pages seeded from capture records (3.48).
const LANE = 'L4c';

test.use({ launchOptions: { args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } });

test.describe('seeded place screenshots', () => {
  test.setTimeout(480_000);
  for (const [name, url] of [
    ['moraine-lake', '/places/moraine-lake/'],
    ['banff-gondola', '/places/banff-gondola/'],
    ['jasper-sight', '/places/athabasca-falls/'],
    ['adventure', '/places/banff-horseback-rides/'],
    ['iceland-sight', '/places/godafoss/'],
    ['patagonia-sight', '/places/perito-moreno-walkways/'],
  ] as const) {
    test(name, async ({ browser, site }) => {
      await shoot(browser, site.url, LANE, name, url, { fullPage: true, tile: true });
    });
  }
});
