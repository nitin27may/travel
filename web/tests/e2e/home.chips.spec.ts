import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';
import { SHOT_DIR } from './shots';

// The status colour is blue, never green (row 4.16). The chip keeps its check glyph and words, so colour is never the only signal.
const URL = '/trips/canadian-rockies-2029/?p=family-6#day-5';

for (const theme of ['light', 'dark'] as const) {
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`fits chip: glyph, words, axe, shot (${theme} ${size.width})`, async ({ browser, site }) => {
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'en-CA' });
      const page = await context.newPage();
      await page.goto(`${site.url}${URL}`, { waitUntil: 'networkidle' });
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark theme' }).click();
      const chip = page.locator('.ch[data-kind="fits"]').first();
      await expect(chip).toBeVisible();
      await expect(chip.locator('svg')).toHaveCount(1);
      await expect(chip).toContainText(/fits/i);
      const colour = await chip.locator('.ci').evaluate((e) => getComputedStyle(e).color);
      const [, g, b] = colour.match(/\d+/g)!.map(Number);
      expect(b, `fits colour ${colour} is blue-led`).toBeGreaterThan(g);
      await chip.scrollIntoViewIfNeeded();
      mkdirSync(path.join(SHOT_DIR, 'SHL'), { recursive: true });
      await page.screenshot({ path: path.join(SHOT_DIR, 'SHL', `chips-${size.width}-${theme}.png`) });
      const res = await new AxeBuilder({ page }).analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
      await context.close();
    });
  }
}
