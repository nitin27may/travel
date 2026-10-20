import { expect, test } from './fixtures';

// Review 4.26 / L2b S8: the immersive control must be findable. A labelled rail button with a tooltip naming the "." key, a visible way out, and Esc.
const SIZES = [
  { w: 1440, h: 900 },
  { w: 390, h: 844 },
  { w: 844, h: 390 },
];

for (const s of SIZES) {
  test(`the full screen button is findable by role and toggles immersive mode at ${s.w}x${s.h}`, async ({ page, site }) => {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.goto(`${site.url}/globe/`);
    const btn = page.getByRole('button', { name: 'Full screen' });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('title', /press \./);
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-globe-immersive', 'true');
    await btn.click();
    await expect(html).toHaveAttribute('data-globe-immersive', 'true');
    await expect(page.locator('.globe-zoom')).toHaveCSS('opacity', '0');
    const exit = page.getByRole('button', { name: /Exit full screen/ });
    await expect(exit).toBeVisible();
    await expect(exit).toContainText('Esc');
    await exit.click();
    await expect(html).not.toHaveAttribute('data-globe-immersive', 'true');
    await btn.click();
    await expect(html).toHaveAttribute('data-globe-immersive', 'true');
    await page.keyboard.press('Escape');
    await expect(html).not.toHaveAttribute('data-globe-immersive', 'true');
    await expect(btn).toBeVisible();
  });
}
