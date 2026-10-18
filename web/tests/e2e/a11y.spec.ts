import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { setTheme, THEMES } from './shots';

// axe on every page type in both themes (2.11), colour contrast included, plus a keyboard path through the globe.
const PAGES: [string, string][] = [
  ['home', '/'],
  ['trips', '/trips/'],
  ['trip', '/trips/dolomites-2027/'],
  ['places', '/places/'],
  ['place', '/places/lago-di-braies/'],
  ['trail', '/places/tre-cime-di-lavaredo-loop/'],
  ['globe', '/globe/'],
  ['about', '/about/data/'],
];

test.describe('axe, every page type', () => {
  for (const theme of THEMES) {
    for (const [name, url] of PAGES) {
      test(`${name} (${theme})`, async ({ page, site }) => {
        await setTheme(page, theme);
        await page.goto(`${site.url}${url}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
        // the map canvas is third-party tile art; its labels are not text we author
        const r = await new AxeBuilder({ page }).exclude('.maplibregl-canvas').analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
      });
    }
  }
});

test.describe('globe keyboard path', () => {
  test('search, pick with the arrows, Esc steps back, Reset (Home) returns to the world', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    const q = page.getByRole('combobox', { name: 'Search the globe' });
    await q.focus();
    await page.keyboard.type('Italy');
    await expect(page.getByRole('option').first()).toContainText('Italy');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/globe\/it\//);
    await page.getByRole('button', { name: /^South Tyrol/ }).first().focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/globe\/it\/south-tyrol\//);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/globe\/it\/(\?|$)/);
    await page.getByRole('button', { name: 'Reset view' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/globe\/(\?|$)/);
  });

  test('Tab never gets stuck: ten Tabs from the search box reach ten different elements', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    await page.getByRole('combobox', { name: 'Search the globe' }).focus();
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      seen.add(await page.evaluate(() => { const e = document.activeElement as HTMLElement; return `${e?.tagName}|${e?.getAttribute('aria-label') ?? e?.textContent?.trim().slice(0, 30)}|${[...document.querySelectorAll('*')].indexOf(e)}`; }));
    }
    expect(seen.size).toBe(10);
  });
});
