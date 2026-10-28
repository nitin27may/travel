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
      await menu(page, name.slice(0, 12)); await page.getByRole('button', { name: /^Remove from Day/ }).click();
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
    await menu(page, 'Lago di Braies'); await page.getByRole('button', { name: /^Remove from Day 6/ }).click();
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

  test('EA6: the changes sheet lists every entry with Restore; Reset Day and Reset to our plan undo; reset confirms over 3 changes', async ({ page, base }) => {
    await page.goto(base + COPY);
    await expect(page.getByText('5 changes from our plan')).toBeVisible();
    await page.getByRole('button', { name: '5 changes', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Changes from our plan' });
    await expect(dlg.getByRole('button', { name: /^Restore/ })).toHaveCount(5);
    await expect(dlg).toContainText('Removed Lago di Sorapis from Day 9');
    await dlg.getByRole('button', { name: /^Restore: Removed Lago di Sorapis/ }).click();
    await expect(page.locator('#e-sorapis')).toBeVisible();
    await expect(dlg.getByRole('button', { name: /^Restore/ })).toHaveCount(4);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+z');
    await expect(page.locator('#e-sorapis')).toHaveCount(0);
    // Reset Day 7: its added museum goes
    await page.getByRole('button', { name: 'Actions for Day 7' }).click(); await page.getByRole('button', { name: 'Reset Day 7' }).click();
    await expect(page.locator('#e-gherdeina')).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('Day 7 is back to our plan');
    // Reset to our plan: 4 changes left, so it confirms
    await page.getByRole('button', { name: 'Trip actions' }).click(); await page.getByRole('button', { name: 'Reset to our plan' }).click();
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
    const d = page.getByRole('dialog');
    await expect(d.getByRole('switch', { name: /Keep on Day 3/ })).toHaveAttribute('aria-checked', 'true');
    await expect(d.getByRole('switch', { name: /Must see/ })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Add to Maybe' })).toHaveCount(0);
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
    await expect(page).toHaveURL(/\/trip\/(index\.html)?\?id=demo-built&edit=1&add=banff-national-park/);
    const pick = page.getByRole('dialog', { name: 'sh-t' }).or(page.getByRole('dialog'));
    await expect(pick.getByText('In Banff National Park')).toBeVisible();
    await pick.getByRole('button', { name: /^Add Bow Falls|Move here/ }).first().waitFor();
    await pick.getByRole('button', { name: /^Add Lake Louise|^Move here/ }).first().click().catch(() => {});
    await page.keyboard.press('Escape');
    // remove
    await menu(page, 'Johnston'); await page.getByRole('button', { name: /^Remove from Day 2/ }).click();
    await expect(page.locator('#e-johnston-canyon')).toHaveCount(0);
    // move
    await menu(page, 'Bow Falls'); await page.getByRole('button', { name: 'Move to day…' }).click();
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
    await page.locator('.hdr nav').getByRole('link', { name: 'Mine' }).click();
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
    await expect(page.locator('#builtline')).toContainText(/^Built \d+ days · \d+ did not fit · \d+ warnings?/);
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
    await expect(page.getByRole('link', { name: 'Open Mine' })).toBeVisible();
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

/* every frame of spec 17 */
const FRAMES = {
  'read-copy': '/trip/?id=demo-copy&view=day', 'read-copy-summary': '/trip/?id=demo-copy', 'read-built': '/trip/?id=demo-built&view=day',
  'edit-rest': COPY, 'edit-built': BUILT, 'item-sheet': COPY + '&sheet=item:seceda', 'move-to-day': COPY + '&sheet=move:seceda',
  'add-picker': COPY + '&sheet=add:7', 'add-with-place': COPY + '&add=moraine-lake', 'add-with-park': BUILT + '&add=banff-national-park', settings: COPY + '&sheet=settings',
  changes: COPY + '&sheet=changes', convert: COPY + '&sheet=convert', 'just-built': BUILT + '&built=1', 'make-it-yours': COPY + '&makeit=1',
  'sync-device': COPY + '&sync=device', 'sync-account': COPY + '&sync=account', 'sync-syncing': COPY + '&sync=syncing', 'sync-pending': COPY + '&sync=pending',
  'sync-failed': COPY + '&sync=failed', 'not-found': '/trip/?id=nope&edit=1', offline: COPY + '&offline=1', 'day-menu': COPY + '&sheet=day:3', 'drop-day': COPY + '&sheet=drop:8',
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
