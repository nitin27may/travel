/* Round 3 (design review round 2): overdue wording, plain diff words, toasts vs sheets, house formats, nav names, date chips. */
const { test, expect, watch, open, trips } = require('./helpers.js');

test('an overdue book-by date reads Overdue by N days in the critical colour with an icon, on Overview, Bookings and My trips', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-algonquin');
  const panel = page.locator('.panel', { has: page.getByRole('heading', { name: 'Next to book' }) });
  const chip = panel.locator('[data-overdue]');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText(/^\s*Overdue by \d+ days?/);
  await expect(chip.locator('svg')).toBeVisible();
  await expect(panel).not.toContainText('days from today');
  const crit = await page.evaluate(() => getComputedStyle(document.querySelector('[data-overdue]')).color);
  const want = await page.evaluate(() => { const e = document.createElement('i'); e.style.color = 'var(--crit)'; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; });
  expect(crit).toBe(want);
  await page.getByRole('tab', { name: /Bookings/ }).click();
  await expect(page.locator('.rrow .chip.crit', { hasText: 'Overdue by' }).first()).toBeVisible();
  await page.goto(base + '/planner/index.html');
  await expect(page.getByRole('article', { name: /Algonquin/ }).locator('[data-overdue]')).toContainText('Overdue by');
});

test('diff sheet uses plain words and keeps base towns out of Added', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites#travellers');
  await page.getByRole('button', { name: 'Add infant' }).click();
  const sheet = page.getByRole('dialog', { name: /Plan changes/ });
  await expect(sheet).toBeVisible();
  await expect(sheet).not.toContainText(/Not for age/);
  await expect(sheet.locator('[data-diff=removed]').first()).toContainText('Not suitable for an infant');
  expect((await sheet.locator('[data-diff=added]').allInnerTexts()).join(' ')).not.toMatch(/Ortisei|Cortina/);
  await expect(sheet).toContainText('Bases: Ortisei, Cortina');
});

test('a toddler is called a toddler in the diff', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites#travellers');
  await page.getByLabel('Age').first().fill('2');
  await page.getByLabel('Age').first().press('Tab');
  await expect(page.getByRole('dialog').locator('[data-diff=removed]').first()).toContainText(/toddler/);
});

test('a toast never covers the date sheet: toasts are held until the sheet closes', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites');
  await page.evaluate(() => window.P.toast('Earlier action', () => {}));
  await expect(page.locator('.toast')).toHaveCount(1);
  await page.getByRole('button', { name: 'Change dates' }).click();
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.evaluate(() => window.P.toast('During sheet'));
  await expect(page.locator('.toast')).toHaveCount(0);
  const save = page.getByRole('button', { name: 'Save dates' });
  const box = await save.boundingBox();
  const top = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && (e.closest('.toast') ? 'toast' : e.textContent.trim()); }, [box.x + box.width / 2, box.y + box.height / 2]);
  expect(top).toBe('Save dates');
  await page.keyboard.press('Escape');
  await expect(page.locator('.toast', { hasText: 'During sheet' })).toBeVisible();
});

test('durations use the builder format and money is named once in the trip currency', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites');
  const drive = await page.locator('.stat', { hasText: 'Driving' }).locator('b').innerText();
  expect(drive).toMatch(/^(\d+ h( \d\d)?|\d+ min) ≈$/);
  const cost = await page.locator('.stat', { hasText: 'Known costs' }).locator('b').innerText();
  expect(cost).toMatch(/^EUR [\d,]+$/);
  expect(cost).not.toContain('$');
  await page.getByRole('tab', { name: 'Costs' }).click();
  await expect(page.locator('.callout')).toContainText(/EUR [\d,]+ known/);
  await expect(page.locator('.callout')).toContainText('Amounts are in EUR');
  await expect(page.locator('#app')).not.toContainText('$');
  await page.goto(base + '/planner/trip.html?id=t-banff');
  expect(await page.locator('.stat', { hasText: 'Known costs' }).locator('b').innerText()).toMatch(/^CAD /);
  const fd = await page.evaluate(() => [window.ProtoEngine.fd(260), window.P.mins(260), window.P.mins(45), window.P.mins(120)]);
  expect(fd).toEqual(['4 h 20', '4 h 20', '45 min', '2 h']);
});

test('header nav is Home, Parks, Trips, Plan, with Trips current, and the links go to the other apps', async ({ page, base }) => {
  await open(page, base, '/planner/index.html');
  const nav = page.getByRole('navigation', { name: 'Main' });
  expect(await nav.getByRole('link').allInnerTexts()).toEqual(['Home', 'Parks', 'Trips', 'Plan']);
  await expect(nav.getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page');
  expect(await nav.getByRole('link', { name: 'Parks' }).getAttribute('href')).toBe('../parks-app/index.html');
  expect(await nav.getByRole('link', { name: 'Plan' }).getAttribute('href')).toBe('/builder/index.html');
  await page.goto(base + '/planner/trip.html?id=t-banff');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page');
});

test('the date sheet uses the builder chips: A month, Exact dates, Flexible, plus Next and This weekend for a weekend trip', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-algonquin');
  await page.getByRole('button', { name: 'Change dates' }).click();
  const dlg = page.getByRole('dialog');
  expect(await dlg.locator('.seg .pill').allInnerTexts()).toEqual(['Next weekend', 'This weekend', 'A month', 'Exact dates', 'Flexible']);
  const pill = await dlg.locator('.pill').first().evaluate((e) => { const c = getComputedStyle(e); return [c.minHeight, c.borderRadius, c.borderTopWidth]; });
  expect(pill).toEqual(['44px', '999px', '1px']);
  await dlg.getByRole('button', { name: 'This weekend' }).click();
  expect(await dlg.getByLabel('First day').inputValue()).toBe('2026-10-30');
  expect(await dlg.getByLabel('Nights').inputValue()).toBe('2');
  await dlg.getByRole('button', { name: 'Save dates' }).click();
  expect((await trips(page)).find((t) => t.id === 't-algonquin').dates).toEqual({ from: '2026-10-30', to: '2026-11-01' });
  await page.goto(base + '/planner/trip.html?id=t-dolomites');
  await page.getByRole('button', { name: 'Change dates' }).click();
  expect(await page.getByRole('dialog').locator('.seg .pill').allInnerTexts()).toEqual(['A month', 'Exact dates', 'Flexible']);
});

test('the theme button saves proto.theme through shared/theme.js, applies before first paint and carries to the other apps', async ({ page, base }) => {
  await open(page, base, '/planner/index.html');
  await page.getByRole('button', { name: 'Switch theme' }).click();
  expect(await page.evaluate(() => localStorage.getItem('proto.theme'))).toBe('dark');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await page.evaluate(() => localStorage.getItem('travel:v1:theme'))).toBeNull();
  // applied before first paint: the attribute is already set when the first stylesheet-dependent script runs
  await page.addInitScript(() => { document.addEventListener('readystatechange', () => { if (document.readyState === 'interactive') window.__t = document.documentElement.dataset.theme; }); });
  await page.goto(base + '/planner/trip.html?id=t-banff');
  expect(await page.evaluate(() => window.__t)).toBe('dark');
  await page.goto(base + '/builder/index.html?fast');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.goto(base + '/planner/print.html?id=t-banff');
  await page.getByRole('button', { name: 'Switch theme' }).click();
  expect(await page.evaluate(() => localStorage.getItem('proto.theme'))).toBe('light');
});
