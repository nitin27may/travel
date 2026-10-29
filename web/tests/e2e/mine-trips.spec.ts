import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { sampleDraft } from '../../../core/test/plan/helpers';

// NAV-2: My trips on the device and the copy sheet's saving (docs/v2/design/shell/mine-and-bar-spec.md 5.2, 7; briefs-bundle-A 7.9).
// Seeds localStorage for what Mine shows; the copy flow itself runs on the real trip page.

// With the build made under NEXT_PUBLIC_TRIP_EDIT=1 a copy opens at its own page /t/<id>/ (STEP2-T1), and Copy to my trips opens the new copy
// straight away in edit mode with the toast "Copied ... to My trips" and Undo (STEP2-P3; no done step). Run the spec with the same variable the
// build had.
const TRIP_EDIT = process.env.NEXT_PUBLIC_TRIP_EDIT === '1';
const OPEN_LINK = 'Open in Mine';
const COPIES_KEY = 'travel.copies.local';
const LEGACY_KEY = 'travel:v1:copy-drafts';
const MOVED_KEY = 'travel.copies.legacyMovedAt';
const ID1 = '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b';
const ID2 = '7a2d1b63-9e1f-4c8f-8b62-3d4e5f6a7b8c';

type Seed = Record<string, unknown>;
const item = (o: Seed = {}) => ({
  id: ID1, slug: 'dolomites-2027', title: 'Dolomites', days: 14, cc: 'IT', photo: null, start: '2027-07-03', adults: 2, children: [6],
  profile: { party: 'family', youngest: 6, pace: 'relaxed', adults: 2, walk: null, split: false }, overrides: { '5': 'C' }, added: [],
  copiedAt: '2026-10-20T10:00:00.000Z', ...o,
});
const envelope = (items: Seed[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });

async function seed(page: Page, values: Record<string, string>) {
  await page.addInitScript((kv) => {
    if (sessionStorage.getItem('seeded')) return; // the first document of the context only, so a reload keeps what the page wrote
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, values);
}
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), COPIES_KEY).then((t) => (t ? (JSON.parse(t) as { items: Seed[] }) : null));

const PLANS_KEY = 'travel.plans.local';
const DRAFT_ID = '2d9f6a3e-1b8c-4f2a-8e47-0a1b2c3d4e5f';
const plans = (...items: unknown[]) => JSON.stringify({ schema: 'plan-drafts/1', items });

// STEP2-P2: one Mine list for the copies and the plans the builder keeps on this device
test.describe('one list for copies and plans', () => {
  test('three copies and one draft list four rows once each; the draft carries its chip, and Remove has Undo', async ({ page, site }) => {
    const copies = [
      item(),
      item({ id: ID2, slug: 'algonquin-muskoka-2026', title: 'Algonquin', start: '2027-09-01', children: [], profile: null, overrides: {} }),
      item({ id: '8b3e2c74-0f2a-4d9a-9c73-4e5f6a7b8c9d', slug: 'vermont-fall-2026', title: 'Vermont', start: '2026-12-20' }),
    ];
    await seed(page, { [COPIES_KEY]: envelope(copies), [PLANS_KEY]: plans(sampleDraft({ id: DRAFT_ID, title: 'Alps loop', nights: 3, lastBuild: null })) });
    await page.goto(`${site.url}/mine/`);
    await expect(page.locator('.crow')).toHaveCount(4);
    await expect(page.getByRole('tab', { name: /My trips/ })).toContainText('4');
    const draft = page.locator(`.crow[data-copy-id="${DRAFT_ID}"]`);
    await expect(draft.locator('.crow-name')).toHaveText('Alps loop');
    await expect(draft.locator('.crow-chip')).toHaveText('Draft · ready to build');
    await expect(draft.locator('a.crow-link')).toHaveAttribute('href', new RegExp(`^/plan/?\\?draft=${DRAFT_ID}&s=4$`));
    await draft.getByRole('button', { name: 'Actions for Alps loop' }).click();
    await expect(page.getByRole('menuitem')).toHaveText([/Continue/, /Remove/]);
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    await expect(page.locator('.crow')).toHaveCount(3);
    expect(await page.evaluate((k) => localStorage.getItem(k), PLANS_KEY)).toBeNull();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.crow')).toHaveCount(4);
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), PLANS_KEY))!).items).toHaveLength(1);
    // a reload lists the same four, once each
    await page.reload();
    await expect(page.locator('.crow')).toHaveCount(4);
  });

  test('a draft held under the copies key as well is listed once', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item({ id: DRAFT_ID })]), [PLANS_KEY]: plans(sampleDraft({ id: DRAFT_ID, title: 'Alps loop', nights: 3, lastBuild: null })) });
    await page.goto(`${site.url}/mine/`);
    await expect(page.locator('.crow')).toHaveCount(1);
    await expect(page.locator('.crow-name')).toHaveText('Dolomites');
  });

  test('the empty state says what it always said, and adds the builder only with planBuilder on', async ({ page, site }) => {
    await page.goto(`${site.url}/mine/`);
    await expect(page.getByRole('heading', { name: 'No trips yet' })).toBeVisible();
    const builder = process.env.NEXT_PUBLIC_PLAN_BUILDER === '1';
    await expect(page.getByText(builder ? 'Copy one of our trips or plan your own. It stays here.' : 'Copy one of our trips. It stays here.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Plan your own trip' })).toHaveCount(builder ? 1 : 0);
  });
});

test.describe('My trips rows', () => {
  test('three lines, the menu, and a link that opens the trip with the copy\'s choices', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item()]) });
    await page.goto(`${site.url}/mine/`);
    const row = page.locator('.crow');
    await expect(row).toHaveCount(1);
    await expect(row.locator('.crow-name')).toHaveText('Dolomites');
    await expect(row.locator('.crow-l2')).toContainText(/^Sat 3 Jul 2027 · (in \d+ days|tomorrow)$/);
    await expect(row.locator('.crow-l3')).toHaveText('14 days · 2 adults, 1 child');
    await expect(page.getByRole('tab', { name: /My trips/ })).toContainText('1');
    await row.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await expect(page.getByRole('menuitem')).toHaveText(TRIP_EDIT ? [/Open/, /Edit/, /Add to calendar/, /Print/, /Change dates/, /Remove/] : [/Open/, /Add to calendar/, /Print/, /Change dates/, /Remove/]);
    await page.keyboard.press('Escape');
    await row.locator('a.crow-link').click();
    if (TRIP_EDIT) await expect(page).toHaveURL(new RegExp(`/t/${ID1}/\\?view=day$`));
    else await expect(page).toHaveURL(/\/trips\/dolomites-2027\/\?p=family-6&pace=relaxed&a=2&d=5C&view=day&mine=1$/);
    expect(page.url()).not.toMatch(/adults|children|copiedAt/);
  });

  test('Add to calendar downloads an ICS that starts on the copy\'s date', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item()]) });
    await page.goto(`${site.url}/mine/`);
    await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
    const [ics] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Add to calendar/ }).click()]);
    expect(ics.suggestedFilename()).toBe('dolomites-2027.ics');
    const text = readFileSync((await ics.path())!, 'utf8');
    expect(text).toContain('DTSTART;VALUE=DATE:20270703');
    await expect(page.locator('.toast-region')).toContainText('Downloaded dolomites-2027.ics');
  });

  test('Remove collapses the row with Undo in the toast; Undo returns it; Remove then reload keeps it gone', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item(), item({ id: ID2, slug: 'algonquin-muskoka-2026', title: 'Algonquin', start: '2027-09-01', children: [], profile: null, overrides: {} })]) });
    await page.goto(`${site.url}/mine/`);
    await expect(page.locator('.crow')).toHaveCount(2);
    await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    await expect(page.locator('.crow')).toHaveCount(1);
    await expect(page.locator('.toast-region')).toContainText('Removed Dolomites from Mine');
    await expect(page.locator('.crow a.crow-link')).toBeFocused(); // focus moves to the next row's link
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.crow')).toHaveCount(2);
    await expect(page.locator('[data-copy-id]').first().locator('.crow-name')).toHaveText('Dolomites'); // soonest first: back in its place
    await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    await expect(page.locator('.crow')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('.crow')).toHaveCount(1);
    await expect(page.locator('.crow-name')).toHaveText('Algonquin');
  });

  test('a second tab updates through the storage event', async ({ page, context, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item()]) });
    await page.goto(`${site.url}/mine/`);
    const other = await context.newPage();
    await other.goto(`${site.url}/mine/`);
    await expect(other.locator('.crow')).toHaveCount(1);
    await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    await expect(page.locator('.crow')).toHaveCount(0);
    await expect(other.locator('.crow')).toHaveCount(0);
    await expect(other.getByText('No trips yet')).toBeVisible();
  });

  test('past trips sit in a collapsed group with their count', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item({ start: '2024-07-03' })]) });
    await page.goto(`${site.url}/mine/`);
    const toggle = page.getByRole('button', { name: 'Past (1)' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.crow a.crow-link')).toHaveCount(1);
    await expect(page.locator('.crow a.crow-link')).not.toBeVisible();
    await toggle.click();
    await expect(page.locator('.crow a.crow-link')).toBeVisible();
    await expect(page.locator('.crow-l2')).toContainText('ended');
  });

  test('a legacy draft with one bad override appears and the old key goes only after a good write', async ({ page, site }) => {
    const draft = [{ slug: 'dolomites-2027', start: '2027-07-03', adults: 2, children: [], savedAt: '2026-10-01T10:00:00.000Z', overrides: { '3': 'B', '4': 'ZZ' } }];
    await seed(page, { [LEGACY_KEY]: JSON.stringify(draft) });
    await page.goto(`${site.url}/mine/`);
    await expect(page.locator('.crow')).toHaveCount(1);
    await expect(page.locator('.crow-name')).toHaveText('Dolomites, 13 nights'); // the placeholder title is replaced by the catalogue's name (resolveRefs)
    expect(await page.evaluate((k) => localStorage.getItem(k), LEGACY_KEY)).toBeNull();
    expect(await page.evaluate((k) => localStorage.getItem(k), MOVED_KEY)).not.toBeNull();
    expect((await stored(page))!.items[0]).toMatchObject({ slug: 'dolomites-2027', overrides: { '3': 'B' } });
  });

  test('"N older copies did not fit" from the move', async ({ page, site }) => {
    const many = Array.from({ length: 22 }, (_, i) => ({ slug: `trip-${i}`, start: '2027-07-03', adults: 2, children: [], savedAt: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00.000Z` }));
    await seed(page, { [LEGACY_KEY]: JSON.stringify(many) });
    await page.goto(`${site.url}/mine/`);
    await expect(page.getByText('2 older copies did not fit')).toBeVisible();
    await expect(page.locator('.crow')).toHaveCount(20);
  });

  test('a newer envelope is left as it is and Mine says so', async ({ page, site }) => {
    const text = JSON.stringify({ schema: 'copies/3', items: [] });
    await seed(page, { [COPIES_KEY]: text });
    await page.goto(`${site.url}/mine/`);
    await expect(page.getByText('This list was written by a newer version of the site')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), COPIES_KEY)).toBe(text);
  });

  test('empty: the prompt and the way to trips', async ({ page, site }) => {
    await page.goto(`${site.url}/mine/`);
    await expect(page.getByText('No trips yet')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse trips' })).toBeVisible();
  });
});

async function openSheet(page: Page, site: { url: string }) {
  await page.goto(`${site.url}/trips/dolomites-2027/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Copy to my trips' }).first().click();
  const sheet = page.locator('.copy-sheet');
  await expect(sheet).toBeVisible();
  return sheet;
}
async function fill(sheet: ReturnType<Page['locator']>, children = true) {
  await sheet.locator('.cal-cell[data-season]:not([disabled])').first().click();
  if (children) {
    await sheet.getByRole('button', { name: 'More children' }).click();
    await sheet.getByLabel('Child 1 age').selectOption('7');
  }
}

test.describe('the copy sheet saves into Mine', () => {
  test('copy, then Open in Mine; the copy is there after a reload with its party', async ({ page, site }) => {
    const sheet = await openSheet(page, site);
    // SW-008: the date is optional; nothing is picked and the field says so
    await expect(sheet.getByTestId('copy-date')).toHaveText('No date yet');
    await fill(sheet);
    await expect(sheet.locator('.copy-note')).toHaveText('Kept in this browser.'); // sign-in is off in this build
    await sheet.getByRole('button', { name: 'Copy to my trips' }).click();
    if (TRIP_EDIT) {
      // STEP2-P3: no done step; the copy opens in edit mode on its days, with the toast and its Undo
      await expect(page).toHaveURL(/\/t\/[0-9a-f-]{36}\/\?edit=1&view=day$/);
      await expect(page.locator('.toast-region')).toContainText('Copied Dolomites to My trips');
      await expect(page.locator('.toast-region').getByRole('button', { name: 'Undo' })).toBeVisible();
      await page.goto(`${site.url}/mine/?show=trips`);
      await page.reload();
      await expect(page.locator('.crow')).toHaveCount(1);
      await expect(page.locator('.crow-l3')).toContainText('2 adults, 1 child');
      expect((await stored(page))!.items[0]).toMatchObject({ slug: 'dolomites-2027', adults: 2, children: [7] });
      return;
    }
    await expect(page.locator('.toast-region .toast')).toHaveCount(0); // the sheet is modal: no toast, Undo is in its footer
    await expect(sheet.getByRole('button', { name: 'Undo' })).toBeVisible();
    const open = sheet.getByRole('link', { name: OPEN_LINK });
    await expect(open).toBeVisible();
    // Open in Mine comes first, then the export list, then Done
    const order = await sheet.evaluate((el) => [...el.querySelectorAll('a, button')].map((b) => b.textContent?.trim() ?? '').filter((t) => /^(Open in Mine|Open your trip|Calendar|Done)/.test(t)));
    expect(order[0]).toBe(OPEN_LINK);
    expect(order[order.length - 1]).toBe('Done');
    await open.click();
    await expect(page).toHaveURL(/\/mine\/\?show=trips$/);
    await page.reload();
    await expect(page.locator('.crow')).toHaveCount(1);
    await expect(page.locator('.crow-l3')).toContainText('2 adults, 1 child');
    // the Mine dot cleared by opening Mine; the envelope holds the choices and no extra keys
    const env = await stored(page);
    expect(env!.items[0]).toMatchObject({ slug: 'dolomites-2027', adults: 2, children: [7] });
  });

  test('copy again asks before replacing, and Replace takes the first copy\'s place', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item({ start: '2027-07-03' })]) });
    const sheet = await openSheet(page, site);
    await fill(sheet, false);
    await sheet.getByRole('button', { name: 'Copy to my trips' }).click();
    await expect(sheet.locator('.copy-note')).toContainText('You already have a copy from Sat 3 Jul 2027. Copy again to replace it.');
    expect((await stored(page))!.items).toHaveLength(1);
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet.getByRole('button', { name: 'Copy to my trips' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Copy to my trips' }).click();
    await sheet.getByRole('button', { name: 'Replace' }).click();
    if (TRIP_EDIT) await expect(page).toHaveURL(/\/t\/[0-9a-f-]{36}\/\?edit=1&view=day$/);
    else await expect(sheet.getByRole('link', { name: OPEN_LINK })).toBeVisible();
    const env = await stored(page);
    expect(env!.items).toHaveLength(1);
    expect(env!.items[0]!.start).not.toBe('2027-07-03');
  });

  test('the cap of 20 refuses a new trip with the message and writes nothing', async ({ page, site }) => {
    const many = Array.from({ length: 20 }, (_, i) => item({ id: `6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f60${String(i).padStart(2, '0')}`, slug: `trip-${i}`, title: `Trip ${i}` }));
    await seed(page, { [COPIES_KEY]: envelope(many) });
    const sheet = await openSheet(page, site);
    await fill(sheet, false);
    await sheet.getByRole('button', { name: 'Copy to my trips' }).click();
    await expect(sheet.locator('.copy-note')).toContainText('You have 20 trip copies on this device, the most we keep. Remove one to copy another.');
    expect((await stored(page))!.items).toHaveLength(20);
    // the primary is now the way out: Open Mine, with Cancel; no second press of Copy
    await expect(sheet.getByRole('link', { name: 'Open Mine' })).toHaveAttribute('href', '/mine/?show=trips');
    await expect(sheet.getByRole('button', { name: 'Copy to my trips' })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('storage blocked: the copy lasts this tab, the sheet says so, and the calendar file still downloads', async ({ page, site }) => {
    // writes under the copies and favourites keys are refused (a private window, a full or blocked store); the page's own keys still work
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (String(k).startsWith('travel.')) throw new DOMException('blocked', 'SecurityError');
        return set.call(this, k, v);
      };
    });
    const sheet = await openSheet(page, site);
    await fill(sheet, false);
    await sheet.getByRole('button', { name: 'Copy to my trips' }).click();
    await expect(sheet.getByText('This browser is not keeping data, so this copy lasts until you close this tab. The calendar file keeps your dates.')).toBeVisible();
    await expect(sheet.getByRole('link', { name: OPEN_LINK })).toHaveCount(0); // a new page would lose it
    const [ics] = await Promise.all([page.waitForEvent('download'), sheet.getByRole('button', { name: /^Calendar \(\.ics\)/ }).click()]);
    expect(readFileSync((await ics.path())!, 'utf8')).toContain('BEGIN:VCALENDAR');
  });

  test('Undo in the toast removes the copy and returns to the public trip (tripEdit on)', async ({ page, site }) => {
    test.skip(!TRIP_EDIT, 'the done step is the flag-off flow');
    const sheet = await openSheet(page, site);
    await fill(sheet, false);
    await sheet.getByRole('button', { name: 'Copy to my trips' }).click();
    await expect(page).toHaveURL(/\/t\/[0-9a-f-]{36}\/\?edit=1&view=day$/);
    await page.locator('.toast-region').getByRole('button', { name: 'Undo' }).click();
    await expect(page).toHaveURL(/\/trips\/dolomites-2027\/$/);
    expect(((await stored(page))?.items.length ?? 0)).toBe(0);
  });

  test('the public trip says "You have a copy of this trip · Open it" once the device holds one (tripEdit on), and not otherwise', async ({ page, site }) => {
    test.skip(!TRIP_EDIT, 'the line and /t/ exist only with the flag on');
    await page.goto(`${site.url}/trips/dolomites-2027/`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Copy to my trips' }).first()).toBeVisible();
    await expect(page.locator('.have-copy')).toHaveCount(0);
    await seed(page, { [COPIES_KEY]: envelope([item()]) });
    await page.goto(`${site.url}/trips/dolomites-2027/`, { waitUntil: 'domcontentloaded' });
    const line = page.locator('.trip-cover .have-copy');
    await expect(line).toHaveText('You have a copy of this trip · Open it');
    await expect(line.getByRole('link', { name: 'Open it' })).toHaveAttribute('href', `/t/${ID1}/`);
    await line.getByRole('link', { name: 'Open it' }).click();
    await expect(page).toHaveURL(new RegExp(`/t/${ID1}/$`));
    // another trip's copy does not count
    await page.goto(`${site.url}/trips/algonquin-muskoka-2026/`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Copy to my trips' }).first()).toBeVisible();
    await expect(page.locator('.have-copy')).toHaveCount(0);
  });

  test('Undo in the done step\'s footer removes the copy and returns to the form', async ({ page, site }) => {
    test.skip(TRIP_EDIT, 'with tripEdit on the copy opens at once and Undo is in the toast (above)');
    const sheet = await openSheet(page, site);
    await fill(sheet, false);
    await sheet.getByRole('button', { name: 'Copy to my trips' }).click();
    await sheet.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(async () => ((await stored(page))?.items.length ?? 0)).toBe(0);
    await expect(sheet.getByRole('button', { name: 'Copy to my trips' })).toBeVisible();
  });

  test('quota: the sheet says the browser is out of space and writes nothing', async ({ page, site }) => {
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      let armed = false;
      (window as unknown as { __arm: () => void }).__arm = () => { armed = true; };
      Storage.prototype.setItem = function (k: string, v: string) {
        if (armed && String(k) === 'travel.copies.local') throw new DOMException('full', 'QuotaExceededError');
        return set.call(this, k, v);
      };
    });
    const sheet = await openSheet(page, site);
    await fill(sheet, false);
    await page.evaluate(() => (window as unknown as { __arm: () => void }).__arm());
    await sheet.getByRole('button', { name: 'Copy to my trips' }).click();
    await expect(sheet.locator('.copy-note')).toHaveText('This browser is out of space for this site, so nothing was written. Take the files below.');
  });

  test('Change dates offers Calendar, GPX and CSV only (Print is in the row menu), and an out-of-season date shows the caution', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item({ start: '2027-12-03' })]) });
    await page.goto(`${site.url}/mine/`);
    await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await page.getByRole('menuitem', { name: 'Change dates' }).click();
    const sheet = page.locator('.copy-sheet');
    await expect(sheet.getByRole('button', { name: /^Calendar \(\.ics\)/ })).toBeVisible();
    await expect(sheet.getByRole('button', { name: /^GPX/ })).toBeVisible();
    await expect(sheet.getByRole('button', { name: /^PDF/ })).toHaveCount(0);
    await expect(sheet.getByText('outside the season this plan is built for')).toBeVisible(); // the window comes from the export model
  });
});

test.describe('Print from Mine', () => {
  test('opens the trip, prints its print view once, and leaves no key behind', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item()]) });
    await page.addInitScript(() => {
      (window as unknown as { __prints: number }).__prints = 0;
      window.print = () => { (window as unknown as { __prints: number }).__prints++; };
    });
    await page.goto(`${site.url}/mine/`);
    await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await page.getByRole('menuitem', { name: 'Print' }).click();
    await expect(page).toHaveURL(TRIP_EDIT ? new RegExp(`/t/${ID1}/`) : /\/trips\/dolomites-2027\//);
    expect(page.url()).not.toMatch(/print/i); // never a URL key
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prints: number }).__prints), { timeout: 15_000 }).toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem('travel.mine.print'))).toBeNull();
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test('a stale key for another trip does nothing, and the key is gone', async ({ page, site }) => {
    await page.addInitScript(() => {
      (window as unknown as { __prints: number }).__prints = 0;
      window.print = () => { (window as unknown as { __prints: number }).__prints++; };
      if (!sessionStorage.getItem('seeded-print')) { sessionStorage.setItem('seeded-print', '1'); sessionStorage.setItem('travel.mine.print', 'algonquin-muskoka-2026'); }
    });
    await page.goto(`${site.url}/trips/dolomites-2027/`);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(0);
  });
});

test.describe('Remove focus, and Change dates', () => {
  test('the last Upcoming row removed with Past closed puts focus on the Past toggle', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item(), item({ id: ID2, slug: 'algonquin-muskoka-2026', title: 'Algonquin', start: '2024-09-01', children: [], profile: null, overrides: {} })]) });
    await page.goto(`${site.url}/mine/`);
    await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    await expect(page.getByRole('button', { name: 'Past (1)' })).toBeFocused();
  });
  test('removing the only copy puts focus on the empty state\'s action', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item()]) });
    await page.goto(`${site.url}/mine/`);
    await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    await expect(page.getByRole('link', { name: 'Browse trips' })).toBeFocused();
  });

  test('SW-008: a copy without a date is kept, sits under No date, its calendar asks for dates first, and Add dates gives it one', async ({ page, site }) => {
    const sheet = await openSheet(page, site);
    await expect(sheet.getByTestId('copy-date')).toHaveText('No date yet');
    await expect(sheet.locator('.copy-nodate')).toContainText('Optional.');
    // a picked date can be taken back
    await sheet.locator('.cal-cell[data-season]:not([disabled])').first().click();
    await expect(sheet.getByTestId('copy-date')).not.toHaveText('No date yet');
    await sheet.getByRole('button', { name: 'No date yet' }).click();
    await expect(sheet.getByTestId('copy-date')).toHaveText('No date yet');
    await expect(sheet.getByRole('button', { name: 'Copy to my trips' })).toBeEnabled();
    await sheet.getByRole('button', { name: 'Copy to my trips' }).click();
    if (TRIP_EDIT) await expect(page).toHaveURL(/\/t\/[0-9a-f-]{36}\/\?edit=1&view=day$/);
    else await expect(sheet).toContainText('14 days · No date yet');
    const env = await stored(page);
    expect(env).toMatchObject({ schema: 'copies/2', items: [{ slug: 'dolomites-2027', start: null }] });
    expect(['blue', 'orange', 'teal', 'sky', 'yellow', 'vermillion']).toContain(env!.items[0]!.identity);
    await page.goto(`${site.url}/mine/`);
    await expect(page.locator('#mt-nodate')).toContainText('No date');
    const row = page.locator('.crow');
    await expect(row.locator('.crow-l2')).toHaveText('No date');
    await expect(row.locator('.mthumb')).toHaveAttribute('data-ring', String(env!.items[0]!.identity));
    await row.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await expect(page.getByRole('menuitem', { name: 'Calendar: add dates first' })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('menuitem', { name: 'Add dates', exact: true }).click();
    const again = page.locator('.copy-sheet');
    await expect(again.getByTestId('copy-date')).toHaveText('No date yet');
    // an undated copy's calendar opens where a new copy's does (the season, or today): pick its first open day
    const cell = again.locator('.cal-cell:not([disabled])').first();
    const picked = await cell.getAttribute('data-date');
    await cell.click();
    await again.getByRole('button', { name: 'Add dates' }).click();
    await expect(page.locator('.toast-region')).toContainText(' now starts ');
    await expect(page.locator('#mt-nodate')).toHaveCount(0);
    expect((await stored(page))!.items[0]).toMatchObject({ start: picked });
  });

  test('SW-026: a copy made before copies/2 has a ring from its slug, the same on every visit', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item()]) });
    await page.goto(`${site.url}/mine/`);
    const ring = await page.locator('.crow .mthumb').getAttribute('data-ring');
    expect(['blue', 'orange', 'teal', 'sky', 'yellow', 'vermillion']).toContain(ring);
    await page.reload();
    await expect(page.locator('.crow .mthumb')).toHaveAttribute('data-ring', ring!);
  });

  test('Change dates reopens the sheet with the copy\'s date and party and keeps the row\'s id', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: envelope([item()]) });
    await page.goto(`${site.url}/mine/`);
    await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await page.getByRole('menuitem', { name: 'Change dates' }).click();
    const sheet = page.locator('.copy-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.copy-date-input')).toContainText('Sat 3 Jul 2027');
    await expect(sheet.getByRole('group', { name: 'Adults' }).locator('output')).toHaveText('2');
    await expect(sheet.getByLabel('Child 1 age')).toHaveValue('6');
    await sheet.locator('.cal-cell[data-date="2027-07-10"]:not([disabled])').click();
    await sheet.getByRole('button', { name: 'Change dates' }).click();
    await expect(page.locator('.toast-region')).toContainText('Dolomites now starts Sat 10 Jul 2027');
    await expect(page.locator('.crow-l2')).toContainText('Sat 10 Jul 2027');
    const env = await stored(page);
    expect(env!.items[0]).toMatchObject({ id: ID1, start: '2027-07-10', copiedAt: '2026-10-20T10:00:00.000Z' });
    await page.locator('.toast-region').getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.crow-l2')).toContainText('Sat 3 Jul 2027');
  });
});

test('privacy: no copy, party or start date reaches /api/v1 while copying and browsing Mine', async ({ page, site }) => {
  const seen: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/v1')) seen.push(`${r.method()} ${r.url()} ${r.postData() ?? ''}`);
  });
  const sheet = await openSheet(page, site);
  await fill(sheet);
  const picked = (await sheet.locator('.copy-date-input').innerText()).trim();
  expect(picked).not.toBe('');
  await sheet.getByRole('button', { name: 'Copy to my trips' }).click();
  if (TRIP_EDIT) {
    await expect(page).toHaveURL(/\/t\/[0-9a-f-]{36}\//);
    await page.goto(`${site.url}/mine/`);
  } else await sheet.getByRole('link', { name: OPEN_LINK }).click();
  await expect(page.locator('.crow')).toHaveCount(1);
  await page.waitForLoadState('networkidle');
  const start = (await stored(page))!.items[0]!.start as string;
  for (const line of seen) {
    expect(line).not.toContain(start);
    expect(line).not.toMatch(/adults|children|copiedAt|"start"|travellers/);
  }
});
