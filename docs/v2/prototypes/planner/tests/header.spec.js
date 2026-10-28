const { test, expect, watch, open, trips } = require('./helpers.js');

test('header chip re-renders when the open trip is deleted and when it is restored', async ({ page, base }) => {
  const errors = watch(page);
  await open(page, base, '/planner/trip.html?id=t-banff');
  await page.goto(base + '/planner/index.html');
  const chip = page.locator('#chip');
  await expect(chip).toContainText('Banff long weekend');
  await expect(chip.locator('.dot')).toBeVisible();
  const card = page.getByRole('article', { name: 'Banff long weekend' });
  await card.getByRole('button', { name: /Menu for Banff/ }).click();
  await card.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(chip).toContainText('No trip open');
  await expect(page.locator('#hdr-nav')).not.toContainText('Today');
  await page.locator('#chip').click();
  await expect(page.locator('#switcher')).not.toContainText('Banff');
  await page.keyboard.press('Escape');
  await page.locator('.toast button', { hasText: 'Undo' }).click();
  await expect(chip).toContainText('Banff long weekend');
  await expect(page.locator('#hdr-nav')).toContainText('Today');
  expect(errors()).toEqual([]);
});

test('header chip follows a rename and a switch; one tap on a trip in the switcher opens it', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites');
  await expect(page.locator('#chip')).toContainText('Dolomites');
  await page.getByRole('textbox', { name: /Trip name/ }).fill('Alps in July');
  await page.getByRole('textbox', { name: /Trip name/ }).press('Enter');
  await expect(page.locator('#chip')).toContainText('Alps in July');
  await page.locator('#chip').click();
  await expect(page.locator('#switcher')).toContainText('Alps in July');
  await page.getByRole('menuitem', { name: /Algonquin/ }).click();
  await expect(page).toHaveURL(/trip\.html\?id=t-algonquin/);
  await expect(page.locator('#chip')).toContainText('Algonquin');
  const dot = await page.locator('#chip .dot').evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(dot).not.toBe('rgba(0, 0, 0, 0)');
});

test('Sign in is a sheet labelled Not in the prototype and creates no account or storage', async ({ page, base }) => {
  await open(page, base, '/planner/index.html');
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  await page.getByRole('button', { name: 'Sign in' }).click();
  const dlg = page.getByRole('dialog', { name: 'Sign in' });
  await expect(dlg).toContainText('Not in the prototype');
  await expect(dlg.locator('input')).toHaveCount(0);
  await dlg.getByRole('button', { name: 'Got it' }).click();
  await expect(dlg).toBeHidden();
  expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(keys);
});

test('Trip home lists the requests from proto.requests with their status under Requests', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-algonquin');
  await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();
  await expect(page.getByText('No requests yet')).toBeVisible();
  await page.evaluate(() => {
    const C = window.ProtoContract, now = Date.now();
    C.addRequest(localStorage, { kind: 'place', name: 'Barron Canyon Trail', note: 'Family-friendly' }, now);
    C.addRequest(localStorage, { kind: 'region', name: 'Tuscany coast', note: '' }, now + 1);
    const l = C.readRequests(localStorage); l[0].status = 'Researching'; l[1].status = 'Added';
    C.writeRequests(localStorage, l);
  });
  await page.reload();
  const panel = page.locator('.panel', { has: page.getByRole('heading', { name: 'Requests' }) });
  await expect(panel.locator('li')).toHaveCount(2);
  await expect(panel.locator('[data-status=Researching]')).toBeVisible();
  await expect(panel.locator('[data-status=Added]')).toBeVisible();
  await expect(panel).toContainText('Barron Canyon Trail');
  await expect(panel).toContainText('Region');
});

test('every proto.trips write goes through the contract: bad data is refused, extras survive a builder-style rewrite', async ({ page, base }) => {
  await open(page, base, '/planner/trip.html?id=t-dolomites');
  const r = await page.evaluate(() => {
    const a = window.P.trips();
    a[0].party = []; a[0].title = '';
    const bad = window.ProtoContract.writeTrips(localStorage, [Object.assign({}, a[0], { id: '' })]);
    const stored = JSON.parse(localStorage.getItem('proto.trips'));
    return { bad: bad.ok, problems: bad.problems.length, still: stored.length };
  });
  expect(r.bad).toBe(false);
  expect(r.still).toBe(3);
  // planner-only fields (item flags, notes) are kept beside the contract record, so a plain contract rewrite does not lose them
  await page.evaluate(() => { const raw = window.ProtoContract.readTrips(localStorage); window.ProtoContract.writeTrips(localStorage, raw); });
  const t = await page.evaluate(() => window.P.get('t-dolomites'));
  expect(t.notes).toMatch(/museum day/);
  expect(t.days.flatMap((d) => d.items).some((i) => i.priv)).toBe(true);
  expect(t.bookings.some((b) => b.kind === 'flight')).toBe(true);
  expect((await trips(page)).length).toBe(3);
});

test('a trip written by the builder in either month form still opens (month number or YYYY-MM)', async ({ page, base }) => {
  await open(page, base, '/planner/index.html');
  await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('proto.trips'));
    a[0].dates = { month: 11 }; a[1].dates = { month: '2027-09' };
    localStorage.setItem('proto.trips', JSON.stringify(a));
  });
  await page.reload();
  await expect(page.getByRole('article', { name: /Algonquin/ })).toContainText('Nov');
  await expect(page.getByRole('article', { name: /Dolomites/ })).toContainText('Sep');
});
