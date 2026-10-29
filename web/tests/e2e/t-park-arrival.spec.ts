import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Review STEP2-PRV PR-003: Save to a trip from a park page, then the trip's add picker. The park's places are its named area (no Kananaskis
// place under Banff), the first page resolves at once (no row reads "Working out the day" for long), and every Add names a day that fits.
// Needs the build with NEXT_PUBLIC_TRIP_EDIT=1, then PW_REUSE_SITE=1 PW_SITE_URL=<that server> playwright test t-park-arrival (alone, on a
// free port). With the flag off /t/ answers 404 and every test skips.
const ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const SLUG = 'canadian-rockies-2029';
const COPIES_KEY = 'travel.copies.local';
const copy = (days: number) => ({
  id: ID, slug: SLUG, title: 'Canadian Rockies', days, cc: 'CA', photo: null, start: '2029-09-08', adults: 2, children: [10],
  profile: { party: 'family', youngest: 10, pace: 'standard', adults: 2, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });
const NOT_BANFF = ['Kananaskis River', 'Barrier Lake', 'Nakiska', 'Ribbon Creek', 'Troll Falls', 'Smith-Dorrien', 'Marble Canyon', 'Grassi Lakes'];

test.describe('the park arrival (PR-003)', () => {
  let days = 0;
  test.beforeAll(async ({ playwright, site }) => {
    const ctx = await playwright.request.newContext();
    const probe = await ctx.get(`${site.url}/t/${ID}/`);
    test.skip(probe.status() === 404, 'needs the build with NEXT_PUBLIC_TRIP_EDIT=1');
    days = ((await (await ctx.get(`${site.url}/api/v1/trips/${SLUG}/plan-model/`)).json()) as { days: unknown[] }).days.length;
    await ctx.dispose();
  });
  const seed = (page: Page) =>
    page.addInitScript(([k, v]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k!, v!);
    }, [COPIES_KEY, envelope([copy(days)])]);

  test('Save to a trip on Banff National Park, then the add picker: the first 12 rows resolve within 2 s, none waits after 5 s, no Kananaskis place', async ({ page, site }) => {
    await seed(page);
    const reads: string[] = [];
    page.on('request', (r) => { if (/\/api\/v1\/(places|near)\//.test(r.url())) reads.push(r.url()); });
    await page.goto(`${site.url}/places/banff-national-park/`);
    await page.getByRole('button', { name: 'Save to a trip' }).click();
    await page.getByRole('link', { name: 'Add places in Banff National Park to Canadian Rockies' }).click();
    await expect(page).toHaveURL(new RegExp(`/t/${ID}/.*add=banff-national-park`));
    const sheet = page.getByRole('dialog', { name: /Add a place/ });
    await expect(sheet.getByRole('heading', { name: 'In Banff National Park' })).toBeVisible({ timeout: 15_000 });
    const rows = sheet.locator('.add-row');
    // the first page: 12 rows, and each resolves within 2 s of the list drawing
    await expect(rows).toHaveCount(12);
    await expect(sheet.locator('.add-fit', { hasText: 'Working out the day' })).toHaveCount(0, { timeout: 2_000 });
    await page.waitForTimeout(3_000);
    await expect(sheet.locator('.add-fit', { hasText: 'Working out the day' })).toHaveCount(0);
    // the member list is the park's named area: no Kananaskis, Canmore or Kootenay place
    const names = await sheet.locator('.add-title').allTextContents();
    for (const n of NOT_BANFF) expect(names.join(' | ')).not.toContain(n);
    // a full day is never offered: each Add names a day, and a row whose nearest day is full names another one
    const buttons = await sheet.locator('.add-row .add-btn').allTextContents();
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b).toMatch(/^(Add to Day \d+|Pick a day)$/);
    for (const r of await rows.all()) {
      const fit = (await r.locator('.add-fit').textContent().catch(() => '')) ?? '';
      const btn = (await r.locator('.add-btn').textContent().catch(() => null)) ?? '';
      const m = /^Day (\d+) full: try Day (\d+)$/.exec(fit);
      if (m) expect(btn).toBe(`Add to Day ${m[2]}`);
      expect(fit).not.toBe('Day full');
    }
    // not every row offers Day 1
    expect(new Set(buttons.filter((b) => b.startsWith('Add'))).size).toBeGreaterThan(1);
    // above 12 rows the sheet has a search field over the park's places, and the rows are grouped by base
    await expect(sheet.getByRole('searchbox', { name: 'Search the places in Banff National Park' })).toBeVisible();
    await expect(sheet.locator('.add-subh').first()).toHaveText(/^Near /);
    await expect(sheet.getByRole('button', { name: /^Show \d+ more$/ })).toBeVisible();
    // one bounded read by the park's name, never a radius from its point
    const memberReads = reads.filter((u) => /q=banff/i.test(decodeURIComponent(u)));
    expect(memberReads.length).toBeGreaterThan(0);
    expect(memberReads.length).toBeLessThanOrEqual(3);
    for (const u of reads) expect(u).not.toMatch(/\/near\/.*banff-national-park|r=5\d/);
  });

  test('Add on a member puts it on the day the row names; Search narrows the list; Pick a day opens that place\'s day list with a way back', async ({ page, site }) => {
    await seed(page);
    await page.goto(`${site.url}/t/${ID}/?edit=1&view=day&add=banff-national-park`);
    const sheet = page.getByRole('dialog', { name: /Add a place/ });
    await expect(sheet.getByRole('heading', { name: 'In Banff National Park' })).toBeVisible({ timeout: 15_000 });
    const row = sheet.locator('.add-row').filter({ has: page.getByRole('button', { name: /^Add .+ to Day \d+$/ }) }).first();
    const label = (await row.getByRole('button').getAttribute('aria-label'))!;
    const [, name, day] = /^Add (.+) to Day (\d+)$/.exec(label)!;
    await row.getByRole('button').click();
    await expect(sheet.locator('.add-added')).toContainText(`Added ${name} to Day ${day}`);
    await sheet.getByRole('searchbox').fill('moraine');
    await expect(sheet.locator('.add-title').first()).toContainText('Moraine');
    const pick = sheet.getByRole('button', { name: /^Pick a day for / }).first();
    if (await pick.count()) {
      await pick.click();
      await expect(sheet.getByRole('heading', { name: /^(Add it to a day|On Day \d+ now)/ })).toBeVisible();
      await sheet.getByRole('button', { name: 'Back to Banff National Park' }).click();
      await expect(sheet.getByRole('heading', { name: 'In Banff National Park' })).toBeVisible();
    }
  });
});
