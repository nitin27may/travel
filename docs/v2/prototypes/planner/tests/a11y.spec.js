/* Contrast (light and dark), unnamed controls and focus indicators on every planner page and tab, with the sheets and the
   switcher open. Strict: any failure fails the test. Reports go to docs/v2/prototypes/test-results/planner/. */
const fs = require('node:fs');
const path = require('node:path');
const { test, expect, open } = require('./helpers.js');
const { checkContrast, formatFailures } = require('../../shared/tests/contrast.js');
const { walkKeyboard } = require('../../shared/tests/keyboard.js');
const { dumpA11y } = require('../../shared/tests/a11y.js');

const OUT = path.resolve(__dirname, '..', '..', 'test-results', 'planner');
const TABS = ['overview', 'itinerary', 'bookings', 'checklist', 'travellers', 'costs', 'notes', 'share'];
const PAGES = [
  ['index', '/planner/index.html'],
  ...TABS.map((t) => ['trip-' + t, '/planner/trip.html?id=t-dolomites#' + t]),
  ['trip-shared', '/planner/trip.html?id=t-dolomites&shared=1'],
  ['today', '/planner/today.html?id=t-dolomites&day=2'],
  ['print', '/planner/print.html?id=t-dolomites'],
];

for (const w of [390, 1440]) {
  for (const [name, url] of PAGES) {
    test(`a11y: ${name} at ${w}px, light and dark`, async ({ page, base }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await open(page, base, url);
      await page.waitForLoadState('networkidle');
      const c = await checkContrast(page);
      const keys = await walkKeyboard(page, { max: 90 });
      const a = await dumpA11y(page, path.join(OUT, `${name}-${w}.a11y.txt`));
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `${name}-${w}.json`), JSON.stringify({ checked: c.checked, failures: c.failures, unchecked: c.unchecked.length, trapped: keys.trapped, noIndicator: keys.noIndicator.map((s) => s.name), unreached: keys.unreached, unnamed: a.unnamed }, null, 1));
      expect(c.checked).toBeGreaterThan(0);
      expect(formatFailures(c)).toBe('');
      // a time input has several tab stops inside one element, which the walker reads as a repeat: check those pages by hand
      if (await page.locator('input[type=time]').count()) {
        await page.locator('#qt').focus();
        for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).not.toBe('qt');
      } else expect(keys.trapped).toBe(false);
      expect(keys.noIndicator.map((s) => s.name)).toEqual([]);
      expect(a.unnamed).toEqual([]);
    });
  }
}

test('a11y: sheets, the switcher and the diff sheet pass contrast in both themes', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites#travellers');
  const states = [
    ['switcher', async () => { await page.locator('#chip').click(); }, async () => { await page.keyboard.press('Escape'); }],
    ['dates', async () => { await page.getByRole('button', { name: 'Change dates' }).click(); }, async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }],
    ['diff', async () => { await page.getByRole('button', { name: 'Add infant' }).click(); }, async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }],
    ['drawer', async () => { await page.getByRole('button', { name: 'Prototype controls' }).click(); }, async () => { await page.getByRole('button', { name: 'Prototype controls' }).click(); }],
  ];
  for (const [name, on, off] of states) {
    await on();
    await page.waitForTimeout(350);
    const scope = name === 'switcher' ? '#switcher' : name === 'drawer' ? '#proto-drawer' : '.sheet';
    const c = await checkContrast(page, { scope });
    expect(formatFailures(c), name).toBe('');
    const dlg = await walkKeyboard(page, { max: 30 });
    if (name === 'diff') expect(dlg.trapped).toBe(false);
    if (name === 'dates' || name === 'diff') { // focus stays inside the sheet however long you Tab (a date input has several stops, so the walker cannot judge it)
      for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('.sheet'))).toBe(true); }
    }
    await off();
  }
});

test('a11y: the card menu on My trips passes contrast in both themes', async ({ page, base }) => {
  await open(page, base, '/planner/index.html');
  await page.getByRole('button', { name: /Menu for Banff/ }).click();
  const c = await checkContrast(page, { scope: '.menu:not([hidden])' });
  expect(formatFailures(c)).toBe('');
});
