import type { Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, ROOT, startNext, test } from './fixtures';
import type { Server } from './fixtures';
import { FakeAccount, IDS, planDoc } from './account-fake';

// EM-2: signed-in Mine with the `accountTrips` flag on (edit-my-trip 4.2 to 4.7). Needs the build with both flags:
//   NEXT_PUBLIC_SIGN_IN=1 NEXT_PUBLIC_ACCOUNT_TRIPS=1 NEXT_DIST_DIR=.next-acct next build
// The session and /api/account/plans/** are answered by a fake account in the page's context (tests/e2e/account-fake.ts); the real
// service is EM-E's. The flag-off behaviour is what mine-shell.spec.ts and mine-trips.spec.ts already pin.

const DIST = '.next-acct';
const built = existsSync(path.join(ROOT, 'web', DIST, 'BUILD_ID'));
const COPIES_KEY = 'travel.copies.local';

const copy = (id: string, o: Record<string, unknown> = {}) => ({
  id, slug: 'dolomites-2027', title: 'Dolomites', days: 14, cc: 'IT', photo: null, start: '2027-07-03', adults: 2, children: [6],
  profile: { party: 'family', youngest: 6, pace: 'standard', adults: 2, walk: null, split: false }, overrides: { '5': 'C' }, added: [],
  copiedAt: '2026-10-20T10:00:00.000Z', ...o,
});
const envelope = (items: unknown[]) => JSON.stringify({ schema: 'copies/1', items, noteSeen: null, snoozedUntil: null, merged: {} });

async function seed(page: Page, values: Record<string, string>) {
  await page.addInitScript((kv) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, values);
}
const device = (page: Page) => page.evaluate((k) => (JSON.parse(localStorage.getItem(k) ?? 'null') as { items: { id: string }[] } | null)?.items.map((i) => i.id) ?? [], COPIES_KEY);
const outbox = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('travel.mine.outbox.')).map((k) => JSON.parse(localStorage.getItem(k)!).items.length as number));

test.describe('signed-in Mine, accountTrips on', () => {
  test.skip(!built, `needs web/${DIST}: NEXT_PUBLIC_SIGN_IN=1 NEXT_PUBLIC_ACCOUNT_TRIPS=1 NEXT_DIST_DIR=${DIST} next build`);
  let on: Server;
  test.beforeAll(async () => {
    on = await startNext(DIST);
  });
  test.afterAll(() => on?.stop());

  async function open(page: Page, account: FakeAccount, copies: unknown[] = []) {
    await account.install(page);
    if (copies.length) await seed(page, { [COPIES_KEY]: envelope(copies) });
    await page.goto(`${on.url}/mine/`);
  }

  async function changeDates(page: Page, to: string) {
    await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await page.getByRole('menuitem', { name: 'Change dates' }).click();
    const sheet = page.locator('.copy-sheet');
    await sheet.locator(`.cal-cell[data-date="${to}"]:not([disabled])`).click();
    await sheet.getByRole('button', { name: 'Change dates' }).click();
  }

  test('merges the device copies at load: the row, no chip, the new card line, one toast, the device emptied', async ({ page }) => {
    const account = new FakeAccount();
    await open(page, account, [copy(IDS.a)]);
    await expect(page.locator('.crow')).toHaveCount(1);
    await expect(page.locator('.crow-name')).toHaveText('Dolomites');
    await expect(page.locator('.crow-chip, .crow-retry')).toHaveCount(0);
    await expect(page.locator('.mine-card')).toContainText('Your trips are kept in your account.');
    await expect(page.locator('.mine-card')).not.toContainText('move to your account when the planner opens');
    await expect(page.locator('.toast-region')).toContainText('1 trip added to your account');
    expect(await device(page)).toEqual([]);
    // the row's name says it is in the account
    await expect(page.locator('a.crow-link')).toHaveAttribute('aria-label', /, in your account$/);
    // the next visit reads the account again and posts no copies
    const before = account.calls.filter((c) => c.startsWith('POST')).length;
    await page.reload();
    await expect(page.locator('.crow')).toHaveCount(1);
    expect(account.calls.filter((c) => c.startsWith('POST')).length).toBe(before);
  });

  test('the account\'s trips from another device are listed with their party', async ({ page }) => {
    const account = new FakeAccount();
    account.add(IDS.b, 'Dolomites', { start: '2027-08-02', adults: 3, children: [] });
    await open(page, account);
    await expect(page.locator('.crow-l3')).toHaveText('14 days · 3 adults');
    await expect(page.locator('.crow-l2')).toContainText('Mon 2 Aug 2027');
  });

  test('Change dates goes through the sync; offline the page reads Not synced yet (no row chip with one row, SF10); it sends when the network is back', async ({ page }) => {
    const account = new FakeAccount();
    account.add(IDS.a, 'Dolomites');
    await open(page, account);
    await expect(page.locator('.crow')).toHaveCount(1);
    account.mode = 'net';
    await changeDates(page, '2027-07-10');
    await expect(page.locator('.toast-region')).toContainText('Dolomites now starts Sat 10 Jul 2027');
    await expect(page.locator('.crow-l2')).toContainText('Sat 10 Jul 2027');
    // one row, so every row is offline and the page's line says it: the row draws no chip (SF10, chipsBare since 1964b150); its name keeps the state
    await expect(page.getByText('Not synced yet. Your changes will sync when you are online.')).toBeVisible();
    await expect(page.locator('.crow-chip')).toHaveCount(0);
    await expect(page.locator('a.crow-link')).toHaveAttribute('aria-label', /not synced yet, will sync when online$/);
    expect((await outbox(page))[0]).toBeGreaterThan(0);
    account.mode = 'ok';
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('.crow-chip')).toHaveCount(0);
    expect(await outbox(page)).toEqual([]);
    expect(account.rows.get(IDS.a)!.doc!.start).toBe('2027-07-10');
    // Undo is another change, sent the same way
    await page.locator('.toast-region').getByRole('button', { name: 'Undo' }).click().catch(() => undefined);
  });

  test('three lost rounds read Not synced · Retry, a 44 px button; Retry sends again and focus returns to the row', async ({ page }) => {
    const account = new FakeAccount();
    account.add(IDS.a, 'Dolomites');
    await open(page, account);
    await expect(page.locator('.crow')).toHaveCount(1);
    account.bump = true;
    await changeDates(page, '2027-07-10');
    const retry = page.getByRole('button', { name: /Retry sending changes to Dolomites/ });
    await expect(retry).toBeVisible();
    await expect(retry).toContainText('Not synced · Retry');
    // said once, by name, in the list's polite region (review ACCT-PR SF11)
    await expect(page.locator('.mytrips > .sr-only[aria-live="polite"]')).toHaveText('Dolomites: not synced. Retry is next to it.');
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('a.crow-link')).toHaveAttribute('aria-label', /, not synced$/);
    // the state is announced politely, once
    await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'not synced' })).toHaveCount(1);
    account.bump = false;
    await retry.click();
    await expect(retry).toHaveCount(0);
    await expect(page.locator('a.crow-link')).toBeFocused();
    await expect.poll(() => account.rows.get(IDS.a)!.doc!.start).toBe('2027-07-10');
  });

  test('Remove is a tombstone with Undo that restores the trip', async ({ page }) => {
    const account = new FakeAccount();
    account.add(IDS.a, 'Dolomites');
    account.add(IDS.b, 'Algonquin', { trip: 'algonquin-muskoka-2026', start: '2027-09-01', children: [] });
    await open(page, account);
    await expect(page.locator('.crow')).toHaveCount(2);
    await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    await expect(page.locator('.crow')).toHaveCount(1);
    await expect(page.locator('.toast-region')).toContainText('Removed Dolomites from Mine');
    await expect.poll(() => account.rows.get(IDS.a)!.deleted_at).not.toBeNull();
    await page.locator('.toast-region').getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.crow')).toHaveCount(2);
    expect(account.rows.get(IDS.a)!.deleted_at).toBeNull();
    expect(account.rows.get(IDS.a)!.doc!.template.overrides).toEqual({ '5': 'C' });
  });

  test('a trip removed on another device leaves the list at the next read', async ({ page }) => {
    const account = new FakeAccount();
    account.add(IDS.a, 'Dolomites');
    await open(page, account);
    await expect(page.locator('.crow')).toHaveCount(1);
    account.rows.get(IDS.a)!.doc = null;
    account.rows.get(IDS.a)!.deleted_at = '2026-10-27T10:00:00.000Z';
    account.rows.get(IDS.a)!.revision += 1;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('.crow')).toHaveCount(0);
  });

  test.describe('the routes are not there', () => {
    for (const mode of [404, 503, 500, 'net'] as const) {
      test(`${mode}: the copy stays on this device, the card line says so (no chip on every row), nothing is lost`, async ({ page }) => {
        const account = new FakeAccount();
        account.mode = mode;
        await open(page, account, [copy(IDS.a)]);
        await expect(page.locator('.crow')).toHaveCount(1);
        await expect(page.locator('.mine-card')).toContainText('can’t reach your account');
        // every row in the same state, said by the card: no per-row chip (review ACCT-PR SF10); the row's name still says it
        await expect(page.locator('.crow-chip')).toHaveCount(0);
        await expect(page.locator('.crow-link')).toHaveAttribute('aria-label', /on this device only/);
        expect(await device(page)).toEqual([IDS.a]);
        // it moves on its own when the account answers
        account.mode = 'ok';
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await expect(page.locator('.crow-chip')).toHaveCount(0);
        expect(await device(page)).toEqual([]);
      });
    }
  });

  test('copies over the cap stay on the device; with every row there, the card line says it and no row repeats it', async ({ page }) => {
    const account = new FakeAccount();
    account.overCap = true;
    await open(page, account, [copy(IDS.a), copy(IDS.c, { slug: 'algonquin-muskoka-2026', title: 'Algonquin', start: '2027-09-01' })]);
    await expect(page.locator('.mine-card')).toContainText('2 trips are on this device only: your account holds 50.');
    await expect(page.locator('.crow')).toHaveCount(2);
    await expect(page.locator('.crow-chip')).toHaveCount(0);
    expect(await device(page)).toHaveLength(2);
  });

  test('signed out: the card and the rows are as before, and nothing is asked of the account', async ({ page }) => {
    const account = new FakeAccount();
    await account.install(page, false);
    await seed(page, { [COPIES_KEY]: envelope([copy(IDS.a)]) });
    await page.goto(`${on.url}/mine/`);
    await expect(page.locator('.crow')).toHaveCount(1);
    await expect(page.locator('.crow-chip')).toHaveCount(0);
    await expect(page.locator('.mine-card')).toContainText('Kept in this browser only.');
    expect(account.calls).toEqual([]);
  });

  test('the merge carries the device edits: removals, notes and Maybe reach the account, and nothing of them stays on the device (review STEP2-ES ES-001)', async ({ page }) => {
    const NOTE = 'Bring the blue bag';
    const edits = {
      v: 1,
      items: { [IDS.a]: { added: [], removed: [{ day: 2, item: 'tre-cime-loop', op: 'o-rm' }], moved: [], days: [], maybe: [{ ref: 'place/lago-di-braies', op: 'o-mb' }], notes: { '3': NOTE } } },
    };
    const account = new FakeAccount();
    await account.install(page);
    await seed(page, { [COPIES_KEY]: envelope([copy(IDS.a)]), 'travel.trip-edit.device': JSON.stringify(edits) });
    await page.goto(`${on.url}/mine/`);
    await expect(page.locator('.toast-region')).toContainText('1 trip added to your account');
    // the whole document was sent at the insert revision
    await expect.poll(() => account.rows.get(IDS.a)?.revision).toBe(1);
    const t = account.rows.get(IDS.a)!.doc!.template;
    expect(t.notes).toEqual({ '3': NOTE });
    expect(t.removed).toEqual([{ day: 2, item: 'tre-cime-loop', op: 'o-rm' }]);
    expect((t.maybe as { ref: string }[]).map((m) => m.ref)).toEqual(['place/lago-di-braies']);
    // the copy and its edits left the device; the account cache holds the document until sign-out
    expect(await device(page)).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('travel.trip-edit.device'))).toBeNull();
    // a reload reads the account and sends nothing more
    const puts = account.calls.filter((c) => c.startsWith('PUT')).length;
    await page.reload();
    await expect(page.locator('.crow')).toHaveCount(1);
    expect(account.calls.filter((c) => c.startsWith('PUT')).length).toBe(puts);
  });

  test('no horizontal overflow at 320 with the account out of reach', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const account = new FakeAccount();
    account.mode = 503;
    await open(page, account, [copy(IDS.a)]);
    await expect(page.locator('.mine-card')).toContainText('can’t reach your account');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });
});

// keep planDoc referenced so a rename shows up here
void planDoc;
