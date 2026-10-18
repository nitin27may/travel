import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

// Remote tiles are blocked by the fixture, so the map style never loads; everything the visitor reads and clicks
// outside the canvas (panel, pins, search, URLs, card) works regardless, which is what these specs check.
test.describe('globe page', () => {
  test('full screen: nothing scrolls and the footer is gone', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    await expect(page.locator('.globe-panel')).toBeVisible();
    const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, foot: !!document.querySelector('.site-footer') && getComputedStyle(document.querySelector('.site-footer')!).display }));
    expect(m.sh).toBeLessThanOrEqual(m.ih);
    expect(m.foot).toBe('none');
    const root = await page.locator('.globe-root').boundingBox();
    expect(root?.y).toBe(60);
  });

  test('pins are ink at rest and nothing is amber until pointed at', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    const pins = page.locator('.globe-pin:visible');
    await expect(pins.first()).toBeVisible();
    expect(await page.locator('.globe-pin[data-hot="true"]').count()).toBe(0);
    const bg = await pins.first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('');
    expect(bg).toBe('rgb(23, 34, 48)');
    await pins.first().focus();
    await expect(pins.first()).toHaveAttribute('data-hot', 'true');
  });

  test('panel row drills in with a URL, the breadcrumb follows, Esc steps back, reload restores', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    await page.locator('.globe-panel').getByRole('button', { name: /Italy/ }).click();
    await expect(page).toHaveURL(/\/globe\/it\/(\?|$)/);
    const crumbs = page.getByRole('navigation', { name: 'Globe level' });
    await expect(crumbs).toContainText('World');
    await expect(crumbs).toContainText('Italy');
    await page.locator('.globe-panel').getByRole('button', { name: /^South Tyrol/ }).click();
    await expect(page).toHaveURL(/\/globe\/it\/south-tyrol\//);
    await expect(crumbs).toContainText('South Tyrol');
    await page.reload();
    await expect(crumbs).toContainText('South Tyrol');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/globe\/it\/(\?|$)/);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/globe\/(\?|$)/);
    await page.goBack();
    await expect(page).toHaveURL(/\/globe\/it\//);
  });

  test('a place URL opens the selection card with Open place, and closing keeps the area', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/place/adolf-munkel-weg/`);
    const card = page.locator('.globe-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Adolf Munkel Weg' })).toBeVisible();
    await expect(card.getByRole('link', { name: /Open place/ })).toHaveAttribute('href', /\/places\/adolf-munkel-weg\/?$/);
    // the headless shell has no WebGL, so the camera never settles and the pin may sit off screen: dispatch the click
    await card.getByRole('button', { name: 'Close details' }).dispatchEvent('click');
    await expect(page).toHaveURL(/\/globe\/it\/south-tyrol\/val-di-funes\//);
    await expect(card).toHaveCount(0);
  });

  test('a trip URL opens the trip card', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/trip/dolomites-2027/`);
    await expect(page.locator('.globe-card').getByRole('link', { name: /Open trip/ })).toHaveAttribute('href', /\/trips\/dolomites-2027\/?$/);
  });

  test('search finds a place and a country; Enter flies there and sets the URL', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    const q = page.getByRole('combobox', { name: 'Search the globe' });
    await q.fill('braies');
    await expect(page.getByRole('option').first()).toBeVisible();
    await q.fill('Italy');
    await expect(page.getByRole('option').first()).toContainText('Italy');
    await q.press('Enter');
    await expect(page).toHaveURL(/\/globe\/it\//);
  });

  test('reduced motion: auto-spin is off and says so', async ({ browser, site }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
    await page.goto(`${site.url}/globe/`);
    const spin = page.getByRole('switch', { name: /Auto-spin/ });
    await expect(spin).toBeDisabled();
    await expect(spin).toContainText('Off: reduced motion');
    await ctx.close();
  });

  test('control card: style segments are radios and the relief slider shows with terrain on', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    await expect(page.getByRole('radio', { name: 'Relief' })).toBeVisible();
    await expect(page.getByRole('switch', { name: /3D terrain/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('slider', { name: 'Relief' })).toBeVisible();
    await page.getByRole('switch', { name: /3D terrain/ }).click();
    await expect(page.getByRole('slider', { name: 'Relief' })).toHaveCount(0);
  });

  test('collapsing the panel leaves a 44 px tab', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    await page.getByRole('button', { name: 'Collapse the panel' }).click();
    const tab = page.getByRole('button', { name: /Open the places and trips panel/ });
    expect((await tab.boundingBox())?.width).toBe(44);
  });

  test('phone: Map options sheet and the countries sheet', async ({ browser, site }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
    await page.goto(`${site.url}/globe/`);
    await expect(page.getByRole('dialog', { name: 'Countries' })).toBeVisible();
    await page.getByRole('button', { name: 'Map options' }).click();
    await expect(page.getByRole('switch', { name: /3D terrain/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await ctx.close();
  });

  test('axe: no serious or critical violations on the world view', async ({ page, site }) => {
    await page.goto(`${site.url}/globe/`);
    await page.locator('.globe-panel').waitFor();
    const r = await new AxeBuilder({ page }).exclude('.maplibregl-canvas-container').analyze();
    expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
});
