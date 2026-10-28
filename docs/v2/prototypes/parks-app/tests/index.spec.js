/* Parks index: cards, map, pager, drive sort, URL state, navigation (header and phone bottom bar). */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { LISTED, watchErrors } = require('./helpers.js');

const names = (page, sel = 'a.prow b, a.pk b') => page.locator(sel).evaluateAll((els) => els.map((e) => e.textContent.replace(/^\s*\d+\s+/, '').trim()));

test('cards view: photo placeholder, count and the three chips on every card', async ({ page, base }) => {
  const errs = watchErrors(page);
  await page.goto(base + '/parks-app/index.html?view=cards');
  const cards = page.locator('a.pk');
  await expect(cards).toHaveCount(LISTED.length);
  for (const p of LISTED) {
    const c = page.locator(`a.pk[href$="slug=${p.slug}"]`);
    await expect(c.locator('.ph')).toHaveAttribute('aria-label', 'Photo placeholder');
    await expect(c.locator('.cnt .big')).toHaveText(String(p.places));
    await expect(c.locator('[data-fact]')).toHaveCount(3);
  }
  expect(errs.list()).toEqual([]);
});

test('map view: shared/map.js pins and the list; a pin tap opens the park', async ({ page, base }) => {
  const errs = watchErrors(page);
  await page.goto(base + '/parks-app/index.html?view=map');
  await expect(page.locator('#mapbox svg')).toBeVisible();
  const pins = page.locator('#mapbox [data-pin]');
  await expect(pins).toHaveCount(LISTED.length);
  await expect(page.locator('#maplist a.prow')).toHaveCount(LISTED.length);
  // every pin is a named button and carries the list number
  const labels = await pins.evaluateAll((g) => g.map((x) => x.getAttribute('aria-label')));
  for (const p of LISTED) expect(labels.some((l) => l.startsWith('Open ' + p.name)), p.name).toBe(true);
  const nums = await pins.evaluateAll((g) => g.map((x) => x.querySelector('text').textContent));
  expect(nums.sort((a, b) => a - b)).toEqual(LISTED.map((_, i) => String(i + 1)).sort((a, b) => a - b));
  // hovering a list row names its pin on the map
  await page.locator('#maplist a.prow').first().hover();
  await expect(page.locator('#mapbox svg text:not([aria-hidden="true"]), #mapbox svg rect + text').first()).toBeAttached();
  // pin tap opens the park
  await page.locator('#mapbox [data-pin="jasper-national-park"]').dispatchEvent('click'); // Banff's selected label plate sits over it after the hover above
  await expect(page).toHaveURL(/park\.html\?slug=jasper-national-park/);
  // keyboard: Enter on a pin
  await page.goto(base + '/parks-app/index.html?view=map');
  await page.locator('#mapbox [data-pin="zion-national-park"]').focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/slug=zion-national-park/);
  // the map redraws on resize with the numbers kept
  await page.goto(base + '/parks-app/index.html?view=map');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#mapbox [data-pin] text').first().textContent()).toMatch(/^\d+$/);
  expect(errs.list()).toEqual([]);
});

test('pager: 20 per page by default, URL key page, filters reset it', async ({ page, base }) => {
  await page.goto(base + '/parks-app/index.html');
  await expect(page.locator('.pager')).toContainText('1 to 9 of 9');
  await expect(page.locator('.pager [aria-label="Page 2"]')).toHaveCount(0);
  await expect(page.locator('.pager [aria-label="Next page"]')).toBeDisabled();
  // ps=4 makes three pages out of nine parks (prototype override)
  await page.goto(base + '/parks-app/index.html?ps=4');
  await expect(page.locator('a.prow')).toHaveCount(4);
  await expect(page.locator('.pager')).toContainText('1 to 4 of 9');
  await page.locator('.pager [aria-label="Page 2"]').click();
  await expect(page).toHaveURL(/page=2/);
  const p2 = await names(page);
  expect(p2).toHaveLength(4);
  await page.reload();
  expect(await names(page)).toEqual(p2);
  await page.locator('.pager [aria-label="Page 3"]').click();
  await expect(page.locator('a.prow')).toHaveCount(1);
  await expect(page).toHaveURL(/page=3/);
  await page.locator('.pager [aria-label="Previous page"]').click();
  await expect(page).toHaveURL(/page=2/);
  // a filter goes back to page 1 and drops the key
  await page.getByRole('button', { name: /^Where/ }).click();
  await page.getByRole('button', { name: /^Canada/ }).click();
  await expect(page).not.toHaveURL(/page=/);
  // beyond the last page clamps
  await page.goto(base + '/parks-app/index.html?ps=4&page=99');
  await expect(page.locator('.pager [aria-current="page"]')).toHaveText('3');
  // the same page rows on cards and map
  await page.goto(base + '/parks-app/index.html?ps=4&page=2&view=cards');
  await expect(page.locator('a.pk')).toHaveCount(4);
  await page.goto(base + '/parks-app/index.html?ps=4&page=2&view=map');
  await expect(page.locator('#mapbox [data-pin]')).toHaveCount(4);
});

test('drive sort: parks without a value for the hub sort last under "Drive time not set"', async ({ page, base }) => {
  await page.goto(base + '/parks-app/index.html?sort=drive-calgary');
  const heads = await page.locator('.cgroup h2').allTextContents();
  expect(heads).toEqual(['Nearest first · from Calgary', 'Drive time not set']);
  const all = await names(page);
  const near = LISTED.filter((p) => p.drive.calgary != null).sort((a, b) => a.drive.calgary - b.drive.calgary || a.worth - b.worth).map((p) => p.name);
  const none = LISTED.filter((p) => p.drive.calgary == null).map((p) => p.name).sort();
  expect(all.slice(0, near.length)).toEqual(near);
  expect(all.slice(near.length).sort()).toEqual(none);
  expect(none).toContain('Zion National Park'); expect(none).toContain('Algonquin Provincial Park');
  await expect(page.locator('a.prow').first()).toContainText('from Calgary');
  // with a drive filter the filter's hub is the default sort and the sort control says so
  await page.goto(base + '/parks-app/index.html?drive=toronto-4');
  await expect(page.locator('#sort')).toHaveValue('drive-toronto');
  expect((await names(page))[0]).toBe('Algonquin Provincial Park');
  // changing the sort keeps filters, writes the URL
  await page.locator('#sort').selectOption('name');
  await expect(page).toHaveURL(/sort=name/); await expect(page).toHaveURL(/drive=toronto-4/);
});

test('filters, view, sort and page live in the URL and survive a reload', async ({ page, base }) => {
  await page.goto(base + '/parks-app/index.html?country=ca&region=on&k=nature.protected.state_provincial_park&season=jul&view=cards&sort=name');
  expect(await names(page)).toEqual(['Algonquin Provincial Park', 'Killarney Provincial Park']);
  await expect(page.locator('#views [aria-pressed="true"]')).toHaveText('Cards');
  await page.reload();
  expect(await names(page)).toEqual(['Algonquin Provincial Park', 'Killarney Provincial Park']);
  await page.locator('#q').fill('kill');
  await expect(page).toHaveURL(/q=kill/);
  expect(await names(page)).toEqual(['Killarney Provincial Park']);
});

test('header nav: Home, Parks, Trips, Plan all navigate', async ({ page, base }) => {
  const want = [['Home', '../index.html', /\/index\.html$|\/$/], ['Parks', 'index.html', /\/parks-app\/index\.html$/], ['Trips', '../planner/index.html', /\/planner\/index\.html$/], ['Plan', '../builder/index.html', /\/builder\/index\.html$/]];
  for (const [name, href, url] of want) {
    await page.goto(base + '/parks-app/park.html?slug=banff-national-park');
    const a = page.locator('nav[aria-label="Main"]').getByRole('link', { name, exact: true });
    await expect(a).toHaveAttribute('href', href);
    await a.click();
    await expect(page).toHaveURL(url);
  }
  await page.goto(base + '/parks-app/index.html');
  await expect(page.locator('nav[aria-label="Main"] a[aria-current="page"]')).toHaveText('Parks');
});

test('phone bottom bar: Home, Parks, Mine, Plan with an active state; header tabs hide', async ({ page, base }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/parks-app/index.html');
  const bar = page.locator('#bbar');
  await expect(bar).toBeVisible();
  await expect(page.locator('nav[aria-label="Main"]')).toBeHidden();
  expect(await bar.locator('a').allInnerTexts()).toEqual(['Home', 'Parks', 'Trips', 'Plan']);
  await expect(bar.locator('a[aria-current="page"]')).toHaveText('Parks');
  expect((await bar.boundingBox()).height).toBe(84);
  for (const a of await bar.locator('a').all()) { const b = await a.boundingBox(); expect(b.width).toBeGreaterThanOrEqual(56); expect(b.height).toBeGreaterThanOrEqual(56); }
  // nothing is hidden behind the bar at the end of the page
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const last = await page.locator('.pager').boundingBox(); const bb = await bar.boundingBox();
  expect(last.y + last.height).toBeLessThanOrEqual(bb.y + 1);
  for (const [name, url] of [['Home', /\/index\.html$|\/$/], ['Trips', /\/planner\/index\.html$/], ['Plan', /\/builder\/index\.html$/]]) {
    await page.goto(base + '/parks-app/park.html?slug=jasper-national-park');
    await expect(page.locator('#bbar a[aria-current="page"]')).toHaveText('Parks');
    await page.locator('#bbar').getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(url);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/parks-app/index.html');
  await expect(page.locator('#bbar')).toBeHidden();
});

test('empty result offers the way back', async ({ page, base }) => {
  await page.goto(base + '/parks-app/index.html?q=zzzz');
  await expect(page.getByText('No parks match')).toBeVisible();
  await page.getByRole('button', { name: 'Remove Search' }).click();
  await expect(page.locator('a.prow')).toHaveCount(LISTED.length);
});
