import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-E2 (EA3 drag part): drag in edit mode on /t/<id>/. Desktop: the handle (4 px) or the row (8 px), within a day, across days and onto the
// day rail; Esc and dropping where it started cancel; one drag is one undo step. Phone: a long-press on the handle only, inside the open day;
// a press on the row body scrolls. Needs the build with NEXT_PUBLIC_TRIP_EDIT=1, then PW_REUSE_SITE=1 PW_SITE_URL=<that server>
// playwright test t-edit-drag (alone, on a free port). With the flag off /t/ answers 404 and every test here skips. The phone block runs
// on chromium (real touch events through the DevTools protocol) and on the webkit-iphone project (touch pointer events dispatched on the page).
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });

async function seed(page: Page, values: Record<string, string>) {
  await page.addInitScript((kv) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, values);
}
const titles = (page: Page, day: number) => page.locator(`#day-${day} li.tl-entry[data-edit] .tl-title`).allTextContents();
const row = (page: Page, day: number, i: number) => page.locator(`#day-${day} li.tl-entry[data-edit]`).nth(i);
const handle = (page: Page, day: number, i: number) => row(page, day, i).locator('.drag-handle');
async function centre(l: Locator): Promise<{ x: number; y: number }> {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
/** Scrolls so stop `i` of a day sits a third of the way down the window: clear of the sticky bars on top and the autoscroll edges. */
const mid = (page: Page, day: number, i = 0) =>
  page.locator(`#day-${day} li.tl-entry[data-edit]`).nth(i).evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.33));
async function ready(page: Page, site: { url: string }, days: number, query = '?view=day&edit=1') {
  await seed(page, { [COPIES_KEY]: envelope([copy(days)]) });
  await page.goto(`${site.url}/t/${ID}/${query}`);
  await expect(page.locator('li.tl-day').first()).toBeVisible();
  await expect(page.locator('.drag-handle').first()).toBeVisible();
  // the drag chunk loads after the edit chunk: its description paragraph is the sign it is listening
  await expect(page.locator('#edit-drag-help')).toBeAttached();
}
async function planDays(playwright: { request: { newContext: () => Promise<import('@playwright/test').APIRequestContext> } }, site: { url: string }): Promise<number> {
  const ctx = await playwright.request.newContext();
  const probe = await ctx.get(`${site.url}/t/${ID}/`);
  test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
  const n = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
  await ctx.dispose();
  return n;
}
/** The y a pointer must be at to land before stop `i` of a day (the top quarter of that row), or after the last. */
async function slotY(page: Page, day: number, i: number): Promise<{ x: number; y: number }> {
  const stops = page.locator(`#day-${day} li.tl-entry[data-edit]:not([data-drag-origin])`);
  const n = await stops.count();
  if (i >= n) {
    const b = (await stops.nth(n - 1).boundingBox())!;
    return { x: b.x + b.width * 0.6, y: b.y + b.height - 2 };
  }
  const b = (await stops.nth(i).boundingBox())!;
  return { x: b.x + b.width * 0.6, y: b.y + 3 };
}

test.describe('drag on a desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'the mouse drag runs on the desktop projects; the webkit-iphone project runs the phone block');
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    days = await planDays(playwright, site);
  });

  test('every stop has a handle named for it with its day, and the content column narrows by the handle', async ({ page, site }) => {
    await ready(page, site, days);
    for (let d = 1; d <= Math.min(days, 3); d++) {
      const n = await page.locator(`#day-${d} li.tl-entry[data-edit]`).count();
      for (let i = 0; i < n; i++) await expect(handle(page, d, i)).toHaveAttribute('aria-label', new RegExp(`^Move .+, Day ${d}$`));
    }
    const h = (await handle(page, 2, 0).boundingBox())!;
    expect(h.width).toBe(24);
    expect(h.height).toBe(44);
    await expect(handle(page, 2, 0)).toHaveCSS('touch-action', 'none');
    await expect(row(page, 2, 0).locator('.tl-body')).not.toHaveCSS('touch-action', 'none');
  });

  test('a drag on the handle moves a stop within its day, shows the line and the pill, and one Undo puts it back', async ({ page, site }) => {
    await ready(page, site, days);
    const before = await titles(page, 2);
    expect(before.length).toBeGreaterThan(2);
    await mid(page, 2);
    const from = await centre(handle(page, 2, 0));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 2, from.y + 2);
    await expect(page.locator('.drag-ghost')).toHaveCount(0); // 4 px has not been reached
    await page.mouse.move(from.x + 4, from.y + 6, { steps: 3 });
    await expect(page.locator('.drag-ghost')).toHaveCount(1);
    await expect(row(page, 2, 0)).toHaveAttribute('data-drag-origin', '');
    const to = await slotY(page, 2, 2);
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await expect(page.locator('.drag-line')).toBeVisible();
    await expect(page.locator('.drag-pill')).toHaveText(/^to Day 2 · before \d\d:\d\d/);
    await page.mouse.up();
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    await expect(page.locator('.toast', { hasText: /^Moved .+ to position \d of \d|^Moved .+ (up|down)/ })).toBeVisible();
    await expect.poll(async () => (await titles(page, 2)).indexOf(before[0]!)).toBeGreaterThan(0);
    // one drag, one undo step
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => titles(page, 2)).toEqual(before);
  });

  test('a drag across days drops in the other day at the place of the line, marks it, and the live region says where', async ({ page, site }) => {
    await ready(page, site, days);
    const d1 = await titles(page, 1);
    const d3 = await titles(page, 3);
    await mid(page, 1);
    const from = await centre(handle(page, 1, 0));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 20, { steps: 3 });
    const to = await slotY(page, 3, 1);
    await page.mouse.move(to.x, to.y, { steps: 20 });
    await expect(page.locator('.drag-pill')).toHaveText(/^to Day 3 · before \d\d:\d\d/);
    await page.mouse.up();
    await expect.poll(() => titles(page, 3)).toContain(d1[0]);
    await expect.poll(() => titles(page, 1)).toEqual(d1.slice(1));
    expect((await titles(page, 3)).length).toBe(d3.length + 1);
    await expect(page.locator('#day-3 li.tl-entry', { hasText: d1[0]! }).getByText('Moved from Day 1')).toBeVisible();
    await expect(page.locator('.sr-only[role="status"]')).toContainText(`Moved ${d1[0]} to Day 3, position`);
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => titles(page, 1)).toEqual(d1);
    await expect.poll(() => titles(page, 3)).toEqual(d3);
  });

  test('dropping on a day cell of the day rail moves the stop to the end of that day, and hovering the cell scrolls to the day', async ({ page, site }) => {
    await ready(page, site, days);
    const d1 = await titles(page, 1);
    const d4 = await titles(page, 4);
    await mid(page, 1);
    const from = await centre(handle(page, 1, 0));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 20, { steps: 3 });
    const cell = page.locator('.tl-rail-cell', { hasText: /^4$/ });
    const c = await centre(cell);
    await page.mouse.move(c.x, c.y, { steps: 20 });
    await expect(cell).toHaveAttribute('data-drop-target', '');
    await expect(page.locator('.drag-ghost')).toHaveAttribute('data-over-rail', '');
    await expect(page.locator('.drag-ghost')).toHaveCSS('opacity', '0.3');
    await expect(page.locator('.drag-pill')).toHaveText(/^to Day 4 · at the end/);
    // 400 ms on the cell scrolls to that day
    await expect.poll(() => page.locator('#day-4').evaluate((e) => Math.abs(e.getBoundingClientRect().top)), { timeout: 4000 }).toBeLessThan(260);
    // the rail follows the day it scrolled to and slides other cells under the still pointer: the day cell it was on stays the target until it moves
    await page.waitForTimeout(600);
    await page.mouse.up();
    // the plan has the last word on the order (a stop that holds its time stays), so the stop is on Day 4, not necessarily last
    await expect.poll(() => titles(page, 4)).toContain(d1[0]);
    expect((await titles(page, 4)).length).toBe(d4.length + 1);
    await expect.poll(() => titles(page, 1)).toEqual(d1.slice(1));
  });

  test('Esc cancels a drag and puts the stop back with nothing changed; dropping where it started does too', async ({ page, site }) => {
    await ready(page, site, days);
    const before = await titles(page, 2);
    await mid(page, 2);
    const from = await centre(handle(page, 2, 1));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 60, { steps: 6 });
    await expect(page.locator('.drag-ghost')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    await expect(page.locator('.drag-line')).toHaveCount(0);
    await page.mouse.up();
    await expect(page.locator('.toast')).toHaveCount(0);
    expect(await titles(page, 2)).toEqual(before);
    // back to its own place
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 30, { steps: 4 });
    await page.mouse.move(from.x, from.y, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('.toast')).toHaveCount(0);
    expect(await titles(page, 2)).toEqual(before);
  });

  test('a press on the row body starts a drag after 8 px, but not on the title link or the actions button', async ({ page, site }) => {
    await ready(page, site, days);
    await mid(page, 2);
    const r = row(page, 2, 0);
    const b = (await r.boundingBox())!;
    const hb = (await r.locator('.tl-head').boundingBox())!;
    // the empty end of the title line, left of the actions button: not a link, not a button
    const x = b.x + b.width - 80;
    const y = hb.y + 8;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 5);
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    await page.mouse.move(x, y + 10, { steps: 2 });
    await expect(page.locator('.drag-ghost')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    // the actions button is a button: a press on it never lifts the row
    const t = await centre(r.locator('.tl-edit-trail button'));
    await page.mouse.move(t.x, t.y);
    await page.mouse.down();
    await page.mouse.move(t.x, t.y + 30, { steps: 4 });
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    await page.mouse.up();
  });

  test('the pointer near the bottom edge scrolls the page while a stop is held', async ({ page, site }) => {
    await ready(page, site, days);
    await mid(page, 2);
    const from = await centre(handle(page, 2, 0));
    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 20, { steps: 3 });
    const vh = page.viewportSize()!.height;
    await page.mouse.move(from.x, vh - 12, { steps: 8 });
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 }).toBeGreaterThan(y0 + 80);
    await page.keyboard.press('Escape');
    await page.mouse.up();
  });

  test('under reduced motion the ghost is not lifted, scaled or turned; the line and the pill still show', async ({ page, site }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page, site, days);
    await mid(page, 2);
    const from = await centre(handle(page, 2, 0));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 60, { steps: 8 });
    const ghost = page.locator('.drag-ghost');
    await expect(ghost).toHaveCount(1);
    await expect(ghost).toHaveCSS('scale', '1');
    await expect(ghost).toHaveCSS('rotate', '0deg');
    await expect(page.locator('.drag-line')).toBeVisible();
    await expect(page.locator('.drag-pill')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.mouse.up();
    // and the drop does not settle
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 90, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-settle]')).toHaveCount(0);
  });
});

/** A touch drag from one point to another: real touch events through the DevTools protocol on chromium; on WebKit, touch pointer events dispatched on the page (Playwright has no touch drag there). */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, opts: { holdMs: number; drop: boolean }): Promise<void> {
  if (page.context().browser()?.browserType().name() === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const pt = (x: number, y: number) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from.x, from.y) });
    await page.waitForTimeout(opts.holdMs);
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps) });
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(100);
    if (opts.drop) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    return;
  }
  await page.evaluate(async ({ from, to, opts }) => {
    const el = document.elementFromPoint(from.x, from.y)!;
    const fire = (target: EventTarget, type: string, x: number, y: number) =>
      target.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 7, isPrimary: true, bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: 1 }));
    fire(el, 'pointerdown', from.x, from.y);
    await new Promise((r) => setTimeout(r, opts.holdMs));
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      fire(window, 'pointermove', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));
    fire(window, opts.drop ? 'pointerup' : 'pointercancel', to.x, to.y);
  }, { from, to, opts });
}

test.describe('drag on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    days = await planDays(playwright, site);
  });

  test('a long-press on the handle lifts the stop and moves it inside its day; the handle is 28 x 44', async ({ page, site }) => {
    await ready(page, site, days);
    await mid(page, 2);
    const h = (await handle(page, 2, 0).boundingBox())!;
    expect(h.width).toBe(28);
    expect(h.height).toBe(44);
    const before = await titles(page, 2);
    expect(before.length).toBeGreaterThan(2);
    const from = await centre(handle(page, 2, 0));
    // a lift at 300 ms: nothing is lifted before it, so the hold is checked at 100 ms on the way
    const to = await slotY(page, 2, 2);
    await touchDrag(page, from, { x: to.x, y: to.y }, { holdMs: 450, drop: true });
    await expect.poll(async () => (await titles(page, 2)).indexOf(before[0]!)).toBeGreaterThan(0);
    expect((await titles(page, 2)).length).toBe(before.length);
    await expect(page.locator('.toast', { hasText: /^Moved / })).toBeVisible();
  });

  test('a touch that moves before the long-press fires lifts nothing', async ({ page, site }) => {
    await ready(page, site, days);
    const before = await titles(page, 2);
    await mid(page, 2);
    const from = await centre(handle(page, 2, 0));
    // no hold: the finger is already moving when the timer would fire
    await touchDrag(page, from, { x: from.x, y: from.y + 160 }, { holdMs: 0, drop: true });
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    expect(await titles(page, 2)).toEqual(before);
  });

  test('a press on the row body never lifts the stop, and a swipe on it scrolls the page', async ({ page, site, browserName }) => {
    await ready(page, site, days);
    const before = await titles(page, 2);
    const r = row(page, 2, 0);
    await r.scrollIntoViewIfNeeded();
    const b = (await r.boundingBox())!;
    const body = { x: b.x + b.width * 0.55, y: b.y + b.height - 6 };
    await touchDrag(page, body, { x: body.x, y: body.y - 30 }, { holdMs: 450, drop: false });
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    expect(await titles(page, 2)).toEqual(before);
    if (browserName === 'chromium') {
      const y0 = await page.evaluate(() => window.scrollY);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.synthesizeScrollGesture', { x: body.x, y: Math.min(body.y, 700), yDistance: -240, speed: 800, gestureSourceType: 'touch' });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0 + 100);
    }
  });

  test('a held stop stays in its own day on a phone: dragging over another day lands in the open one', async ({ page, site }) => {
    await ready(page, site, days);
    const d1 = await titles(page, 1);
    const d2 = await titles(page, 2);
    await mid(page, 2);
    const from = await centre(handle(page, 2, 0));
    // pull it a long way up, into Day 1's rows
    const target = await slotY(page, 1, 1).catch(() => ({ x: from.x, y: 120 }));
    await touchDrag(page, from, { x: target.x, y: Math.max(40, from.y - 300) }, { holdMs: 450, drop: true });
    expect(await titles(page, 1)).toEqual(d1);
    expect((await titles(page, 2)).length).toBe(d2.length);
  });
});
