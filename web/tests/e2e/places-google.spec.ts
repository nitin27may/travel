import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, serve, test, type Server } from './fixtures';

// Builds the site once with the Google place-page family switched on and a FAKE key, then checks that the page shows
// the click-to-load facade (our points as text, links built from our coordinates) and that no MapLibre and no Google
// script has loaded (LM check 4, Google Maps Platform terms 3.2.3(e)). The fake key never reaches Google.
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = '.fixture-google';

test.describe('place page on the google-js family with a fake key', () => {
  test.setTimeout(600_000);
  let server: Server;

  test.beforeAll(async () => {
    rmSync(path.join(WEB, DIST), { recursive: true, force: true });
    const build = spawnSync(process.execPath, [path.join(WEB, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
      cwd: WEB,
      stdio: 'pipe',
      env: { ...process.env, NEXT_DIST_DIR: DIST, NEXT_PUBLIC_PLACE_MAP_FAMILY: 'google-js', NEXT_PUBLIC_GOOGLE_MAPS_KEY: 'fake-key-for-tests', HUB_TODAY: '2026-10-17' },
    });
    expect(build.status, build.stderr?.toString().slice(-800)).toBe(0);
    server = await serve(path.join(WEB, DIST));
  });
  test.afterAll(() => {
    server?.stop();
  });

  test('shows the facade, the points as text and our directions links; loads no MapLibre and no Google script', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto(`${server.url}/places/tre-cime-di-lavaredo-loop/`);
    const facade = page.locator('[data-map-family="google-js"][data-map-facade]');
    await expect(facade).toBeVisible();
    await expect(facade).toContainText('46.61285,12.29267');
    await expect(facade.getByRole('link', { name: /Directions in Google Maps/ })).toHaveAttribute('href', /destination=46\.61285,12\.29267/);
    await expect(facade.getByRole('button', { name: 'Load Google map' })).toBeVisible();
    expect(await page.locator('[data-map-family]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-map-family')))])).toEqual(['google-js']);
    expect(await page.locator('.maplibregl-canvas').count()).toBe(0);
    expect(requests.filter((u) => /maps\.googleapis\.com/.test(u))).toEqual([]);
    expect(requests.filter((u) => /maplibre|openfreemap|mapterhorn/i.test(u))).toEqual([]);
  });

  test('the list page stays on maplibre', async ({ page }) => {
    await page.goto(`${server.url}/places/?view=map`);
    await expect(page.locator('[data-map-family="maplibre"]')).toBeVisible();
  });
});
