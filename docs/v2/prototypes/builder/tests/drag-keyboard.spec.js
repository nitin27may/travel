/* Plan 1B: keyboard model (arrows move focus, Space lifts, arrows move, Enter drops, Escape cancels; single-letter keys only on a
   focused plan row, off by a switch) and phone drag (long-press 300 ms, drop targets per day, edge auto-scroll). */
const { test, expect } = require('../../shared/tests/fixtures.js');
test.use({ viewport: { width: 390, height: 844 } }); // PHONE-DEFAULT: these specs drive the phone layout (below 1024); desktop.spec.js covers 1024 and up
const { dolomitesPlan, dayWith, names } = require('./helpers.js');
const BUSY = ['ortisei', 'seceda', 'siusi', 'funes', 'braies', 'carezza', 'gherdeina', 'dobbiaco', 'otzi', 'renon'];

async function twoStopDay(page, base) {
  await dolomitesPlan(page, base, { nights: 3, picks: BUSY, when: { type: 'month', month: 7 } }); // days 2 and 3 have three stops
  const d = await dayWith(page, 3);
  expect(d).toBeGreaterThanOrEqual(0);
  await page.locator('.dc', { hasText: new RegExp('^' + (d + 1)) }).first().click();
  return d;
}
const rows = (page) => page.locator('.it button[data-row]');

test('keyboard: Up and Down move focus between stops', async ({ page, base }) => {
  await twoStopDay(page, base);
  await rows(page).first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(rows(page).nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(rows(page).first()).toBeFocused();
  await page.keyboard.press('ArrowUp'); // first stop: stays
  await expect(rows(page).first()).toBeFocused();
});

test('keyboard: Space lifts, arrows move, Enter drops, the stop is Placed by you and one Undo puts it back', async ({ page, base }) => {
  const d = await twoStopDay(page, base);
  const before = await names(page, d);
  await rows(page).first().focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.it.lifted')).toHaveCount(1);
  await expect(rows(page).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#live')).toContainText('Lifted ' + before[0]);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#live')).toContainText(before[0] + ' now position 2');
  await expect(page.locator('.it.lifted button[data-row]')).toBeFocused(); // focus follows the lifted stop
  await page.keyboard.press('Enter');
  await expect(page.locator('.it.lifted')).toHaveCount(0);
  const after = await names(page, d);
  expect(after[1]).toBe(before[0]);
  expect(after[0]).toBe(before[1]);
  await expect(page.locator('.it', { hasText: before[0] }).locator('.chip', { hasText: 'Placed by you' })).toBeVisible();
  await expect(page.locator('#toast')).toContainText('kept there');
  await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
  expect(await names(page, d)).toEqual(before);
});

test('keyboard: Escape cancels a lift and puts the stop back, nothing is saved as a step', async ({ page, base }) => {
  const d = await twoStopDay(page, base);
  const before = await names(page, d);
  const steps = await page.evaluate(() => HIST.length);
  await rows(page).first().focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect(await names(page, d)).not.toEqual(before);
  await page.keyboard.press('Escape');
  expect(await names(page, d)).toEqual(before);
  expect(await page.evaluate(() => HIST.length)).toBe(steps);
  await expect(page.locator('#live')).toContainText('Cancelled');
  await expect(rows(page).first()).toBeFocused();
});

test('keyboard: Left and Right (or PageUp and PageDown) move a lifted stop to the previous or next day', async ({ page, base }) => {
  const d = await twoStopDay(page, base);
  const pid = await page.evaluate((i) => S.plan.days[i].items[0].pid, d);
  await rows(page).first().focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('PageDown');
  expect(await page.evaluate((p) => find(p).d.n, pid)).toBe(d + 1);
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate((p) => find(p).d.n, pid)).toBe(d);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect(await page.evaluate((p) => find(p).d.n, pid)).toBe(d + 1);
  await expect(page.locator('#toast')).toContainText('Day ' + (d + 2));
});

test('keyboard: Delete removes the focused stop and focus moves to the next stop', async ({ page, base }) => {
  const d = await twoStopDay(page, base);
  const before = await names(page, d);
  await rows(page).first().focus();
  await page.keyboard.press('Delete');
  expect((await names(page, d)).length).toBe(before.length - 1);
  await expect(rows(page).first()).toBeFocused();
  await expect(page.locator('#toast')).toContainText('Removed');
});

test('keyboard: single-letter keys act only on a focused stop; M then a day number moves it; the switch turns them off', async ({ page, base }) => {
  const d = await twoStopDay(page, base);
  const pid = await page.evaluate((i) => S.plan.days[i].items[0].pid, d);
  await rows(page).first().focus();
  await page.keyboard.press('a');
  await expect(page.getByRole('dialog').getByRole('heading', { name: /^Add to Day/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await rows(page).first().focus();
  await page.keyboard.press('m');
  await page.keyboard.press(String(d === 0 ? 2 : 1));
  expect(await page.evaluate((p) => find(p).d.n, pid)).toBe(d === 0 ? 1 : 0);
  // not in a field: typing in the day note does nothing
  await page.locator('textarea.nt').first().focus();
  await page.keyboard.type('asm?');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('textarea.nt').first().blur();
  // the list and the switch
  await rows(page).first().focus();
  await page.keyboard.press('Shift+?');
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('heading', { name: 'Keyboard' })).toBeVisible();
  await dlg.getByRole('switch', { name: /Single-letter keys/ }).click();
  await dlg.getByRole('button', { name: 'Done' }).click();
  expect(await page.evaluate(() => localStorage.getItem('proto.builder.keys'))).toBe('0');
  await rows(page).first().focus();
  await page.keyboard.press('a');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Space'); // Space and arrows still work: they are not single-letter shortcuts
  await expect(page.locator('.it.lifted')).toHaveCount(1);
  await page.keyboard.press('Escape');
});

test('keyboard: each stop names its keys for a screen reader', async ({ page, base }) => {
  await twoStopDay(page, base);
  const b = rows(page).first();
  await expect(b).toHaveAttribute('aria-describedby', 'kbhint');
  await expect(page.locator('#kbhint')).toContainText('Space lifts this stop');
});

/* ---- phone: long-press drag with real touch events (CDP) ---- */
test.describe('phone drag', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  async function touch(page) {
    const cdp = await page.context().newCDPSession(page);
    return {
      start: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }),
      move: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }),
      end: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    };
  }
  const centre = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

  test('long-press 300 ms lifts a stop; dropping on another day chip moves it there and keeps it placed', async ({ page, base }) => {
    const d = await twoStopDay(page, base);
    const first = page.locator('.it').first();
    const pid = await first.getAttribute('data-pid');
    const t = await touch(page);
    const p = await centre(first.locator('.tm'));
    await t.start(p.x, p.y);
    await page.waitForTimeout(150);
    await expect(page.locator('.it.ghost')).toHaveCount(0); // not yet: 300 ms
    await page.waitForTimeout(250);
    await expect(page.locator('.it.ghost')).toHaveCount(1);
    await expect(page.locator('.it.dragging')).toHaveCount(1);
    await expect(page.locator('body')).toHaveClass(/lifting/);
    const target = page.locator('.dc').nth(d === 0 ? 1 : 0);
    const c = await centre(target);
    await t.move(c.x, c.y - 2);
    await expect(target).toHaveClass(/drop/);
    await t.end();
    await expect(page.locator('.it.ghost')).toHaveCount(0);
    expect(await page.evaluate((x) => find(x).d.n, pid)).toBe(d === 0 ? 1 : 0);
    expect(await page.evaluate((x) => !!find(x).it.placed, pid)).toBe(true);
    await expect(page.locator('#toast')).toContainText('kept there');
  });

  test('long-press then drop on another stop reorders inside the day', async ({ page, base }) => {
    const d = await twoStopDay(page, base);
    const before = await names(page, d);
    const t = await touch(page);
    const a = await centre(page.locator('.it').nth(0).locator('.tm'));
    await t.start(a.x, a.y);
    await page.waitForTimeout(400);
    const b = await centre(page.locator('.it').nth(1).locator('.tm'));
    await t.move(b.x, b.y);
    await expect(page.locator('.it').nth(1)).toHaveClass(/over/);
    await t.end();
    const after = await names(page, d);
    expect(after).not.toEqual(before);
    expect(after).toContain(before[0]);
  });

  test('moving more than 10 px before 300 ms is a scroll, not a lift', async ({ page, base }) => {
    await twoStopDay(page, base);
    const t = await touch(page);
    const a = await centre(page.locator('.it').first().locator('.tm'));
    await t.start(a.x, a.y);
    await t.move(a.x, a.y - 30);
    await page.waitForTimeout(450);
    await expect(page.locator('.it.ghost')).toHaveCount(0);
    await t.end();
    await expect(page.locator('.it.dragging')).toHaveCount(0);
  });

  test('holding a lifted stop near the bottom edge auto-scrolls the day', async ({ page, base }) => {
    await page.setViewportSize({ width: 390, height: 520 });
    await twoStopDay(page, base);
    const body = page.locator('#body');
    const overflow = await body.evaluate((e) => e.scrollHeight - e.clientHeight);
    expect(overflow).toBeGreaterThan(100);
    await page.locator('.it').first().scrollIntoViewIfNeeded();
    await body.evaluate((e) => { e.scrollTop = 0; e.scrollBy(0, 120); });
    const t = await touch(page);
    const a = await centre(page.locator('.it').first().locator('.tm'));
    await t.start(a.x, a.y);
    await page.waitForTimeout(400);
    await expect(page.locator('.it.ghost')).toHaveCount(1);
    const box = await body.boundingBox();
    await t.move(a.x, box.y + box.height - 20);
    const s0 = await body.evaluate((e) => e.scrollTop);
    await page.waitForTimeout(500);
    const s1 = await body.evaluate((e) => e.scrollTop);
    expect(s1).toBeGreaterThan(s0);
    await t.end();
  });
});
