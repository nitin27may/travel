import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// KIND-FILTER-FIX: on a phone every option of every filter must be reachable. The owner could not scroll the Kind list: the sheet's body grew
// wider than the screen and drifted sideways, and an anchored menu could hang below the viewport or under the 84 px bottom bar.
const SIZES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
];

/** The last option scrolls into view and sits inside the panel: below its top edge and above the foot (Done, or the sheet's actions) and the screen's edge. */
async function expectReachable(page: Page, last: Locator, panel: string, foot: string) {
  await last.scrollIntoViewIfNeeded();
  const box = (await last.boundingBox())!;
  const edges = await page.evaluate(
    ([p, f]) => ({ top: document.querySelector(p!)!.getBoundingClientRect().top, foot: document.querySelector(f!)!.getBoundingClientRect().top, vh: innerHeight }),
    [panel, foot],
  );
  expect(box.y).toBeGreaterThanOrEqual(edges.top - 1);
  expect(box.y + box.height).toBeLessThanOrEqual(Math.min(edges.foot, edges.vh) + 1);
}

/** Nothing slid sideways, and a wheel or swipe over the page behind does not move the page. */
async function expectPageStill(page: Page, panel: string, y0: number, wheel: boolean) {
  const sideways = await page.evaluate((p) => {
    const el = document.querySelector(p)!;
    return { sl: el.scrollLeft, over: el.scrollWidth - el.clientWidth };
  }, panel);
  expect(sideways.sl).toBe(0);
  expect(sideways.over).toBeLessThanOrEqual(1);
  // mobile WebKit has no mouse wheel: there the lock is read from the style, which is what iOS honours
  if (wheel) {
    await page.mouse.move(5, 5);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(150);
  }
  expect(await page.evaluate(() => scrollY)).toBe(y0);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
}

for (const path of ['/places/', '/trips/']) {
  for (const size of SIZES) {
    test.describe(`${path} at ${size.width}x${size.height}`, () => {
      test.use({ viewport: size });

      test('the Filters sheet: every group opens and its last option is reachable above Show N', async ({ page, site, browserName }) => {
        await page.goto(`${site.url}${path}`, { waitUntil: 'networkidle' });
        await page.locator('.filters-btn button').click();
        const sheet = page.getByRole('dialog', { name: 'Filters' });
        await expect(sheet).toBeVisible();
        const more = sheet.locator('.sheet-more > summary');
        if (await more.count()) await more.click();
        const groups = sheet.locator('details.sheet-facet:not(.where-sheet)');
        const n = await groups.count();
        expect(n).toBeGreaterThan(2);
        for (let i = 0; i < n; i++) {
          const g = groups.nth(i);
          if (!(await g.evaluate((d) => (d as HTMLDetailsElement).open))) await g.locator('summary').click();
          const opts = g.locator('.opt');
          if (await opts.count()) await expectReachable(page, opts.last(), '.sheet-body', '.sheet-foot');
          await expectPageStill(page, '.sheet-body', 0, browserName === 'chromium');
        }
      });

      test('the Edit panel pills: each menu docks above the bottom bar, scrolls inside, and keeps Done in view', async ({ page, site, browserName }) => {
        await page.goto(`${site.url}${path}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => scrollTo(0, 700));
        const y0 = await page.evaluate(() => scrollY);
        await page.getByRole('button', { name: /^Edit/ }).click();
        const pills = page.locator('.phone-pills .pill-trigger');
        const names = await pills.allInnerTexts();
        expect(names.length).toBeGreaterThan(2);
        for (let i = 0; i < names.length; i++) {
          await page.evaluate(() => scrollTo(0, 700));
          if (!(await page.locator('.phone-sticky[data-open]').count())) await page.getByRole('button', { name: /^Edit/ }).click();
          await pills.nth(i).click();
          const menu = page.locator('.popover-pos > .popover');
          await expect(menu).toBeVisible();
          await page.waitForTimeout(400); // the menu eases in over 4 px
          const box = (await menu.boundingBox())!;
          const barTop = await page.evaluate(() => document.querySelector('.bottom-bar')!.getBoundingClientRect().top);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.y + box.height).toBeLessThanOrEqual(barTop + 1);
          const rows = menu.locator('.opt, .where-opt');
          if (await rows.count()) await expectReachable(page, rows.last(), '.popover', '.popover-foot, .bottom-bar');
          // a menu with a Done button keeps it on screen (the Youngest child stepper has none: it is short)
          const done = menu.getByRole('button', { name: 'Done' });
          if (await done.count()) await expect(done).toBeInViewport();
          await expectPageStill(page, '.popover', y0, browserName === 'chromium');
          // Escape closes the menu and focus returns to the pill that opened it
          await page.keyboard.press('Escape');
          await expect(menu).toHaveCount(0);
          await expect(pills.nth(i)).toBeFocused();
        }
      });
    });
  }
}

test.describe('the Kind menu by keyboard (phone width)', () => {
  test.use({ viewport: SIZES[0] });

  test('Tab stays inside the open menu, Done closes and returns focus, Space picks and the count of selected updates', async ({ page, site, browserName }) => {
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => scrollTo(0, 700));
    await page.getByRole('button', { name: /^Edit/ }).click();
    const pill = page.locator('.phone-pills .pill-trigger', { hasText: /^Kind/ });
    await pill.click();
    const menu = page.getByRole('dialog', { name: 'Kind' });
    await expect(menu.locator('.popover-head-n')).toHaveText('None selected');
    // Tab order is the engine's own in mobile WebKit (it skips checkboxes unless the user turns that on), so the trap is asserted in Chromium
    if (browserName === 'chromium') {
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        expect(await menu.evaluate((m) => m.contains(document.activeElement))).toBe(true);
      }
    }
    await menu.getByRole('button', { name: 'Done' }).click();
    await expect(menu).toHaveCount(0);
    await expect(pill).toBeFocused();
    // a pick by keyboard updates the count of selected in the menu's header
    await pill.click();
    await menu.getByRole('checkbox').first().focus();
    await page.keyboard.press('Space');
    await expect(menu.locator('.popover-head-n')).toHaveText('1 selected');
  });
});

// the same shared sheet: the globe's list stands on the bottom bar, and its full stop used to push the title row and Close 20 px above the screen
for (const size of SIZES) {
  test(`the globe list sheet at ${size.width}x${size.height}: at its full stop the title and Close are on screen and the list ends above the bottom bar`, async ({ page, site }) => {
    await page.setViewportSize(size);
    await page.goto(`${site.url}/globe/`, { waitUntil: 'domcontentloaded' });
    const expand = page.getByRole('button', { name: 'Expand' });
    await expect(expand).toBeVisible();
    for (let i = 0; i < 2; i++) {
      if (await expand.isEnabled()) await expand.click();
      await page.waitForTimeout(600);
    }
    const r = await page.evaluate(() => ({
      head: document.querySelector('.sheet-head')!.getBoundingClientRect().top,
      close: document.querySelector('.sheet-head [aria-label="Close"]')!.getBoundingClientRect().top,
      bottom: document.querySelector('.sheet-panel')!.getBoundingClientRect().bottom,
      bar: document.querySelector('.bottom-bar')!.getBoundingClientRect().top,
    }));
    expect(r.head).toBeGreaterThanOrEqual(0);
    expect(r.close).toBeGreaterThanOrEqual(0);
    expect(r.bottom).toBeLessThanOrEqual(r.bar + 1);
  });
}
