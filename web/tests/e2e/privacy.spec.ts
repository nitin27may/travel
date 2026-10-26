import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { setTheme } from './shots';

test.describe('privacy page (GSI-P)', () => {
  test('renders with the site shell, is indexable, and says what it keeps', async ({ page, site }) => {
    await page.goto(`${site.url}/privacy/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    for (const word of ['Cloudflare Web Analytics', 'Vercel', 'Neon', 'Turnstile', 'Resend', 'nitin27may@gmail.com']) await expect(page.locator('.prose')).toContainText(word);
  });

  for (const [name, url] of [['home', '/'], ['trip', '/trips/dolomites-2027/'], ['place', '/places/lago-di-braies/']] as const) {
    test(`footer on the ${name} page links to /privacy/`, async ({ page, site }) => {
      await page.goto(`${site.url}${url}`);
      const link = page.locator('footer.site-footer').getByRole('link', { name: 'Privacy' });
      await expect(link).toHaveAttribute('href', '/privacy/');
      if (name === 'home') {
        await link.click();
        await expect(page).toHaveURL(/\/privacy\/$/);
      }
    });
  }

  test('is listed in the sitemap', async ({ request, site }) => {
    const xml = await (await request.get(`${site.url}/sitemap.xml`)).text();
    expect(xml).toContain('/privacy/</loc>');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`axe finds nothing (${theme})`, async ({ page, site }) => {
      await setTheme(page, theme);
      await page.goto(`${site.url}/privacy/`, { waitUntil: 'networkidle' });
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.map((v) => v.id)).toEqual([]);
    });
  }
});
