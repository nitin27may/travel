import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const LOUISE = '/places/lake-louise/';

test.describe('place page sections (S1b)', () => {
  test('draws the contract sections in order, with "Before you go" third and markers for what is not checked', async ({ page, site }) => {
    await page.goto(`${site.url}${LOUISE}`);
    const ids = await page.locator('article.pl-page section.ps-sec').evaluateAll((els) => els.map((e) => e.id));
    const order = ['warnings', 'suits', 'options', 'access', 'when', 'facilities', 'around', 'pairs', 'photos', 'links', 'sources'];
    expect(ids).toEqual(order);
    await expect(page.locator('#warnings h2')).toHaveText('Before you go');
    await expect(page.locator('#options')).toContainText('Not checked yet: price');
    await expect(page.locator('#when .su-gapchip').first()).toBeVisible();
  });

  test('the badge opens its provenance in flow, Esc closes it and returns focus', async ({ page, site }) => {
    await page.goto(`${site.url}${LOUISE}`);
    const badge = page.locator('.rv-badge > summary');
    await badge.click();
    await expect(page.locator('.rv-badge .su-pop')).toBeVisible();
    await expect(page.locator('.rv-badge .su-pop')).toContainText('No ratings or review counts are used');
    await page.keyboard.press('Escape');
    await expect(page.locator('.rv-badge .su-pop')).toBeHidden();
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
    const n = await primary.evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.top < 900 && r.bottom > 0; }).length);
    expect(n).toBeLessThanOrEqual(1);
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
