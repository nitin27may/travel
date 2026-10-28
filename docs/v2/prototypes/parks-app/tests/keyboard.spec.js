/* Keyboard-only walks: index filters, a park page, Save, Plan a visit, and focus return after menus, sheets and drawers. */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { checkContrast, formatFailures } = require('../../shared/tests/contrast.js');
const { watchErrors } = require('./helpers.js');

/** Tab forward until the element matching `sel` has focus (fails after `max` presses) */
async function tabTo(page, sel, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), sel)) return i;
    await page.keyboard.press('Tab');
  }
  throw new Error('Tab never reached ' + sel);
}
const inside = (page, sel) => page.evaluate((s) => !!document.activeElement && !!document.activeElement.closest(s), sel);

test('index filters with the keyboard only: open, pick, stay inside, Escape returns to the pill', async ({ page, base }) => {
  const errs = watchErrors(page);
  await page.goto(base + '/parks-app/index.html');
  await tabTo(page, '[data-p="season"]');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Open in' })).toBeVisible();
  expect(await inside(page, '#menu')).toBe(true);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await page.keyboard.press('Space');                      // Aug
  await expect(page).toHaveURL(/season=aug/);
  expect(await inside(page, '#menu')).toBe(true);          // the menu was redrawn: focus found its button again
  expect(await page.evaluate(() => document.activeElement.dataset.season)).toBe('aug');
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Tab'); expect(await inside(page, '#menu'), 'Tab stays in the menu').toBe(true); }
  await page.keyboard.press('Shift+Tab'); expect(await inside(page, '#menu')).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement.dataset.p)).toBe('season');
  // clear with the keyboard: the x button next to the pill
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/season=/);
  // Where: pick Canada then an Ontario row without leaving the menu
  await tabTo(page, '[data-p="where"]'); await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');                      // first option is Canada
  await expect(page).toHaveURL(/country=ca/);
  expect(await inside(page, '#menu')).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.activeElement.dataset.p)).toBe('where');
  // view toggle and sort keep focus
  await page.locator('#views [data-v="cards"]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('a.pk').first()).toBeVisible();
  expect(await page.evaluate(() => document.activeElement.dataset.v)).toBe('cards');
  await page.locator('#sort').focus(); await page.locator('#sort').selectOption('name');
  await expect(page).toHaveURL(/sort=name/);
  expect(await page.evaluate(() => document.activeElement.id)).toBe('sort');
  // "/" jumps to search
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('/');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('q');
  expect(errs.list()).toEqual([]);
});

test('phone: the Filters sheet takes focus and gives it back', async ({ page, base }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/parks-app/index.html');
  await tabTo(page, '#fbtn'); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Sort and filters' })).toBeVisible();
  expect(await inside(page, '#menu')).toBe(true);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');   // second sort option: Name
  await expect(page).toHaveURL(/sort=name/);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('fbtn');
});

test('park page with the keyboard only: Save, favourite, details, show all, Plan a visit', async ({ page, base }) => {
  const errs = watchErrors(page);
  await page.goto(base + '/parks-app/park.html?slug=jasper-national-park');
  await tabTo(page, '#save');
  await page.keyboard.press('Space');
  await expect(page.locator('#save')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#savedn')).toHaveText('1');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('save');
  await tabTo(page, '#fav'); await page.keyboard.press('Enter');
  await expect(page.locator('#fav')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('fav');   // the page re-rendered: focus is back on the button
  await tabTo(page, '[data-more]'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-more]').first()).toHaveAttribute('aria-expanded', 'true');
  await tabTo(page, '[data-expand]'); const kind = await page.evaluate(() => document.activeElement.dataset.expand);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement.dataset.expand)).toBe(kind);
  await expect(page.locator(`[data-expand="${kind}"]`)).toHaveAttribute('aria-expanded', 'true');
  // a count tile jumps to its group and focus lands on the group heading
  await page.locator('[data-kind="lake"]').focus(); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('g-lake');
  // Plan a visit by keyboard
  await page.locator('.planvisit a').nth(2).focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/builder\/index\.html\?m=near&n=2&p=jasper-national-park/);
  expect(errs.list().filter((e) => !/builder/.test(e))).toEqual([]);
});

test('Saved drawer: focus goes in, stays in, comes back; removing keeps focus inside', async ({ page, base }) => {
  await page.goto(base + '/parks-app/park.html?slug=yoho-national-park');
  await page.locator('#save').click();
  await page.locator('[data-psave]').first().click();
  await page.locator('#savedbtn').focus(); await page.keyboard.press('Enter');
  const dr = page.getByRole('dialog', { name: 'My saved places' });
  await expect(dr).toBeVisible();
  expect(await inside(page, '#saveddrawer')).toBe(true);
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); expect(await inside(page, '#saveddrawer')).toBe(true); }
  await page.locator('#saveddrawer [data-rm]').first().focus(); await page.keyboard.press('Enter');
  expect(await inside(page, '#saveddrawer')).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dr).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement.id)).toBe('savedbtn');
  // scrim click also closes and returns
  await page.locator('#savedbtn').click(); await expect(dr).toBeVisible();
  await page.locator('#saveddrawerscrim').click({ position: { x: 10, y: 10 } });
  await expect(dr).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement.id)).toBe('savedbtn');
});

test('prototype controls panel closes on Escape and returns focus', async ({ page, base }) => {
  await page.goto(base + '/parks-app/park.html?slug=banff-national-park');
  await page.locator('#ctlb').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#ctlpnl')).toBeVisible();
  await page.locator('#c-m').focus(); await page.keyboard.press('Escape');
  await expect(page.locator('#ctlpnl')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement.id)).toBe('ctlb');
});

/* the overlays are part of the contrast sweep too: every menu, the share sheet, the saved drawer, the controls panel */
for (const w of [390, 1440]) {
  test(`contrast ${w}px: open menus, share sheet, saved drawer and controls (light and dark)`, async ({ page, base }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });   // the drawer slides in; measure it at rest
    await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); localStorage.setItem('proto.saved', JSON.stringify(['jasper-national-park', 'banff-national-park--moraine-lake'])); });
    await page.goto(base + '/parks-app/index.html?country=ca&k=nature.protected.national_park&season=jul,all&drive=calgary-3');
    const menus = w < 640 ? ['filters'] : ['where', 'type', 'drive', 'season'];
    for (const m of menus) {
      await page.locator(m === 'filters' ? '#fbtn' : `[data-p="${m}"]`).click();
      await expect(page.locator('#menu')).toBeVisible();
      expect(formatFailures(await checkContrast(page, { scope: '#menu' })), 'menu ' + m).toBe('');
      await page.keyboard.press('Escape');
    }
    await page.goto(base + '/parks-app/park.html?slug=banff-national-park');
    await page.locator('#savedbtn').click();
    expect(formatFailures(await checkContrast(page, { scope: '#saveddrawer' })), 'drawer').toBe('');
    await page.keyboard.press('Escape');
    await page.locator('#share').click();
    expect(formatFailures(await checkContrast(page, { scope: '#sharesheet' })), 'share').toBe('');
    await page.keyboard.press('Escape');
    await page.locator('#ctlb').click();
    expect(formatFailures(await checkContrast(page, { scope: '#ctl' })), 'controls').toBe('');
    // an expanded row and a forced closure and stale data
    await page.goto(base + '/parks-app/park.html?slug=lake-ohara-area&closure=1&stale=1&pm=3');
    for (const b of await page.locator('[data-more]').all()) await b.click();
    expect(formatFailures(await checkContrast(page)), 'stale and closure states').toBe('');
  });
}
