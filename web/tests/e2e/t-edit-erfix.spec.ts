import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-ERFIX: the rows of the independent design review (docs/v2/design/step2/review-STEP2-ERV-2026-10-28.md) that need a browser.
// Needs the build with NEXT_PUBLIC_TRIP_EDIT=1, then PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-edit-erfix (alone, on a
// free port). With the flag off /t/ answers 404 and every test here skips.
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });
const GONDOLA = 'Lake Louise Gondola';

test.describe('edit mode: the design review rows', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  async function open(page: Page, site: { url: string }, query = '?view=day&edit=1') {
    await page.addInitScript(
      (kv) => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(kv.k, kv.v);
      },
      { k: COPIES_KEY, v: envelope([copy(days)]) },
    );
    await page.goto(`${site.url}/t/${ID}/${query}`);
    await expect(page.locator('li.tl-day').first()).toBeVisible();
  }
  const row = (page: Page, day: number, title: string) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"]`, { has: page.locator('.tl-title', { hasText: title }) }).first();

  test('ER-001: a day far from the stop says how far, is never "Fits", and the one fix does not send it there', async ({ page, site }) => {
    await open(page, site);
    await row(page, 10, GONDOLA).locator('.tl-edit-trail button').click();
    await page.getByRole('menuitem', { name: 'Move to day' }).click();
    const jasper = page.locator('.edit-day', { hasText: 'Jasper' }).first();
    await expect(jasper).toContainText(/\d+ km from Jasper/);
    await expect(jasper.locator('.edit-fit')).not.toHaveText('Fits');
    await page.locator('.edit-day', { hasText: 'Day 9' }).click();
    const fix = page.locator('#day-9 .wn[data-level="fix"] .wn-fix');
    await expect(fix).toBeVisible();
    // the fix is the stop's own day or a day near it, never a Jasper day
    await expect(fix).toHaveText(/Move .+ to Day (10|11|12)$|^Remove /);
  });

  test('ER-002 and ER-003: a warning shows once, in one style, and says how long the day is', async ({ page, site }) => {
    await open(page, site);
    await row(page, 10, GONDOLA).locator('.tl-edit-trail button').click();
    await page.getByRole('menuitem', { name: 'Move to day' }).click();
    await page.locator('.edit-day', { hasText: 'Day 9' }).click();
    await expect(page.locator('#day-9 .wn[data-level="fix"]')).toBeVisible();
    // the older triangle lines and the count in the totals row are gone for what the status block shows
    await expect(page.locator('#day-9 .tl-warn')).toHaveCount(0);
    await expect(page.locator('#day-9 .tl-warn-count')).toHaveCount(0);
    const text = (await page.locator('#day-9 .wns').innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/away from base/);
    // every warning sentence on the page is said once per day
    for (let d = 1; d <= days; d++) {
      const lines = await page.locator(`#day-${d} .wn-text, #day-${d} .wn-list li, #day-${d} .tl-warn`).allInnerTexts();
      const clean = lines.map((l) => l.replace(/^(To fix|To check):\s*/, '').replace(/\s+/g, ' ').trim());
      expect(new Set(clean).size, `Day ${d} repeats a warning: ${clean.join(' | ')}`).toBe(clean.length);
    }
  });

  test('ER-004: "Day full" in the picker is advice, not the Fix red', async ({ page, site }) => {
    await open(page, site);
    await page.locator('#day-5 .tl-add-open').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.add-row').first()).toBeVisible();
    const fulls = dialog.locator('.add-fit[data-fit="full"]');
    if ((await fulls.count()) === 0) test.skip(true, 'no row reads Day full on this day');
    const [c, warn, crit] = await fulls.first().evaluate((el) => {
      const probe = (v: string) => { const s = document.createElement('i'); s.style.color = `var(${v})`; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; };
      return [getComputedStyle(el).color, probe('--warn'), probe('--crit')];
    });
    expect(c).toBe(warn);
    expect(c).not.toBe(crit);
  });

  test('ER-005: the picker offers the other versions of a day, and the trip\'s other days at the base', async ({ page, site }) => {
    await open(page, site);
    await page.locator('#day-2 .tl-add-open').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'From the other versions of this day' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Elsewhere on this trip, near here' })).toBeVisible();
    // a town is not offered as a place to go on a day based in it
    await expect(dialog.locator('.add-group', { hasText: /^Within/ }).locator('.add-row', { hasText: /^Banff\s*Town/ })).toHaveCount(0);
  });

  test('ER-009: while editing, the plan bar has no Edit link; in read mode it is there', async ({ page, site }) => {
    await open(page, site);
    await expect(page.locator('.tl-planbar .tl-railedit')).toHaveCount(0);
    await page.locator('.edit-tools').getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.tl-planbar .tl-railedit')).toBeVisible();
  });

  test('ER-010: at tablet width the day rail shows the active day', async ({ page, site }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page, site, '?view=day&edit=1#day-9');
    await page.waitForTimeout(900);
    const box = page.locator('.tl-rail-days');
    const cell = page.locator('.tl-rail-days [data-active]');
    await expect(cell).toBeVisible();
    const [b, c] = await Promise.all([box.boundingBox(), cell.boundingBox()]);
    expect(c!.x).toBeGreaterThanOrEqual(b!.x - 1);
    expect(c!.x + c!.width).toBeLessThanOrEqual(b!.x + b!.width + 1);
  });

  test('ER-011: Tab reaches a row\'s handle before its title and its menu', async ({ page, site }) => {
    await open(page, site);
    const li = page.locator('#day-2 li.tl-entry[data-edit="stop"]').first();
    await li.locator('.drag-handle').focus();
    const order = await li.evaluate((el) => {
      const els = [...el.querySelectorAll<HTMLElement>('button, a[href]')];
      return els.map((e) => (e.classList.contains('drag-handle') ? 'handle' : e.closest('.tl-edit-trail') ? 'menu' : 'content'));
    });
    expect(order[0]).toBe('handle');
    expect(order[order.length - 1]).toBe('menu');
  });

  test('ER-014: the Settings sheet closes with Close, and Done stays the page\'s', async ({ page, site }) => {
    await open(page, site);
    await page.locator('.edit-tools').getByRole('button', { name: 'Settings' }).click();
    const sheet = page.getByRole('dialog', { name: 'Settings' });
    await expect(sheet.locator('.sheet-foot').getByRole('button', { name: 'Done' })).toHaveCount(0);
    const close = sheet.locator('.sheet-foot').getByRole('button', { name: 'Close' });
    await expect(close).not.toHaveClass(/btn-primary/);
    await close.click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/edit=1/);
  });

  test('ER-015: a day with its stops removed says so, offers Drop Day n, and drops at once', async ({ page, site }) => {
    await open(page, site);
    const n = await page.locator('#day-15 li.tl-entry[data-edit="stop"]').count();
    for (let i = 0; i < n; i++) {
      await page.locator('#day-15 li.tl-entry[data-edit="stop"] .tl-edit-trail button').first().click();
      await page.getByRole('menuitem', { name: /Remove from Day 15/ }).click();
    }
    const empty = page.getByTestId('day-empty-15');
    await expect(empty).toContainText('No stops on Day 15');
    // the headline is ours, muted, and the totals are not the removed plan's
    await expect(page.locator('#day-15 .tl-day-title .tl-day-ours')).toHaveText(/Our plan/);
    await expect(page.locator('#day-15 .tl-day-totals')).toHaveCount(0);
    await empty.getByRole('button', { name: 'Drop Day 15' }).click();
    await expect(page.locator('.toast', { hasText: /Dropped Day 15/ })).toBeVisible();
    await expect(page.locator('#day-15')).toHaveCount(0);
  });

  test('ER-016: a version line that is advice reads in the Check colour', async ({ page, site }) => {
    await open(page, site, '?view=day&edit=1');
    await page.locator('#day-4 .day-more').click();
    await page.getByRole('menuitem', { name: /Version of Day 4/ }).click();
    const reasons = page.locator('.edit-day-reason');
    await expect(page.locator('.edit-day').first()).toBeVisible();
    const colours = await reasons.evaluateAll((els) => els.map((e) => [e.getAttribute('data-level'), getComputedStyle(e).color]));
    const probe = await page.evaluate(() => ['--warn', '--crit'].map((v) => { const s = document.createElement('i'); s.style.color = `var(${v})`; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; }));
    for (const [level, colour] of colours) expect(colour).toBe(level === 'check' ? probe[0] : probe[1]);
  });

  test('ER-017 and ER-020: the Stops tab says what it counts; the changes line is on Days only', async ({ page, site }) => {
    await open(page, site, '?view=day&edit=1');
    await expect(page.getByRole('tab', { name: /^Stops, \d+ places in this trip/ })).toBeVisible();
    // one change, so there is a "changes from our plan" line: Days shows it, the Summary does not repeat it above the tabs
    await page.locator('#day-1 li.tl-entry[data-edit="stop"] .tl-edit-trail button').first().click();
    await page.getByRole('menuitem', { name: /Remove from Day 1/ }).click();
    await expect(page.locator('.own-changes-line')).toBeVisible();
    await page.getByRole('tab', { name: /^Summary/ }).click();
    await expect(page.locator('.own-changes-line')).toBeHidden();
  });

  test('ER-019: the Settings labels share one style', async ({ page, site }) => {
    await open(page, site);
    await page.locator('.edit-tools').getByRole('button', { name: 'Settings' }).click();
    const sheet = page.getByRole('dialog', { name: 'Settings' });
    await expect(sheet.locator('.stepper-label').first()).toBeVisible();
    const caps = await sheet.locator('.stepper-label').evaluateAll((els) => els.map((e) => getComputedStyle(e).textTransform));
    expect(caps.length).toBeGreaterThan(0);
    for (const c of caps) expect(c).toBe('none');
  });

  test('ER-023: entering or leaving edit mode moves nothing on the time rail', async ({ page, site }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, site, '?view=day');
    const x = () => page.locator('#day-1 li.tl-entry .tl-time').first().evaluate((e) => Math.round(e.getBoundingClientRect().left));
    const before = await x();
    await page.getByRole('button', { name: 'Edit trip' }).click();
    await expect(page.locator('.tl-edit-trail').first()).toBeVisible();
    expect(Math.abs((await x()) - before)).toBeLessThanOrEqual(1);
  });
});
