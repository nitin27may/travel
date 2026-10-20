import { expect, test } from './fixtures';

// Sweep must-fixes SW-A: privacy of the party, the Vermont map, About and icons, the terms page (backlog 2.34-2.37).

test.describe('privacy of the party (2.34)', () => {
  test('Rockies and Patagonia name who the plan suits, never who went', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/canadian-rockies-2029/`);
    const rockies = await page.locator('main').innerText();
    expect(rockies).toContain('The family version suits children from about 6');
    expect(rockies).not.toMatch(/child around|the child\b(?! fare)|6-year-old|family of \d|adults plus|other adult/i);
    await page.goto(`${site.url}/trips/patagonia-2027/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Argentine Patagonia' })).toBeVisible();
    expect(await page.title()).not.toMatch(/kids/i);
    expect(await page.locator('main').innerText()).toContain('From about 11');
  });
  test('trip pages link to no legacy plan', async ({ page, site }) => {
    for (const slug of ['patagonia-2027', 'canadian-rockies-2029', 'switzerland-2027']) {
      await page.goto(`${site.url}/trips/${slug}/`);
      await expect(page.getByRole('link', { name: /read the (full|original) plan/i })).toHaveCount(0);
    }
  });
  test('the home card keeps the suitability line only', async ({ page, site }) => {
    await page.goto(`${site.url}/`);
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/child around|kids 11/i);
  });
});

test.describe('trip map with no positions (2.35)', () => {
  test('a trip with no positioned stop shows a plain line and no route map', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/vermont-fall-2026/`);
    const plain = page.getByTestId('route-unplaced');
    const map = page.locator('#route [data-map-family]');
    // either the trip has positions and draws a map, or it says so; never a map framed on nothing
    if (await plain.count()) {
      await expect(plain).toContainText('not researched yet');
      await expect(map).toHaveCount(0);
    } else {
      await expect(map).toBeVisible();
    }
  });
});

test.describe('About, icons and terms (2.36, 2.37)', () => {
  test('/about/ resolves and links to the data page and the terms', async ({ page, site }) => {
    const res = await page.goto(`${site.url}/about/`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
    await expect(page.locator('main').getByRole('link', { name: 'About the data' })).toHaveAttribute('href', '/about/data/');
    await expect(page.locator('main').getByRole('link', { name: 'Terms and copyright' })).toHaveAttribute('href', '/terms/');
  });
  test('a favicon and an apple touch icon are linked and served', async ({ page, site, request }) => {
    await page.goto(`${site.url}/`);
    for (const rel of ['icon', 'apple-touch-icon']) {
      const href = await page.locator(`link[rel="${rel}"]`).first().getAttribute('href');
      expect(href, rel).toBeTruthy();
      const res = await request.get(new URL(href as string, site.url).toString());
      expect(res.status(), `${rel} ${href}`).toBe(200);
      expect(res.headers()['content-type'], rel).toMatch(/image\//);
    }
  });
  test('the footer links to the terms, which say the five things in plain words', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/`);
    await page.locator('footer').getByRole('link', { name: 'Terms and copyright' }).click();
    await expect(page).toHaveURL(/\/terms\/$/);
    const text = await page.locator('main').innerText();
    for (const needle of [/text and research on this site are ours/i, /Scraping/, /train an AI model/i, /OpenStreetMap/, /ODbL/, /Photographs carry their own licences/, /share a link/i, /Export one trip/i]) {
      expect(text).toMatch(needle);
    }
  });
});
