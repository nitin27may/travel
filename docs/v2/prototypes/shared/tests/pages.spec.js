/* Sweep of the four prototype entry pages: contrast in light and dark, keyboard walk, accessibility-tree dump.
   Findings are written to docs/v2/prototypes/test-results/sweep/<page>-<width>.json and the dump beside it. The sweep
   REPORTS by default (the existing pages have known gaps that phases 1 to 3 fix); set PROTO_STRICT=1 to fail on any
   contrast failure, focus trap or unnamed control. */
const { test, expect } = require('./fixtures.js');
const { checkContrast, formatFailures } = require('./contrast.js');
const { walkKeyboard } = require('./keyboard.js');
const { dumpA11y } = require('./a11y.js');
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.resolve(__dirname, '..', '..', 'test-results', 'sweep');
const PAGES = { home: '/', builder: '/builder/?fast', parks: '/parks-app/', planner: '/planner/' };
const STRICT = process.env.PROTO_STRICT === '1';

for (const [name, url] of Object.entries(PAGES)) {
  for (const w of [390, 1440]) {
    test(`sweep: ${name} at ${w}px`, async ({ page, base }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(base + url);
      await page.waitForLoadState('networkidle');
      const contrast = await checkContrast(page);
      const keys = await walkKeyboard(page, { max: 60 });
      const a11y = await dumpA11y(page, path.join(OUT, `${name}-${w}.a11y.txt`));
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `${name}-${w}.json`), JSON.stringify({ url, contrastFailures: contrast.failures, unchecked: contrast.unchecked.length, checked: contrast.checked,
        keyboard: { count: keys.count, trapped: keys.trapped, noIndicator: keys.noIndicator.map((s) => s.name), unreached: keys.unreached }, unnamed: a11y.unnamed }, null, 1));
      expect(contrast.checked).toBeGreaterThan(0);
      if (STRICT) {
        expect(formatFailures(contrast)).toBe('');
        expect(keys.trapped).toBe(false);
        expect(a11y.unnamed).toEqual([]);
      }
    });
  }
}
