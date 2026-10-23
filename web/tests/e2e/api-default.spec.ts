import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// API-1b acceptance: by default the browser reads catalogue data from /api/v1/, never from the build's data files. The static files stay
// for the StaticAdapter build (NEXT_PUBLIC_DATA_ADAPTER=static) and are not read here. Reference geography under /globe/ (Natural Earth,
// OSM) is not catalogue data and is not counted.
const FILE_READ = /^\/(?:list|globe-data|search)\//;
const API = /^\/api\/v1\//;

test.setTimeout(150_000);

function recorder(page: Page) {
  const seen: string[] = [];
  page.on('request', (r) => {
    if (!['fetch', 'xhr'].includes(r.resourceType())) return;
    const u = new URL(r.url());
    seen.push(`${u.pathname}${u.search}`);
  });
  return {
    api: () => seen.filter((p) => API.test(p)),
    files: () => seen.filter((p) => FILE_READ.test(p)),
    all: () => [...seen],
  };
}

test.describe('reads go to /api/v1/ by default', () => {
  test('home: the search reads the API, not the search files', async ({ page, site }) => {
    const rec = recorder(page);
    await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.locator('main .home-search').click();
      try {
        await expect(page.getByRole('search', { name: 'Search trips, places and areas' })).toBeVisible({ timeout: 10_000 });
        break;
      } catch {
        // not hydrated yet: press again
      }
    }
    await page.getByRole('combobox').fill('dolomites');
    await expect.poll(() => rec.api().some((p) => p.startsWith('/api/v1/search/'))).toBe(true);
    expect(rec.files()).toEqual([]);
  });

  test('trips and a trip: no data file is read; the trip page asks the API for its export', async ({ page, site }) => {
    const rec = recorder(page);
    await page.goto(`${site.url}/trips/`, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-entity-id], .entity-card, article').first()).toBeVisible();
    await page.goto(`${site.url}/trips/dolomites-2027/`, { waitUntil: 'networkidle' });
    await expect.poll(() => rec.api().some((p) => p.startsWith('/api/v1/export/trip/dolomites-2027/'))).toBe(true);
    expect(rec.files()).toEqual([]);
  });

  test('places with filters: the rows of the country come from /api/v1/places', async ({ page, site }) => {
    const rec = recorder(page);
    await page.goto(`${site.url}/places/?country=IT&kind=trail`, { waitUntil: 'networkidle' });
    await expect(page.locator('main')).toContainText(/places?/i);
    await expect.poll(() => rec.api().some((p) => /^\/api\/v1\/places\/\?.*country=IT/.test(p))).toBe(true);
    expect(rec.files()).toEqual([]);
  });

  test('a parse is counted by the API: the header search asks /api/v1/places/counts with the parse, not the browser', async ({ page, site }) => {
    const rec = recorder(page);
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.getByRole('button', { name: 'Search' }).first().click();
      try {
        await expect(page.getByRole('combobox', { name: 'Search trips, places and areas' })).toBeFocused({ timeout: 10_000 });
        break;
      } catch {
        // not hydrated yet: press again
      }
    }
    await page.getByRole('combobox', { name: 'Search trips, places and areas' }).fill('hot springs in Iceland');
    await expect.poll(() => rec.api().some((p) => p.startsWith('/api/v1/places/counts/') && p.includes('parsed.'))).toBe(true);
    expect(rec.files()).toEqual([]);
  });

  test('"not checked yet" rows come from the API: a Kids filter asks /api/v1/places/unchecked', async ({ page, site }) => {
    const rec = recorder(page);
    await page.goto(`${site.url}/places/?kid=yes`, { waitUntil: 'networkidle' });
    await expect(page.locator('.filter-bar .count-more')).toContainText(/\d+ not checked yet/);
    await expect.poll(() => rec.api().some((p) => p.startsWith('/api/v1/places/unchecked/') && p.includes('kid=yes'))).toBe(true);
    expect(rec.files()).toEqual([]);
  });

  test('a sentence search ranks the cards on the API: words no name holds ask /api/v1/places/cards, not the full-text files', async ({ page, site }) => {
    const rec = recorder(page);
    await page.goto(`${site.url}/places/?q=turquoise`, { waitUntil: 'networkidle' });
    await expect(page.locator('main')).toContainText(/matched on descriptions/);
    await expect.poll(() => rec.api().some((p) => p.startsWith('/api/v1/places/cards/') && p.includes('q=turquoise'))).toBe(true);
    // the full-text files live under /search/text/: none is read
    expect(rec.files()).toEqual([]);
  });

  test('a place: no data file is read', async ({ page, site }) => {
    const rec = recorder(page);
    await page.goto(`${site.url}/places/lago-di-limides/`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(rec.files()).toEqual([]);
  });

  test('the globe: the tree, the pins of a country and a card come from /api/v1/globe', async ({ page, site }) => {
    const rec = recorder(page);
    await page.goto(`${site.url}/globe/it/`, { waitUntil: 'networkidle' });
    await expect.poll(() => rec.api().some((p) => p.startsWith('/api/v1/globe/tree/'))).toBe(true);
    await expect.poll(() => rec.api().some((p) => p.startsWith('/api/v1/globe/pins/'))).toBe(true);
    expect(rec.files()).toEqual([]);
  });

  test('an export: the file is built from one item the API returned', async ({ page, site }) => {
    const rec = recorder(page);
    await page.goto(`${site.url}/specimen/`, { waitUntil: 'networkidle' });
    await expect.poll(() => rec.api().some((p) => p.startsWith('/api/v1/export/trip/'))).toBe(true);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const [gpx] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^GPX/ }).click()]);
    expect(gpx.suggestedFilename()).toBe('dolomites-2027.gpx');
    expect(rec.files()).toEqual([]);
  });
});
