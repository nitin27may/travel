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
    await expect(link).toContainText(/third-party site/);
  });
});

test.describe('the cover Directions button', () => {
  test('opens the same two choices as the Directions card in the rail', async ({ page, site }) => {
    await page.goto(`${site.url}/places/banff-gondola/`, { waitUntil: 'networkidle' });
    await page.locator('.pl-actions').getByRole('button', { name: /Directions/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Google Maps directions' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Apple Maps' })).toBeVisible();
    const card = page.getByRole('region', { name: 'Directions' });
    await expect(card.getByRole('link', { name: /Google Maps directions/ })).toBeVisible();
    await expect(card.getByRole('link', { name: /Apple Maps/ })).toBeVisible();
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
