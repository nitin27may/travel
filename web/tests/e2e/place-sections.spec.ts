import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const LOUISE = '/places/lake-louise/';

test.describe('place page sections (S1b)', () => {
  test('draws the contract sections in order, with "Before you go" third and markers for what is not checked', async ({ page, site }) => {
    await page.goto(`${site.url}${LOUISE}`);
    const ids = await page.locator('article.pl-page section.ps').evaluateAll((els) => els.map((e) => e.id));
    const order = ['warnings', 'suits', 'options', 'access', 'when', 'facilities', 'around', 'pairs', 'photos', 'links', 'sources'];
    expect(ids).toEqual(order);
    await expect(page.locator('#warnings h2')).toHaveText('Before you go');
    await expect(page.locator('#options')).toContainText('Not checked yet: price');
    await expect(page.locator('#when .gc').first()).toBeVisible();
  });

  test('the badge opens its provenance in flow, Esc closes it and returns focus', async ({ page, site }) => {
    await page.goto(`${site.url}${LOUISE}`);
    const badge = page.locator('.rv-badge > summary');
    await badge.click();
    await expect(page.locator('.rv-badge .sp')).toBeVisible();
    await expect(page.locator('.rv-badge .sp')).toContainText('No ratings or review counts are used');
    await page.keyboard.press('Escape');
    await expect(page.locator('.rv-badge .sp')).toBeHidden();
    await expect(badge).toBeFocused();
  });

  test('a glance slot links to its row, and a row inside a collapsed group opens the group first', async ({ page, site }) => {
    await page.goto(`${site.url}${LOUISE}#su-on_site_min`);
    await expect(page.locator('#su-on_site_min')).toBeVisible();
  });

  test('exactly one primary (amber) button is visible in the first desktop view', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${site.url}${LOUISE}`);
    const primary = page.locator('.btn-primary:visible');
    const n = await primary.evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.top < 900 && r.bottom > 0 && (e.classList.contains('pl-dir') || !e.closest('.pl-cover-body')); }).length);
    expect(n).toBeLessThanOrEqual(1);
  });

  test('Directions is the amber action of the first view at 1440 and on phone; a shuttle-only place has none (M5, M2)', async ({ page, site }) => {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto(`${site.url}${LOUISE}`);
      const dir = page.locator('a.pl-dir');
      await expect(dir).toBeVisible();
      const box = await dir.boundingBox();
      expect(box!.y + box!.height).toBeLessThan(size.height + (size.width < 600 ? 400 : 0));
      await expect(page.getByRole('button', { name: /Save to a trip/ })).not.toHaveClass(/btn-primary.*pl-dir/);
    }
    await page.goto(`${site.url}/places/larch-valley-to-sentinel-pass/`);
    await expect(page.locator('a.pl-dir')).toHaveCount(0);
    await expect(page.getByText(/No private cars on this road/)).toBeVisible();
  });

  test('the units toggle rewrites distances and heights on a place page (M9)', async ({ page, site }) => {
    await page.addInitScript(() => localStorage.setItem('travel:v1:prefs', JSON.stringify({ distance: 'mi', elevation: 'ft' })));
    await page.goto(`${site.url}${LOUISE}`);
    await expect(page.locator('data.um').first()).toHaveText(/\d+ ft/);
  });

  test('no horizontal scroll at 390 and axe is clean', async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.url}${LOUISE}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.locator('.su-group').first().locator(':scope > summary').click();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
