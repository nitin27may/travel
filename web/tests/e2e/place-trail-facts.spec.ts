import { expect, test } from './fixtures';

// PLC2 part a: the trail key-facts strip, AllTrails on a trail, and the cover Directions chooser.

test.describe('the trail key-facts strip', () => {
  test('Fenland Loop shows every slot, with "Not checked yet" where nothing is recorded', async ({ page, site }) => {
    await page.goto(`${site.url}/places/fenland-loop/`, { waitUntil: 'networkidle' });
    const strip = page.locator('#glance');
    await expect(strip.locator('li')).toHaveCount(15);
    await expect(strip.locator('li', { hasText: 'High point' })).toContainText('Not checked yet');
    await expect(strip.locator('li', { hasText: 'Route status' })).toContainText('Not checked yet');
    await expect(strip.locator('li', { hasText: 'Length' })).toContainText(/1\.9 km|1\.2 mi/);
  });

  test('AllTrails opens in a new tab and says it is a third-party link', async ({ page, site }) => {
    await page.goto(`${site.url}/places/tre-cime-di-lavaredo-loop/`, { waitUntil: 'networkidle' });
    const link = page.locator('#glance').getByRole('link', { name: /AllTrails/ });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('href', /^https:\/\/www\.alltrails\.com\//);
    await expect(link).toHaveAccessibleName(/third-party site/);
    await expect(page.locator('#glance')).not.toContainText(/AllTrails/);
  });
});

test.describe('the cover Directions button', () => {
  test('opens the same two choices as the Directions card in the rail', async ({ page, site }) => {
    await page.goto(`${site.url}/places/banff-gondola/`, { waitUntil: 'networkidle' });
    await page.locator('.pl-actions .pl-dir').click();
    const menu = page.locator('.pl-dirmenu .menu');
    await expect(page.locator('.pl-dir')).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('link', { name: /Google Maps directions/ })).toBeVisible();
    await expect(menu.getByRole('link', { name: /Apple Maps/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    const card = page.getByRole('region', { name: 'Directions' });
    await expect(card.getByRole('link', { name: /Google Maps directions/ })).toBeVisible();
    await expect(card.getByRole('link', { name: /Apple Maps/ })).toBeVisible();
  });
});

test.describe('the strip on a phone and the empty cell', () => {
  test('Fenland at 390 is under about 700 px and its odd last tile spans both columns (M14, M18)', async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.url}/places/fenland-loop/`, { waitUntil: 'networkidle' });
    const ul = page.locator('#glance > ul');
    expect((await ul.boundingBox())!.height).toBeLessThan(760);
    const last = await page.locator('#glance > ul > li').last().boundingBox();
    const box = await ul.boundingBox();
    expect(Math.abs(last!.width - box!.width)).toBeLessThan(4);
  });
  test('Ötzi has no empty cell: its last tile reaches the right edge of the grid (M18)', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${site.url}/places/otzi-south-tyrol-museum-of-archaeology/`, { waitUntil: 'networkidle' });
    const ul = (await page.locator('#glance > ul').boundingBox())!;
    const last = (await page.locator('#glance > ul > li').last().boundingBox())!;
    expect(last.x + last.width).toBeGreaterThan(ul.x + ul.width - 4);
  });
});

test.describe('a place with no stored point', () => {
  test('has no Directions button and Save to a trip is the one primary (M19)', async ({ page, site }) => {
    await page.goto(`${site.url}/places/fenland-loop/`, { waitUntil: 'networkidle' });
    await expect(page.locator('.pl-actions').getByRole('button', { name: /Directions/ })).toHaveCount(0);
    const save = page.getByRole('button', { name: /Save to a trip/ });
    await expect(save).toHaveClass(/pl-primary/);
    const bg = await save.evaluate((el) => getComputedStyle(el).backgroundColor);
    const accent = await page.evaluate(() => { const d = document.createElement('i'); d.style.background = 'var(--accent)'; document.body.append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
    expect(bg).toBe(accent);
  });
});

test.describe('glance tiles hold one answer', () => {
  test('Ötzi shows the lead price and hours with a count, the full hours once in "When to go"', async ({ page, site }) => {
    await page.goto(`${site.url}/places/otzi-south-tyrol-museum-of-archaeology/`, { waitUntil: 'networkidle' });
    await expect(page.locator('#glance')).toContainText(/\+\d+ more/);
    await expect(page.locator('#glance')).not.toContainText('EUR 26 family');
    await expect(page.locator('#when')).toContainText('Tue–Sun 10:00–18:00; Mon, 1 Jul – 31 Aug 10:00–18:00');
  });
  test('Akureyri has no stray pointer glyph above "Coming from far?"', async ({ page, site }) => {
    await page.goto(`${site.url}/places/akureyri-botanical-garden/`, { waitUntil: 'networkidle' });
    await expect(page.locator('.rv-pointer svg')).toHaveCount(0);
  });
});
