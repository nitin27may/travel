import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { setTheme, THEMES } from './shots';

// Stage 4, lane PLC: axe on the five reviewed pages, the phone section index by keyboard, and the units toggle on the page's sections.
const PAGES = ['/places/lake-louise/', '/places/larch-valley-to-sentinel-pass/', '/places/moraine-lake/', '/places/tre-cime-di-lavaredo-loop/', '/places/capri/'];
const SIZES = [{ width: 390, height: 844 }, { width: 1440, height: 900 }];

test.describe('axe, WCAG AA, on the reviewed place pages', () => {
  test.setTimeout(120_000);
  for (const theme of THEMES) {
    for (const size of SIZES) {
      for (const url of PAGES) {
        test(`${url} ${size.width} ${theme}`, async ({ page, site }) => {
          await setTheme(page, theme);
          await page.setViewportSize(size);
          await page.goto(`${site.url}${url}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(600);
          const r = await new AxeBuilder({ page }).exclude('.maplibregl-canvas').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
        });
      }
    }
  }
});

test.describe('the phone section index', () => {
  test('is one line of links, reachable by keyboard, and jumps to the section', async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.url}/places/larch-valley-to-sentinel-pass/`, { waitUntil: 'networkidle' });
    const nav = page.getByRole('navigation', { name: 'On this page' });
    await expect(nav.getByRole('link').first()).toBeVisible();
    const box = await nav.boundingBox();
    expect(box!.height).toBeLessThan(60);
    await nav.getByRole('link', { name: 'Who it suits' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#suits$/);
    // smooth scrolling takes a moment; the section ends up just under the sticky header
    await expect.poll(async () => page.locator('#suits').evaluate((el) => Math.round(el.getBoundingClientRect().top)), { timeout: 5000 }).toBeLessThan(200);
    const top = await page.locator('#suits').evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThan(40);
  });
  test('is not drawn on a wide screen', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${site.url}/places/larch-valley-to-sentinel-pass/`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeHidden();
  });
});

test.describe('units on the place sections', () => {
  test('with miles chosen the route line, the chips and the sections follow', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${site.url}/places/larch-valley-to-sentinel-pass/`, { waitUntil: 'networkidle' });
    await page.getByText('mi, ft', { exact: true }).first().click();
    await page.waitForTimeout(400);
    const main = await page.locator('.pl-main').innerText();
    // the figures the page ships in km and m are drawn in mi and ft; only a quoted source may keep its own unit
    expect(main).toMatch(/\d(?:\.\d+)? mi\b/);
    const bare = [...main.matchAll(/\b\d[\d,.]*\s?(?:km|m)\b/g)].map((m) => m[0]);
    expect(bare, bare.join(', ')).toEqual([]);
  });
});
