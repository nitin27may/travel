const { test, expect } = require('./fixtures.js');
const { checkContrast, formatFailures } = require('./contrast.js');
const { walkKeyboard } = require('./keyboard.js');
const { dumpA11y } = require('./a11y.js');
const path = require('node:path');

const OUT = path.resolve(__dirname, '..', '..', 'test-results', 'dumps');
const WIDTHS = [320, 390, 768, 1440];

test('serve: /shared/ and /themes.css are served', async ({ base, request }) => {
  for (const p of ['/shared/map.js', '/shared/engine.js', '/shared/contract.js', '/shared/ics.js', '/shared/sun.js', '/themes.css']) {
    expect((await request.get(base + p)).ok(), p).toBe(true);
  }
});

for (const w of WIDTHS) {
  test(`map: pins, legs and outline render at ${w}px with no horizontal scroll`, async ({ page, base }) => {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto(base + '/shared/tests/harness.html');
    const pins = page.getByRole('button', { name: /^Day \d, stop \d:/ });
    await expect(pins).toHaveCount(7);
    await expect(page.getByRole('button', { name: 'Day 1, stop 2: Lake Louise' })).toBeVisible();
    expect(await page.locator('#map svg path[stroke^="var(--id-"]').count()).toBe(3); // one leg per day with 2+ stops
    expect(await page.locator('#map svg path[stroke-dasharray]').count()).toBe(1); // park outline
    const sw = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    expect(sw.s).toBeLessThanOrEqual(sw.c);
    const box = await page.locator('#map svg').boundingBox();
    expect(box.width).toBeLessThanOrEqual(w);
    for (const b of await pins.all()) {
      const r = await b.boundingBox();
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(w + 1);
    }
  });
}

test('map: tapping or pressing Enter on a pin calls onPin with the id', async ({ page, base }) => {
  await page.goto(base + '/shared/tests/harness.html');
  await page.getByRole('button', { name: 'Day 2, stop 2: Canmore' }).click();
  await expect(page.locator('#out')).toHaveText('Opened e');
  await page.getByRole('button', { name: 'Day 3, stop 1: Peyto Lake' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#out')).toHaveText('Opened f');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.lastPin)).toBe('f');
});

test('map: update() redraws and a resize re-fits the pins', async ({ page, base }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto(base + '/shared/tests/harness.html');
  const before = await page.locator('#map svg').getAttribute('viewBox');
  await page.setViewportSize({ width: 400, height: 800 });
  await expect.poll(async () => page.locator('#map svg').getAttribute('viewBox')).not.toBe(before);
  await page.evaluate(() => window.handle.update({ days: [{ n: 1, points: [{ id: 'z', lat: 1, lon: 1, label: 'Only' }] }] }));
  await expect(page.getByRole('button', { name: /Day \d, stop/ })).toHaveCount(1);
});

test('map colours come from tokens only (no literal colour in the SVG)', async ({ page, base }) => {
  await page.goto(base + '/shared/tests/harness.html');
  const literals = await page.evaluate(() => [...document.querySelectorAll('#map svg *')].flatMap((e) => ['fill', 'stroke'].map((a) => e.getAttribute(a))).filter((v) => v && v !== 'none' && v !== 'transparent' && !v.startsWith('var(')));
  expect(literals).toEqual([]);
});

for (const w of [320, 1440]) {
  test(`harness passes contrast (light and dark), keyboard walk and a11y dump at ${w}px`, async ({ page, base }, info) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(base + '/shared/tests/harness.html');
    const c = await checkContrast(page);
    expect(c.checked).toBeGreaterThan(8);
    expect(formatFailures(c)).toBe('');
    const k = await walkKeyboard(page);
    expect(k.trapped).toBe(false);
    expect(k.unreached).toEqual([]);
    expect(k.noIndicator.map((s) => s.name)).toEqual([]);
    expect(k.count).toBe(10); // input, 2 buttons, 7 pins
    const a = await dumpA11y(page, path.join(OUT, `harness-${w}.txt`));
    expect(a.snapshot).toContain('button "Day 1, stop 1: Banff"');
    expect(a.unnamed).toEqual([]);
    void info;
  });
}

test('contrast checker catches a failing pair (self test)', async ({ page, base }) => {
  await page.goto(base + '/shared/tests/harness.html');
  await page.evaluate(() => { const p = document.createElement('p'); p.id = 'bad'; p.textContent = 'faint text'; p.style.color = 'color-mix(in srgb, var(--bg) 85%, var(--ink))'; document.querySelector('main').appendChild(p); });
  const c = await checkContrast(page, { themes: ['light'] });
  expect(c.failures.some((f) => f.el === 'p#bad' && f.ratio < 4.5)).toBe(true);
});

test('map: pinLabel sets a custom aria-label per pin and numbered:false drops the numbers and "Day N, stop K"', async ({ page, base }) => {
  await page.goto(base + '/shared/tests/harness.html');
  await page.evaluate(() => { window.handle.update({ days: [{ n: 1, points: [{ id: 'p', lat: 1, lon: 1, label: 'Banff' }, { id: 'q', lat: 1.1, lon: 1.1, label: 'Lake Louise' }] }], pinLabel: (pt, d, k) => 'Park ' + pt.label + ' (' + d + '/' + k + ')' }); });
  await expect(page.getByRole('button', { name: 'Park Banff (1/1)' })).toBeVisible();
  await page.evaluate(() => { window.handle.update({ days: [{ n: 1, points: [{ id: 'p', lat: 1, lon: 1, label: 'Banff' }, { id: 'q', lat: 1.1, lon: 1.1, label: 'Lake Louise' }] }], numbered: false }); });
  await expect(page.getByRole('button', { name: 'Banff', exact: true })).toBeVisible();
  expect(await page.locator('#map svg text').allTextContents()).toEqual(['', '']);
  await expect(page.getByRole('button', { name: /^Day \d, stop/ })).toHaveCount(0);
});
