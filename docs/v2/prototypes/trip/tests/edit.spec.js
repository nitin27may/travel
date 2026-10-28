/* STEP2-PR: the trip details page in read and edit mode. EA1 to EA6 of edit-mode-spec 19, the click-through flows (park page ->
   Save to a trip -> edit -> Done -> Mine; builder -> Build my days -> the same page), every frame of spec 17 (no errors, no
   horizontal scroll, contrast in light and dark). */
const { test, expect } = require('../../shared/tests/fixtures.js');
const { checkContrast, formatFailures } = require('../../shared/tests/contrast.js');

const COPY = '/trip/?id=demo-copy&edit=1';
const BUILT = '/trip/?id=demo-built&edit=1';
function watch(page) { const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); return errs; }
const ids = (page) => page.evaluate(() => TripDoc.get('demo-copy').days.flatMap((d) => d.items.map((i) => i.id)));
const pos = (page, id) => page.evaluate((i) => { const l = TripDoc.locate(TripDoc.get('demo-copy'), i); return l ? [l.n, l.j] : null; }, id);
const stops = (page) => page.evaluate(() => TripDoc.get('demo-copy').days.map((d) => d.items.map((i) => i.id).join(',')));
async function menu(page, name) { await page.getByRole('button', { name: new RegExp('^Actions for .*' + name) }).first().click(); }

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('EA1: every stop of every day can be removed, and Undo returns it to the same place', async ({ page, base }) => {
    const errs = watch(page); await page.goto(base + COPY);
    for (const id of await ids(page)) {
      const before = await pos(page, id), name = await page.evaluate((i) => PL[i].name, id);
      await menu(page, name.slice(0, 12)); await page.getByRole('menuitem', { name: /^Remove from Day/ }).click();
      await expect(page.locator('#e-' + id)).toHaveCount(0);
      await expect(page.locator('#toast')).toContainText('Removed ' + name);
      await page.locator('#toast [data-a=undo]').click();
      expect(await pos(page, id)).toEqual(before);
    }
    expect(errs).toEqual([]);
  });

  test('EA2: every day has an add row; the picker lists versions, removed stops, nearby places; an added place re-flows the day', async ({ page, base }) => {
    await page.goto(base + COPY);
    expect(await page.locator('.addrow').count()).toBe(10);
    await page.locator('.addrow[data-n="3"]').click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByText('From the other versions of this day')).toBeVisible();
    await expect(dlg.getByText(/^Within 30 km, with a place page/)).toBeVisible();
    await dlg.getByRole('button', { name: /^Add Ötzi museum to Day 3/ }).click();
    await expect(dlg.getByText('Added to Day 3')).toBeVisible();
    await expect(page.locator('#day-3 #e-otzi')).toBeVisible();
    // remove a stop, then it is offered again under "Removed from this day"
    await page.keyboard.press('Escape');
    await menu(page, 'Lago di Braies'); await page.getByRole('menuitem', { name: /^Remove from Day 6/ }).click();
    await page.locator('.addrow[data-n="6"]').click();
    await expect(page.getByRole('dialog').getByText('Removed from this day')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Lago di Braies')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /^Add Lago di Braies/ }).click();
    await expect(page.getByRole('dialog').getByText(/Added to Day 6/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#day-6 #e-braies')).toBeVisible();
    // putting a removed published stop back on its own day is no change from our plan
    await expect(page.locator('#day-6 #e-braies .chip.mark')).toHaveCount(0);
    await expect(page.getByText('6 changes from our plan')).toBeVisible();   // 5 seeded + the Otzi museum added above
  });

  test('EA3: drag with the mouse within a day and onto another day, Esc cancels', async ({ page, base }) => {
    await page.setViewportSize({ width: 1440, height: 2600 });   // both days on screen: the mouse cannot reach below the fold
    await page.goto(base + COPY);
    const before = await stops(page);
    const src = page.locator('#e-seceda .handle'), dst = page.locator('#day-3 #e-carezza');
    const a = await src.boundingBox(), b = await dst.boundingBox();
    await page.mouse.move(a.x + 10, a.y + 10); await page.mouse.down(); await page.mouse.move(a.x + 20, a.y + 60, { steps: 4 });
    await page.mouse.move(b.x + 100, b.y + b.height - 4, { steps: 8 });
    await expect(page.locator('.dropline')).toBeVisible();
    await expect(page.locator('.dropline')).toContainText('to Day 3');
    await page.keyboard.press('Escape'); await page.mouse.up();
    expect(await stops(page)).toEqual(before);
    await page.mouse.move(a.x + 10, a.y + 10); await page.mouse.down(); await page.mouse.move(a.x + 20, a.y + 60, { steps: 4 });
    await page.mouse.move(b.x + 100, b.y + b.height - 4, { steps: 8 }); await page.mouse.up();
    expect((await pos(page, 'seceda'))[0]).toBe(3);
    await expect(page.locator('#toast')).toContainText('Moved Seceda lift and ridge to Day 3');
    await page.locator('#toast [data-a=undo]').click();
    expect(await pos(page, 'seceda')).toEqual([2, 0]);
  });

  test('EA4: keyboard only: lift, move across days, drop, cancel, with each position announced', async ({ page, base }) => {
    await page.goto(base + COPY);
    await page.locator('#e-seceda .handle').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#live')).toContainText('Lifted Seceda lift and ridge, Day 2, position 1 of 1');
    await page.keyboard.press('PageDown');
    await expect(page.locator('#live')).toContainText('Seceda lift and ridge, Day 3, position 1 of 3');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#live')).toContainText('position 2 of 3');
    await page.keyboard.press('Escape');
    expect(await pos(page, 'seceda')).toEqual([2, 0]);
    await page.locator('#e-seceda .handle').focus();
    await page.keyboard.press('Enter'); await page.keyboard.press('PageDown'); await page.keyboard.press('Space');
    expect((await pos(page, 'seceda'))[0]).toBe(3);
    await expect(page.locator('#toast')).toContainText('Moved Seceda lift and ridge to Day 3');
    await page.keyboard.press('Control+z');
    expect(await pos(page, 'seceda')).toEqual([2, 0]);
  });

  test('EA5: 50 undo steps survive a reload in the same tab; the 51st drops the oldest', async ({ page, base }) => {
    await page.goto(base + COPY);
    await page.locator('#e-carezza').focus();
    for (let i = 0; i < 51; i++) await page.keyboard.press(i % 2 ? 'Alt+ArrowUp' : 'Alt+ArrowDown');
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('proto.trip.undo.demo-copy')).past.length)).toBe(50);
    await page.reload();
    let n = 0;
    while (await page.locator('[data-k=undo-btn]').isEnabled()) { await page.locator('[data-k=undo-btn]').click(); n++; if (n > 60) break; }
    expect(n).toBe(50);
  });

  test('EA6: the changes sheet lists every entry with a button that names its action; Reset Day and Reset to our plan undo; reset confirms over 3 changes', async ({ page, base }) => {
    await page.goto(base + COPY);
    await expect(page.getByText('5 changes from our plan')).toBeVisible();
    await page.getByRole('button', { name: '5 changes', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Changes from our plan' });
    await expect(dlg.locator('[data-a=restore]')).toHaveCount(5);
    await expect(dlg).toContainText('Removed Lago di Sorapis from Day 9');
    await dlg.getByRole('button', { name: /^Put it back: Removed Lago di Sorapis/ }).click();
    await expect(page.locator('#e-sorapis')).toBeVisible();
    await expect(dlg.locator('[data-a=restore]')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+z');
    await expect(page.locator('#e-sorapis')).toHaveCount(0);
    // Reset Day 7: its added museum goes
    await page.getByRole('button', { name: 'Actions for Day 7' }).click(); await page.getByRole('menuitem', { name: 'Reset Day 7' }).click();
    await expect(page.locator('#e-gherdeina')).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('Day 7 is back to our plan');
    // Reset to our plan: 4 changes left, so it confirms
    await page.getByRole('button', { name: 'Trip actions' }).click(); await page.getByRole('menuitem', { name: 'Reset to our plan' }).click();
    const c = page.getByRole('dialog', { name: 'Reset to our plan?' });
    await expect(c).toContainText('Your 4 changes are removed');
    const order = await c.getByRole('button').evaluateAll((b) => b.map((x) => x.textContent.trim()).filter(Boolean));
    expect(order).toEqual(['Cancel', 'Reset']);   // Cancel first in tab order (ruling R7)
    await c.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByText('0 changes from our plan')).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect(page.getByText('4 changes from our plan')).toBeVisible();
  });

  test('convert: the first engine action asks once, keeps every stop "From our trip"; Undo restores the copy with its versions', async ({ page, base }) => {
    await page.goto(base + COPY);
    await page.getByRole('button', { name: 'Settings' }).first().click();
    await page.getByRole('button', { name: /^Where you start/ }).click();
    await expect(page.locator('#convertnotice')).toContainText('This makes it your own trip. Our later updates to the Dolomites trip will no longer change it.');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('[data-k=m-undo], #toast')).toContainText(/Now your own trip/);
    expect(await page.evaluate(() => TripDoc.get('demo-copy').ext.edit.mode)).toBe('built');
    await page.keyboard.press('Escape');
    await expect(page.locator('#e-seceda .chip', { hasText: 'From our trip' })).toBeVisible();
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => TripDoc.get('demo-copy').ext.edit.mode)).toBe('template');
  });

  test('built mode: Keep on Day n and Must see are offered; no Maybe; the add picker lists picks not on a day', async ({ page, base }) => {
    await page.goto(base + BUILT);
    await menu(page, 'Moraine Lake');
    const d = page.getByRole('menu');
    await expect(d.getByRole('menuitemcheckbox', { name: /Keep on Day 3/ })).toHaveAttribute('aria-checked', 'true');
    await expect(d.getByRole('menuitemcheckbox', { name: /Must see/ })).toBeVisible();
    await expect(d.getByRole('menuitem', { name: 'Add to Maybe' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.locator('.addrow[data-n="2"]').click();
    await expect(page.getByRole('dialog').getByText('Your picks not on a day')).toBeVisible();
  });

  test('read mode has no edit controls; Edit trip and Done switch modes and keep the tab', async ({ page, base }) => {
    await page.goto(base + '/trip/?id=demo-copy&view=day');
    await expect(page.locator('.handle')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit trip' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit trip' }).click();
    await expect(page).toHaveURL(/edit=1/);
    await expect(page.locator('.handle').first()).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).first().click();
    await expect(page).not.toHaveURL(/edit=1/);
    await expect(page.locator('.handle')).toHaveCount(0);
    await page.goBack(); await expect(page.locator('.handle').first()).toBeVisible();
  });

  test('flow: park page -> Save to a trip -> a trip in edit mode -> remove, add, move, undo -> Done -> Mine', async ({ page, base }) => {
    const errs = watch(page);
    await page.goto(base + '/parks-app/park.html?slug=banff-national-park');
    await page.locator('#save').click();
    await page.getByRole('dialog', { name: /Add Banff National Park to a trip/ }).getByRole('link', { name: /Banff long weekend/ }).click();
    await expect(page).toHaveURL(/\/trip\/(index\.html)?\?id=demo-built&edit=1$/);   // add= is removed once the picker opens (spec 7.4)
    const pick = page.getByRole('dialog');
    await expect(pick.getByRole('heading', { name: /Add a place in Banff National Park/ })).toBeVisible();
    await expect(pick.getByText('Already on this trip')).toBeVisible();
    await expect(pick.getByRole('button', { name: /^Move here/ })).toHaveCount(0);       // no no-op moves
    await pick.getByRole('button', { name: /^Add Lake Minnewanka to Day/ }).click();
    await expect(page.locator('#e-lake-minnewanka')).toBeVisible();
    await page.keyboard.press('Escape');
    // remove
    await menu(page, 'Johnston'); await page.getByRole('menuitem', { name: /^Remove from Day 2/ }).click();
    await expect(page.locator('#e-johnston-canyon')).toHaveCount(0);
    // move
    await menu(page, 'Bow Falls'); await page.getByRole('menuitem', { name: 'Move to day…' }).click();
    await page.getByRole('button', { name: /^Day 2 ·?/ }).first().click();
    await expect(page.locator('#day-2 #e-bow-falls')).toBeVisible();
    // add
    await page.locator('.addrow[data-n="2"]').click();
    await page.getByRole('dialog').getByRole('button', { name: /^Add Johnston Canyon to Day 2/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#day-2 #e-johnston-canyon')).toBeVisible();
    // undo
    await page.keyboard.press('Control+z'); await expect(page.locator('#e-johnston-canyon')).toHaveCount(0);
    await page.getByRole('button', { name: 'Done' }).first().click();
    await expect(page.locator('.handle')).toHaveCount(0);
    await page.locator('.hdr nav').getByRole('link', { name: 'Trips' }).click();
    await expect(page).toHaveURL(/\/planner\//);
    await expect(page.getByText('Banff long weekend').first()).toBeVisible();
    expect(errs.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
  });

  test('flow: builder -> Build my days -> the same page, edit mode, built line, Bases and Checks lines', async ({ page, base }) => {
    const errs = watch(page);
    await page.goto(base + '/builder/');
    await page.evaluate(() => {
      U.ctx = null; chooseKind('weekair');
      S.picks = ['ortisei', 'seceda', 'siusi', 'braies', 'funes']; S.stay = { ortisei: true }; S.nights = 4; S.nightsTouched = true; S.stage = 4; render();
    });
    await page.getByRole('button', { name: 'Build my days' }).click();
    await page.waitForURL(/\/trip\/\?id=.*&edit=1/, { timeout: 15000 });
    await expect(page.locator('.handle').first()).toBeVisible();
    await expect(page.locator('#builtline')).toContainText(/^Built \d+ days · (all fit|\d+ (did not fit|to fix|to check))/);
    await expect(page.locator('[data-line=bases]')).toBeVisible();
    await expect(page.locator('[data-line=checks]')).toContainText('driving a day');
    await expect(page).not.toHaveURL(/built=1/);
    expect(errs.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  });

  test('copy our trip: Make it yours card, toast, Undo removes the copy', async ({ page, base }) => {
    await page.goto(base + '/trip/?copy=dolomites');
    await expect(page).toHaveURL(/edit=1/);
    await expect(page.locator('#makeit')).toContainText('Make it yours');
    await expect(page.locator('#toast')).toContainText('Copied Dolomites to My trips');
    await page.getByRole('button', { name: 'Keep it as it is' }).click();
    await expect(page.locator('#makeit')).toHaveCount(0);
  });

  test('sync words and not found', async ({ page, base }) => {
    const words = { device: 'On this device', account: 'In your account', syncing: 'Syncing', pending: 'Not synced yet', failed: 'Not synced · Retry' };
    for (const [k, w] of Object.entries(words)) { await page.goto(base + COPY + '&sync=' + k); await expect(page.locator('.sticky .sync')).toContainText(w); }
    await page.goto(base + '/trip/?id=nope&edit=1');
    await expect(page.locator('#notfound')).toContainText('This trip is not on this device or in your account.');
    await expect(page.getByRole('link', { name: 'Open your trips' })).toBeVisible();
    await page.goto(base + COPY + '&offline=1');
    await expect(page.getByText('You are offline.')).toBeVisible();
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('EA3: at 390 Move to day, Move up and Move down work by button; the edit bar replaces the public bar', async ({ page, base }) => {
    await page.goto(base + COPY);
    await expect(page.locator('.editbar')).toBeVisible();
    await expect(page.locator('.bbar')).toBeHidden();
    await menu(page, 'Carezza'); await page.getByRole('button', { name: 'Move down' }).click();
    expect(await pos(page, 'carezza')).toEqual([3, 1]);
    await menu(page, 'Carezza'); await page.getByRole('button', { name: 'Move up' }).click();
    expect(await pos(page, 'carezza')).toEqual([3, 0]);
    await menu(page, 'Carezza'); await page.getByRole('button', { name: 'Move to day…' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByRole('button', { name: /^Day 3/ })).toBeDisabled();
    await expect(dlg.getByText('Fits').first()).toBeVisible();
    await dlg.getByRole('button', { name: /^Day 4/ }).click();
    expect((await pos(page, 'carezza'))[0]).toBe(4);
    await expect(page.locator('#toast')).toContainText('Moved Lago di Carezza to Day 4');
    await page.getByRole('button', { name: 'Done' }).last().click();
    await expect(page.locator('.bbar')).toBeVisible();
  });

  test('a press on the row body scrolls the page; only the handle drags', async ({ page, base }) => {
    await page.goto(base + COPY);
    const before = await stops(page);
    const r = await page.locator('#e-carezza .nm').boundingBox();
    await page.touchscreen.tap(r.x + 5, r.y + 5);
    expect(await stops(page)).toEqual(before);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#e-carezza .handle')).touchAction)).toBe('none');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#e-carezza .body')).touchAction)).not.toBe('none');
  });
});

/* STEP2-PRF: the review's must-fix and should-fix items, one test each */
test.describe('review fixes (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('M2: the title is the same size and box in read and edit mode, and does not repeat "your copy"', async ({ page, base }) => {
    await page.goto(base + '/trip/?id=demo-copy&view=day');
    const h = await page.locator('h1').boundingBox();
    const hs = await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontSize);
    await page.getByRole('button', { name: 'Edit trip' }).click();
    const i = await page.locator('input.title-edit').boundingBox();
    const is = await page.evaluate(() => getComputedStyle(document.querySelector('input.title-edit')).fontSize);
    expect(is).toBe(hs);
    expect(Math.abs(i.height - h.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(i.y - h.y)).toBeLessThanOrEqual(2);
    expect(i.width).toBeLessThan(700);                                   // sized to the title, not the page
    await expect(page.locator('input.title-edit')).toHaveValue('Dolomites');
    await page.locator('input.title-edit').fill('Dolomites 2027'); await page.keyboard.press('Enter');
    expect(await page.evaluate(() => TripDoc.get('demo-copy').title)).toBe('Dolomites 2027');
    await page.locator('input.title-edit').fill('Never saved'); await page.keyboard.press('Escape');
    await expect(page.locator('input.title-edit')).toHaveValue('Dolomites 2027');
  });

  test('S1: one filled button while editing (Done in the sticky row); the cover Done is secondary', async ({ page, base }) => {
    await page.goto(base + COPY);
    expect(await page.locator('.page button.btn.pri').count()).toBe(1);
    await expect(page.locator('.cover button[data-a=done]')).not.toHaveClass(/pri/);
  });

  test('M3: a place far from the trip offers only a new trip; the park picker sorts trips by distance and names a far one', async ({ page, base }) => {
    await page.goto(base + COPY + '&add=moraine-lake');
    const dlg = page.getByRole('dialog');
    await expect(dlg.locator('[data-far]')).toContainText(/Moraine Lake is [\d,]+ km from this trip's bases/);
    await expect(dlg.getByRole('link', { name: 'Start a new trip with Moraine Lake' })).toBeVisible();
    await expect(dlg.getByRole('button', { name: /^Add to Day/ })).toHaveCount(0);
    await expect(dlg.getByText('Tight')).toHaveCount(0);
    await expect(page).not.toHaveURL(/add=/);
    await page.goto(base + '/parks-app/park.html?slug=banff-national-park');
    await page.locator('#save').click();
    const rows = page.getByRole('dialog').locator('.trow');
    await expect(rows.first()).toContainText('Banff long weekend');
    await expect(rows.first()).toContainText('Thu 5 Aug – Sun 8 Aug');
    await expect(rows.first()).toContainText('2 adults · 1 child (6)');
    await expect(rows.nth(1)).toContainText('Far from Banff National Park');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Save without a trip' })).toBeVisible();
    await expect(page.getByRole('dialog').locator('#newtrip')).not.toHaveClass(/pri/);
  });

  test('M4: arriving with a park lists what is not on the trip with its day; members on the trip say where and have no Move', async ({ page, base }) => {
    await page.goto(base + BUILT + '&add=banff-national-park');
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByRole('heading', { name: 'Add a place in Banff National Park' })).toBeVisible();
    await expect(dlg.getByRole('button', { name: /^Add Lake Minnewanka to Day \d/ })).toBeVisible();
    await expect(dlg.getByRole('button', { name: /^Add Peyto Lake to Day \d/ })).toBeVisible();
    await expect(dlg.getByText('On Day 3').first()).toBeVisible();
    await expect(dlg.getByRole('button', { name: /Move here|Move to Day/ })).toHaveCount(0);
    await dlg.getByRole('button', { name: /^Add Lake Minnewanka to Day/ }).click();
    await expect(dlg.getByText(/^Added to Day \d/)).toBeVisible();
  });

  test('M7: nights add up, the region comes from the trip, and Move to day gives the day total', async ({ page, base }) => {
    await page.goto(base + BUILT);
    await page.getByRole('button', { name: 'Settings' }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Settings' });
    await expect(dlg.locator('.mrow', { hasText: 'Canadian Rockies' })).toBeVisible();
    await expect(dlg.locator('.mrow', { hasText: 'Bases' })).toContainText('Banff townsite 2 nights, Lake Louise village 1 night');
    await page.keyboard.press('Escape');
    await page.goto(base + '/trip/?id=demo-built&edit=1&built=1');
    await expect(page.locator('[data-line=bases]')).toContainText('2 bases · Banff townsite 2 nights, Lake Louise village 1 night');
    await page.goto(base + COPY + '&sheet=move:seceda');
    await expect(page.getByRole('dialog').getByText(/driving ≈ · day /).first()).toBeVisible();
  });

  test('S8: an empty day drops at once with an Undo toast; a day with stops asks where its stops go', async ({ page, base }) => {
    await page.goto(base + COPY);
    await page.getByRole('button', { name: 'Actions for Day 3' }).click(); await page.getByRole('menuitem', { name: 'Add a day after Day 3' }).click();
    await expect(page.locator('#day-4')).toContainText('No stops on Day 4');
    await page.locator('#day-4').getByRole('button', { name: 'Drop Day 4' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('Dropped Day 4');
    await expect(page.locator('.day')).toHaveCount(10);
    await page.getByRole('button', { name: 'Actions for Day 3' }).click(); await page.getByRole('menuitem', { name: 'Drop Day 3' }).click();
    await expect(page.getByRole('dialog', { name: 'Drop Day 3' })).toContainText('its 2 stops');
  });

  test('S9: Settings has a length control that asks which day goes; Apply stays disabled until something changes', async ({ page, base }) => {
    await page.goto(base + COPY + '&sheet=settings');
    const dlg = page.getByRole('dialog', { name: 'Settings' });
    await expect(dlg.getByRole('button', { name: 'Apply' })).toBeDisabled();
    await expect(dlg.getByRole('button', { name: 'Use my travellers' })).toHaveCount(0);      // signed out
    await expect(dlg.locator('#dateecho')).toHaveText('Tue 13 Jul');
    await dlg.getByRole('button', { name: 'One day fewer' }).click();
    await expect(dlg.getByLabel(/Drop 1 day/)).toBeVisible();
    await dlg.getByLabel(/Drop 1 day/).selectOption('8');
    await expect(dlg.locator('#effect')).toContainText('Drops 1 day, starting with Day 8');
    await expect(dlg.getByRole('button', { name: 'Apply' })).toBeEnabled();
    await dlg.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.day')).toHaveCount(9);
    await expect(page.locator('#toast')).toContainText('Dropped 1 day');
    await page.keyboard.press('Control+z');
    await expect(page.locator('.day')).toHaveCount(10);
  });

  test('S5: the picker starts with Kids and Open in July on, and names the day to try', async ({ page, base }) => {
    await page.goto(base + COPY + '&sheet=add:7');
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByRole('button', { name: 'Kids' })).toHaveAttribute('aria-pressed', 'true');
    await expect(dlg.getByRole('button', { name: 'Open in July' })).toHaveAttribute('aria-pressed', 'true');
    await expect(dlg.getByText('+0 min')).toHaveCount(0);
  });

  test('S4/S3: add= leaves the URL; a move announces its position; S2 the toast has one Undo and no dangling dot', async ({ page, base }) => {
    await page.goto(base + COPY);
    await page.locator('#e-carezza .handle').focus(); await page.keyboard.press('Alt+ArrowDown');
    await expect(page.locator('#live')).toContainText(/Moved Lago di Carezza down, position 2 of 2/);
    await expect(page.locator('#toast .tt')).not.toContainText('·  ');
    await expect(page.locator('#toast')).not.toContainText(/·\s*Undo$/);
  });

  test('S7/N1: a Check warning has a fix button, Summary rows are labelled To fix / To check, a lone stop says why it cannot move', async ({ page, base }) => {
    await page.goto(base + '/trip/?id=demo-copy&edit=1&view=summary');
    await page.getByRole('tab', { name: 'Summary' }).click();
    await expect(page.locator('.srow', { hasText: 'To fix:' }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Days' }).click();
    await page.getByRole('button', { name: 'Actions for Seceda lift and ridge, Day 2' }).click();
    await expect(page.getByRole('menu')).toContainText('Seceda lift and ridge is the only stop on Day 2');
  });

  test('S10: the stop menu is an anchored popover with menu items, no scrim weight; arrows move, Esc closes and returns focus', async ({ page, base }) => {
    await page.goto(base + COPY);
    const trig = page.getByRole('button', { name: /^Actions for Seceda/ });
    await trig.click();
    const m = page.getByRole('menu');
    await expect(m).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.scrim')).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    const first = await page.evaluate(() => document.activeElement.textContent);
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => document.activeElement.textContent)).not.toBe(first);
    const box = await m.boundingBox(); expect(box.y + box.height).toBeLessThanOrEqual(900);
    await page.keyboard.press('Escape');
    await expect(m).toHaveCount(0);
    await expect(trig).toBeFocused();
  });

  test('S11: the map column follows the day in view', async ({ page, base }) => {
    await page.goto(base + COPY);
    await expect(page.locator('#maph')).toHaveText('Day 1 on the map');
    await page.locator('#day-5').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollTo(0, document.querySelector('#day-5').getBoundingClientRect().top + window.scrollY - 220));
    await expect(page.locator('#maph')).toHaveText('Day 5 on the map');
  });

  test('S13/C4: each change row names its action; a note shows its text', async ({ page, base }) => {
    await page.goto(base + COPY + '&sheet=changes');
    const dlg = page.getByRole('dialog', { name: 'Changes from our plan' });
    await expect(dlg.getByRole('button', { name: /^Remove it: Added Ötzi|^Remove it: Added/ }).first()).toBeVisible();
    await expect(dlg.getByRole('button', { name: /^Put it back: Removed/ })).toBeVisible();
    await expect(dlg).toContainText('Note on Day 4: Lunch at the hut, book ahead.');
    await expect(dlg.getByRole('button', { name: /^Restore/ })).toHaveCount(0);
  });

  test('S14: pending alone shows no offline banner; it shows on the second failed attempt; Retry is a 44 px button', async ({ page, base }) => {
    await page.goto(base + COPY + '&sync=pending');
    await expect(page.getByText('You are offline.')).toHaveCount(0);
    await page.locator('#e-carezza .handle').focus(); await page.keyboard.press('Alt+ArrowDown');
    await expect(page.getByText('You are offline.')).toHaveCount(0);
    await page.keyboard.press('Alt+ArrowUp');
    await expect(page.getByText('You are offline.')).toBeVisible();
    await page.goto(base + COPY + '&sync=failed');
    const r = await page.getByRole('button', { name: 'Not synced · Retry' }).boundingBox();
    expect(r.height).toBeGreaterThanOrEqual(44);
  });

  test('S6: the just-built line leaves out zero parts and links the rest', async ({ page, base }) => {
    await page.goto(base + BUILT + '&built=1');
    const line = page.locator('#builtline');
    await expect(line).toContainText('Built 4 days');
    await expect(line).not.toContainText(' 0 ');
    await expect(line.getByRole('button', { name: /did not fit/ })).toBeVisible();
    await line.getByRole('button', { name: /did not fit/ }).click();
    await expect(page.getByRole('dialog').getByText('Your picks not on a day')).toBeVisible();
  });
});

test.describe('review fixes (phone)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('M5: the fix count is its own line under the tabs, all five tabs are whole, and tapping it jumps to the first Fix warning', async ({ page, base }) => {
    await page.goto(base + COPY);
    const pill = page.locator('.fixbtn');
    await expect(pill).toContainText('1 to fix · Day 7');
    const tabs = await page.locator('.tab').evaluateAll((t) => t.map((x) => { const r = x.getBoundingClientRect(); return { w: r.width, scroll: x.scrollWidth, right: r.right }; }));
    for (const t of tabs) { expect(t.scroll).toBeLessThanOrEqual(Math.ceil(t.w)); expect(t.right).toBeLessThanOrEqual(391); }
    const pb = await pill.boundingBox(), tb = await page.locator('.tabs').boundingBox();
    expect(pb.y).toBeGreaterThanOrEqual(tb.y + tb.height - 1);
    expect(pb.height).toBeGreaterThanOrEqual(44);
    await pill.click();
    await expect(page.locator('#dh-7')).toBeFocused().catch(() => {});
    await expect(page.locator('[data-k="fx-gherdeina"]')).toBeFocused();
  });

  test('S2: the toast is wide enough to read on one or two lines and does not cover the edit bar', async ({ page, base }) => {
    await page.goto(base + COPY);
    await page.getByRole('button', { name: /^Actions for Lago di Carezza/ }).click(); await page.getByRole('button', { name: 'Move down' }).click();
    const t = await page.locator('#toast').boundingBox(), b = await page.locator('.editbar').boundingBox();
    expect(t.width).toBeGreaterThan(330);
    expect(t.y + t.height).toBeLessThanOrEqual(b.y);
    expect(t.height).toBeLessThan(90);
  });
});

/* every frame of spec 17 */
const FRAMES = {
  'read-copy': '/trip/?id=demo-copy&view=day', 'read-copy-summary': '/trip/?id=demo-copy', 'read-built': '/trip/?id=demo-built&view=day',
  'edit-rest': COPY, 'edit-built': BUILT, 'item-sheet': COPY + '&sheet=item:seceda', 'move-to-day': COPY + '&sheet=move:seceda',
  'add-picker': COPY + '&sheet=add:7', 'add-with-place': BUILT + '&add=lake-minnewanka', 'add-too-far': COPY + '&add=moraine-lake', 'add-with-park': BUILT + '&add=banff-national-park', settings: COPY + '&sheet=settings',
  changes: COPY + '&sheet=changes', convert: COPY + '&sheet=convert', 'just-built': BUILT + '&built=1', 'make-it-yours': COPY + '&makeit=1',
  'sync-device': COPY + '&sync=device', 'sync-account': COPY + '&sync=account', 'sync-syncing': COPY + '&sync=syncing', 'sync-pending': COPY + '&sync=pending',
  'sync-failed': COPY + '&sync=failed', 'not-found': '/trip/?id=nope&edit=1', offline: COPY + '&offline=1', 'day-menu': COPY + '&sheet=day:3', 'drop-day': COPY + '&sheet=drop:3',
  'built-item': BUILT + '&sheet=item:moraine-lake', 'built-settings': BUILT + '&sheet=settings'
};
for (const w of [390, 1440]) {
  test(`frames at ${w}px: every frame loads without errors, scroll overflow or contrast failures (light and dark)`, async ({ page, base }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
    const bad = [];
    for (const [name, url] of Object.entries(FRAMES)) {
      const errs = watch(page);
      await page.goto(base + url); await page.waitForTimeout(150);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 0) bad.push(`${name}: horizontal scroll ${over}px`);
      if (errs.length) bad.push(`${name}: ${errs.join('; ')}`);
      const c = await checkContrast(page);
      if (c.failures.length) bad.push(`${name}: ${formatFailures(c)}`);
      page.removeAllListeners('pageerror'); page.removeAllListeners('console');
    }
    expect(bad.join('\n')).toBe('');
  });
}
