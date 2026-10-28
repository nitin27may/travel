import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// STEP2-E6 (EA9 print and export, H9 Stops tab): the person's own trip at /t/<id>/. The Stops tab has the row actions in edit mode and follows the
// days; the print and the calendar are made from the edited timelines (the removed stop absent, the added place and the notes present) and
// carry nothing beyond the person's own. Needs the build with NEXT_PUBLIC_TRIP_EDIT=1, then PW_REUSE_SITE=1 PW_SITE_URL=<that server>
// playwright test t-edit-export (alone, on a free port). With the flag off /t/ answers 404 and every test skips.
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });
const PRIVATE = /height_cm|weight_kg|age_years|citizenship|confirmation|contact|price_paid|insurer|passport|household|HOME_POINT/i;
const NOTE = 'Ask about the parking pass';

test.describe('edit mode: the Stops tab, print and export', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  async function open(page: Page, site: { url: string }, query = '?view=day&edit=1') {
    await page.addInitScript(([k, v]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k!, v!);
    }, [COPIES_KEY, envelope([copy(days)])]);
    await page.goto(`${site.url}/t/${ID}/${query}`);
    await expect(page.locator(query.includes('view=all') ? '.cat-row' : 'li.tl-day').first()).toBeVisible();
  }
  const stopTitles = (page: Page, day: number) => page.locator(`#day-${day} li.tl-entry[data-edit="stop"] .tl-title`).allTextContents();
  /** Print is replaced by a recorder: the view that would go to paper is read as text, in document order. */
  const recordPrint = (page: Page) =>
    page.evaluate(() => {
      (window as unknown as { __printed: string[] }).__printed = [];
      window.print = () => (window as unknown as { __printed: string[] }).__printed.push(document.querySelector<HTMLElement>('[data-testid="trip-print-view"]')?.innerText ?? '');
    });
  const printed = (page: Page) => page.evaluate(() => (window as unknown as { __printed: string[] }).__printed ?? []);

  test('Stops tab: each stop row has the same ⋯ sheet in edit mode, none in read mode; Remove takes the row off with an Undo that puts it back', async ({ page, site }) => {
    await open(page, site, '?view=all&edit=1');
    const rows = page.locator('.cat-row[data-edit]');
    expect(await rows.count()).toBeGreaterThan(10);
    const row = page.locator('.cat-row[data-edit]').filter({ has: page.locator('.cat-name a') }).first();
    const name = (await row.locator('.cat-name').textContent())!.trim();
    const total = await page.locator('.cat-row').count();
    await row.getByRole('button', { name: /^Actions for / }).click();
    for (const item of [/^Move to day/, /^Add a note$/, /^Remove from Day/]) await expect(page.getByRole('menuitem', { name: item }).first()).toBeVisible();
    await page.getByRole('menuitem', { name: /^Remove from Day/ }).click();
    await expect(page.locator('.toast', { hasText: /^Removed / })).toBeVisible();
    await expect(page.locator('.cat-row')).toHaveCount(total - 1);
    await expect(page.locator('.cat-name', { hasText: name })).toHaveCount(0);
    await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.cat-row')).toHaveCount(total);
    await expect(page.locator('.cat-name', { hasText: name }).first()).toBeVisible();
    // Done: the actions leave, the rows stay
    await page.locator('.trip-actions').getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.cat-row[data-edit]')).toHaveCount(0);
    await expect(page.locator('.cat-row')).toHaveCount(total);
  });

  test('a removal in Days shows in Stops, and a place added to a day appears in its category', async ({ page, site }) => {
    await open(page, site);
    const before = await stopTitles(page, 5);
    // remove the first place on Day 3 from the Days tab
    const day3 = await stopTitles(page, 3);
    const li = page.locator('#day-3 li.tl-entry[data-edit="stop"]').filter({ has: page.locator('.tl-title a') }).first();
    const gone = (await li.locator('.tl-title').textContent())!.trim();
    expect(day3).toContain(gone);
    await li.locator('.tl-edit-trail button').click();
    await page.getByRole('menuitem', { name: /^Remove from Day 3/ }).click();
    await page.locator('#day-5 .tl-add-open').click();
    const dlg = page.getByRole('dialog', { name: /Add a place|Add /i });
    const row = dlg.locator('.add-row').filter({ has: page.getByRole('button', { name: /^Add .* to Day 5$/ }) }).filter({ hasNotText: 'Day full' }).first();
    const added = (await row.locator('.add-title').textContent())!.trim();
    await row.getByRole('button', { name: /^Add / }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => stopTitles(page, 5)).toContain(added);
    expect((await stopTitles(page, 5)).length).toBe(before.length + 1);
    await page.getByRole('tab', { name: /^Stops/ }).click();
    await expect(page.locator('.cat-name', { hasText: added }).first()).toBeVisible();
    await expect(page.locator('.cat-name').filter({ hasText: new RegExp(`^${gone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) })).toHaveCount(0);
  });

  test('Print and Calendar of the edited copy: the removed stop is absent, the added place and the note are present, nothing else of the household', async ({ page, site }) => {
    await open(page, site);
    // 1. a note on a stop of Day 4, the first place of Day 3 removed, a place added to Day 5
    const note = page.locator('#day-4 li.tl-entry[data-edit="stop"]').filter({ has: page.locator('.tl-title a') }).first();
    const noted = (await note.locator('.tl-title').textContent())!.trim();
    await note.locator('.tl-edit-trail button').click();
    await page.getByRole('menuitem', { name: /^Add a note$/ }).click();
    await page.getByLabel('Note').fill(NOTE);
    await page.getByRole('button', { name: 'Save note' }).click();
    const li = page.locator('#day-3 li.tl-entry[data-edit="stop"]').filter({ has: page.locator('.tl-title a') }).first();
    const gone = (await li.locator('.tl-title').textContent())!.trim();
    await li.locator('.tl-edit-trail button').click();
    await page.getByRole('menuitem', { name: /^Remove from Day 3/ }).click();
    await page.locator('#day-5 .tl-add-open').click();
    const dlg = page.getByRole('dialog', { name: /Add a place|Add /i });
    const row = dlg.locator('.add-row').filter({ has: page.getByRole('button', { name: /^Add .* to Day 5$/ }) }).filter({ hasNotText: 'Day full' }).first();
    const added = (await row.locator('.add-title').textContent())!.trim();
    await row.getByRole('button', { name: /^Add / }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => stopTitles(page, 5)).toContain(added);

    // 2. the trip ⋯ menu's Print answers with the print view (not the page): header, days, bookings after the days
    await recordPrint(page);
    await page.locator('.edit-trip-more').click();
    await page.getByRole('menuitem', { name: 'Print' }).click();
    await expect.poll(async () => (await printed(page)).length).toBe(1);
    const paper = (await printed(page))[0]!;
    expect(paper).toContain('Your copy of Canadian Rockies · Sat 8 Sep 2029 · 2 adults, 1 child');
    const d3 = paper.slice(paper.indexOf('Day 3:'), paper.indexOf('Day 4:'));
    // the day's title may name the place; a row of the day does not (a row starts with its time)
    expect(d3).not.toMatch(new RegExp(`(\\d\\d:\\d\\d|After dark)[^·]*· ${gone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    const d5 = paper.slice(paper.indexOf('Day 5:'), paper.indexOf('Day 6:'));
    expect(d5).toContain(added);
    expect(paper).toContain(`Your note: ${NOTE}`);
    expect(paper.indexOf(noted)).toBeGreaterThan(-1);
    const book = paper.indexOf('Book ahead');
    if (book >= 0) expect(book).toBeGreaterThan(paper.lastIndexOf(`Day ${days}:`));
    expect(paper).not.toMatch(PRIVATE);
    expect(paper).not.toMatch(/\bPhotos\b/);

    // 3. Export trip > Print or save as PDF is the same view
    await page.locator('.trip-actions').getByRole('button', { name: /Export trip/ }).click();
    await page.getByRole('menuitem', { name: /Print or save as PDF/ }).click();
    await expect.poll(async () => (await printed(page)).length).toBe(2);
    expect((await printed(page))[1]).toBe(paper);

    // 4. the calendar file is the edited timelines, dated by the copy's start
    await page.locator('.trip-actions').getByRole('button', { name: /Export trip/ }).click();
    const [ics] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^Calendar file \(ICS\)/ }).click()]);
    expect(ics.suggestedFilename()).toBe(`${SLUG}.ics`);
    const text = readFileSync((await ics.path())!, 'utf8').replace(/\r\n /g, '');
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain(`SUMMARY:${added.replace(/,/g, '\\,')}`);
    expect(text).not.toContain(`SUMMARY:${gone.replace(/,/g, '\\,')}`);
    expect(text).toContain(`Your note: ${NOTE}`);
    expect(text).toContain('DTSTART;VALUE=DATE:20290908');
    expect(text).not.toMatch(PRIVATE);
    await expect(page.locator('.toast-region')).toContainText(`Downloaded ${SLUG}.ics`);

    // 5. the CSV is the edited stops too
    await page.locator('.trip-actions').getByRole('button', { name: /Export trip/ }).click();
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^For a spreadsheet \(CSV\)/ }).click()]);
    const body = readFileSync((await csv.path())!, 'utf8');
    expect(body).toContain(added);
    expect(body).not.toContain(gone);
    expect(body).not.toMatch(PRIVATE);
  });
});
