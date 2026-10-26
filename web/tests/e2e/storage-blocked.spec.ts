import { expect, test } from './fixtures';

// Review NAV-2 C1: a browser that blocks all site data throws on ACCESS to window.localStorage / sessionStorage. No page may fall to the
// error boundary ("This page couldn't load") for it; units and the like are preferences, so failing to read them costs nothing.
// the globe has no h1; its level breadcrumb is the first thing it paints
const PAGES = ['/', '/trips/', '/trips/dolomites-2027/', '/places/lago-di-braies/', '/globe/', '/mine/'];
const main = (page: import('@playwright/test').Page, url: string) => (url === '/globe/' ? page.getByRole('navigation', { name: 'Globe level' }) : page.getByRole('heading', { level: 1 }).first());

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } });
    }
  });
});

for (const url of PAGES) {
  test(`${url} renders with storage blocked`, async ({ page, site }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${site.url}${url}`, { waitUntil: 'domcontentloaded' });
    await expect(main(page, url)).toBeVisible();
    await page.waitForTimeout(500); // effects and hydration run after first paint
    await expect(page.getByText("This page couldn't load")).toHaveCount(0);
    await expect(main(page, url)).toBeVisible();
    expect(errors.filter((m) => /storage|insecure|SecurityError/i.test(m))).toEqual([]);
  });
}
