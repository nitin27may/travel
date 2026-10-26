import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test.describe('theme and fonts', () => {
  test('light is the default, dark is a toggle and is remembered, with no flash on load', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: /Switch to dark theme/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // the init script sets the attribute before the first paint: it is already dark when the DOM is parsed
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { __themeAtParse: string }).__themeAtParse = document.documentElement.dataset.theme ?? '';
      });
    });
    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { __themeAtParse: string }).__themeAtParse)).toBe('dark');
  });

  test('the three families load from this site', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    await page.evaluate(() => document.fonts.ready);
    const families = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/['"]/g, '')));
    for (const f of ['Big Shoulders Display', 'Source Serif 4', 'IBM Plex Mono']) expect(families).toContain(f);
  });
});

test.describe('shell', () => {
  test('public header: three tabs with aria-current, search, theme, and no Sign in while the flag is off', async ({ page, site }) => {
    await page.goto(`${site.url}/places/`);
    const nav = page.getByRole('navigation', { name: 'Main', exact: true });
    await expect(nav.getByRole('link')).toHaveText(['Trips', 'Places', 'Globe', 'Mine']);
    await expect(nav.getByRole('link', { name: 'Places' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    const header = page.locator('header.site-header');
    expect((await header.boundingBox())?.height).toBe(60);
  });

  test('phone: bottom bar with five items (Trips, Places, Globe, Search, Mine), header tabs hidden, no horizontal scroll', async ({ browser, site }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    for (const path of ['/', '/trips/', '/places/', '/sign-in/', '/specimen/']) {
      await page.goto(`${site.url}${path}`, { waitUntil: 'networkidle' });
      const bar = page.getByRole('navigation', { name: 'Main, bottom' });
      await expect(bar.getByRole('link')).toHaveText(['Trips', 'Places', 'Globe', 'Mine']);
      await expect(bar.getByRole('button')).toHaveText(['Search']);
      await expect(page.locator('header.site-header .site-nav')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await context.close();
  });

  test('sign-in is a one-screen notice with links onward', async ({ page, site }) => {
    await page.goto(`${site.url}/sign-in/`);
    await expect(page.getByText('Sign-in comes with the planner. Everything here works without an account.')).toBeVisible();
    for (const name of ['Trips', 'Places', 'Globe']) await expect(page.locator('main').getByRole('link', { name, exact: true })).toBeVisible();
  });

  test('the 404 page says "Not here" and offers search and links to Home, Trips, Places, Globe and About', async ({ page, site }) => {
    await page.goto(`${site.url}/404/`);
    await expect(page.getByRole('heading', { name: 'Not here' })).toBeVisible();
    await expect(page.getByRole('searchbox')).toBeVisible();
    for (const name of ['Home', 'Trips', 'Places', 'Globe', 'About']) await expect(page.locator('main').getByRole('link', { name, exact: true })).toBeVisible();
  });

  test('card grid is 4, 3, 2, 1 columns by width', async ({ browser, site }) => {
    for (const [width, cols] of [[1440, 4], [1100, 3], [800, 2], [390, 1]] as const) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.goto(`${site.url}/places/`);
      const n = await page.locator('.card-grid').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      expect(n, `columns at ${width}`).toBe(cols);
      await context.close();
    }
  });
});

test.describe('overlays and motion', () => {
  test('the detail sheet traps focus, Esc closes it and focus returns to the opener', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    const opener = page.getByRole('button', { name: 'Open side sheet' });
    await opener.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'TRE CIME DI LAVAREDO' })).toBeFocused();
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('the bottom sheet has Expand and Collapse buttons and closes with Esc', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: 'Open bottom sheet' }).click();
    await expect(page.getByRole('button', { name: 'Expand' })).toBeEnabled();
    await page.getByRole('button', { name: 'Expand' }).click();
    await expect(page.getByRole('button', { name: 'Expand' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the bottom sheet reopens at its initial stop, not where it was left', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: 'Open bottom sheet' }).click();
    await page.getByRole('button', { name: 'Expand' }).click();
    await expect(page.getByRole('button', { name: 'Expand' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open bottom sheet' }).click();
    await expect(page.getByRole('button', { name: 'Expand' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Collapse' })).toBeEnabled();
  });

  test('a toast with Undo appears and runs its action', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    await page.getByRole('button', { name: 'Show toast with Undo' }).click();
    const region = page.getByRole('region', { name: 'Notifications' });
    await expect(region.getByText('Moved Seceda to Day 12')).toBeVisible();
    await region.getByRole('button', { name: 'Undo' }).click();
    await expect(region.getByText('Moved Seceda to Day 12')).toHaveCount(0);
  });

  test('reduced motion: sheets fade in 120 ms instead of moving', async ({ browser, site }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${site.url}/specimen/`);
    const d = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--d-sheet').trim());
    expect(['120ms', '.12s', '0.12s']).toContain(d);
    await page.getByRole('button', { name: 'Open side sheet' }).click();
    const transform = await page.getByRole('dialog').evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
    await context.close();
  });

  test('keyboard focus shows the 2 px ring', async ({ page, site }) => {
    await page.goto(`${site.url}/specimen/`);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element);
      return { width: s.outlineWidth, offset: s.outlineOffset, style: s.outlineStyle };
    });
    expect(ring).toEqual({ width: '2px', offset: '2px', style: 'solid' });
  });
});

test.describe('accessibility (axe, WCAG AA)', () => {
  for (const path of ['/', '/trips/', '/places/', '/specimen/']) {
    for (const theme of ['light', 'dark']) {
      test(`${path} in ${theme}: no serious or critical violations`, async ({ page, site }) => {
        await page.addInitScript((t) => localStorage.setItem('travel:v1:theme', t), theme);
        await page.goto(`${site.url}${path}`);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
      });
    }
  }
});
