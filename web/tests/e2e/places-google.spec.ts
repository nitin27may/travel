import { execFile } from 'node:child_process';
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
    // async, so the worker keeps answering Playwright while the build runs
    const status = await new Promise<{ code: number | null; err: string }>((resolve) => {
      const child = execFile(process.execPath, [path.join(WEB, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
        cwd: WEB,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, NEXT_DIST_DIR: DIST, NEXT_PUBLIC_PLACE_MAP_FAMILY: 'google-js', NEXT_PUBLIC_GOOGLE_MAPS_KEY: 'fake-key-for-tests', NEXT_PUBLIC_GOOGLE_MAP_ID: '', HUB_TODAY: '2026-10-17' },
      }, (_e, _out, err) => resolve({ code: child.exitCode, err: String(err).slice(-800) }));
    });
    expect(status.code, status.err).toBe(0);
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

  test('click loads the Maps script once with the key and nothing else; a refused script leaves the points and links', async ({ page }) => {
    const google: string[] = [];
    page.on('request', (r) => { if (/googleapis\.com|gstatic\.com|google\.com\/maps/.test(r.url())) google.push(r.url()); });
    await page.goto(`${server.url}/places/tre-cime-di-lavaredo-loop/`);
    const facade = page.locator('[data-map-family="google-js"][data-map-facade]');
    await facade.getByRole('button', { name: 'Load Google map' }).click();
    // the harness blocks every remote host, so the script is refused: the page must say so and keep the text points and links
    await expect(page.getByRole('alert').filter({ hasText: 'could not be loaded' })).toBeVisible();
    expect(google).toHaveLength(1);
    const u = new URL(google[0]);
    expect(u.origin + u.pathname).toBe('https://maps.googleapis.com/maps/api/js');
    expect(u.searchParams.get('key')).toBe('fake-key-for-tests');
    await expect(facade.getByRole('link', { name: /Directions in Google Maps/ })).toBeVisible();
    await expect(facade).toContainText('46.61285,12.29267');
    await expect(facade.getByRole('button', { name: 'Load Google map' })).toBeEnabled();
  });

  test('the list page stays on maplibre', async ({ page }) => {
    await page.goto(`${server.url}/places/?view=map`);
    await expect(page.locator('[data-map-family="maplibre"]')).toBeVisible();
  });
});
