import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';
import { SHOT_DIR, SIZES, THEMES } from './shots';

// SHL2 (11.1, 11.2, 15.2). The unit tests in tests/shell cover the flag-on and link-on states; this spec covers what ships:
// no Sign in in the header or phone bar, no dead "Report a problem" link while the feedback repo does not exist, /sign-in/ kept.
for (const size of SIZES) {
  test.describe(`shell at ${size.width}`, () => {
    test.use({ viewport: size });

    for (const url of ['/', '/trips/', '/places/', '/about/']) {
      test(`${url}: no Sign in link, no report link while the repo is off`, async ({ page, site }) => {
        await page.goto(`${site.url}${url}`, { waitUntil: 'networkidle' });
        await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: /Report a problem/ })).toHaveCount(0);
        await expect(page.locator('footer.site-footer')).toBeVisible();
      });
    }

    test('/sign-in/ stays: 200, noindex, the planner notice', async ({ page, site }) => {
      const res = await page.goto(`${site.url}/sign-in/`);
      expect(res?.status()).toBe(200);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.getByText('Sign-in comes with the planner.')).toBeVisible();
    });
  });
}

test('axe on a trip page gallery (15.2): tile names contain their visible text', async ({ page, site }, info) => {
  await page.goto(`${site.url}/trips/dolomites-2027/`, { waitUntil: 'networkidle' });
  // since UXB-1 the gallery mounts in the Photos tab only
  await page.getByRole('tab', { name: /^Photos/ }).click();
  const tiles = page.locator('.gal-tile');
  await tiles.first().scrollIntoViewIfNeeded();
  await expect(tiles.first()).toBeVisible();
  await page.waitForTimeout(400);
  const r = await new AxeBuilder({ page }).exclude('.maplibregl-canvas').analyze();
  expect(r.violations.map((v) => `${info.project.name} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
});

// Screenshots for the review: SHOTS_SHL2=1. The theme is switched through the site's own control.
test.describe('shots', () => {
  test.skip(!process.env.SHOTS_SHL2, 'set SHOTS_SHL2=1');
  test.setTimeout(540_000);
  for (const [name, url, gallery] of [['home', '/', false], ['about', '/about/', false], ['trip-gallery', '/trips/dolomites-2027/', true]] as const) {
    test(name, async ({ browser, site }) => {
      for (const theme of THEMES) {
        for (const size of SIZES) {
          const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'en-CA' });
          const page = await context.newPage();
          await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (route) => route.abort());
          await page.goto(`${site.url}${url}`, { waitUntil: 'networkidle' });
          if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark theme' }).click();
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await page.evaluate(() => document.fonts.ready);
          if (gallery) {
            await page.locator('.gal').scrollIntoViewIfNeeded();
            await page.waitForTimeout(800);
          } else {
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            await page.waitForTimeout(300);
          }
          const file = path.join(SHOT_DIR, 'SHL2', `${name}-${size.width}-${theme}.png`);
          mkdirSync(path.dirname(file), { recursive: true });
          await page.screenshot({ path: file });
          await context.close();
        }
      }
    });
  }
});
