import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { setTheme, THEMES } from './shots';

// The place pages with a gallery and a map card, at both sizes in both themes, with the two rules the general axe spec did not run:
// a control's name must contain its visible text (the gallery tiles), and each landmark needs its own name (the map card).
const PAGES = ['/places/lake-louise/', '/places/arches-national-park/'];
const SIZES = [{ width: 390, height: 844 }, { width: 1440, height: 900 }];

test.describe('axe on place pages: names and landmarks', () => {
  for (const theme of THEMES) {
    for (const size of SIZES) {
      for (const url of PAGES) {
        test(`${url} ${size.width} ${theme}`, async ({ page, site }) => {
          await setTheme(page, theme);
          await page.setViewportSize(size);
          await page.goto(`${site.url}${url}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(600);
          const r = await new AxeBuilder({ page }).exclude('.maplibregl-canvas').withRules(['label-content-name-mismatch', 'landmark-unique']).analyze();
          expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
        });
      }
    }
  }
});
