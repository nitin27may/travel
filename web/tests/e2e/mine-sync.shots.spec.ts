import { mkdirSync } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { expect, ROOT, startNext, test } from './fixtures';
import type { Server } from './fixtures';
import { FakeAccount, IDS } from './account-fake';
import { setTheme, THEMES } from './shots';

// EM-2 verification shots: every chip state of signed-in Mine (edit-my-trip 4.7) at 320, 390 and 1440, light and dark, 2x, written to
// <worktree>/../shots-EM2. Not committed (a spec names a screenshot to commit; none does). Needs the .next-acct build.

const DIST = '.next-acct';
const built = existsSync(path.join(ROOT, 'web', DIST, 'BUILD_ID'));
const OUT = path.resolve(ROOT, '..', 'shots-EM2');
const WIDTHS = [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 1440, height: 900 }];

const copy = (id: string, o: Record<string, unknown> = {}) => ({
  id, slug: 'dolomites-2027', title: 'Dolomites', days: 14, cc: 'IT', photo: null, start: '2027-07-03', adults: 2, children: [6],
  profile: { party: 'family', youngest: 6, pace: 'standard', adults: 2, walk: null, split: false }, overrides: { '5': 'C' }, added: [],
  copiedAt: '2026-10-20T10:00:00.000Z', ...o,
});

async function changeDates(page: Page, to: string) {
  await page.getByRole('button', { name: 'Actions for Dolomites' }).click();
  await page.getByRole('menuitem', { name: 'Change dates' }).click();
  const sheet = page.locator('.copy-sheet');
  await sheet.locator(`.cal-cell[data-date="${to}"]:not([disabled])`).click();
  await sheet.getByRole('button', { name: 'Change dates' }).click();
}

type Scenario = { name: string; run: (page: Page, account: FakeAccount) => Promise<void>; wait: (page: Page) => Promise<void>; seedCopies?: boolean };

const SCENARIOS: Scenario[] = [
  {
    name: 'quiet',
    run: async () => undefined,
    wait: async (page) => {
      await expect(page.locator('.crow')).toHaveCount(2);
      await expect(page.locator('.mine-card')).toContainText('Your trips are kept in your account.');
    },
  },
  {
    name: 'syncing',
    run: async (page, account) => {
      account.delayMs = 15_000;
      await changeDates(page, '2027-07-10');
    },
    wait: async (page) => {
      await expect(page.locator('.crow-chip')).toHaveText('Syncing', { timeout: 8000 });
    },
  },
  {
    name: 'not-synced-yet',
    run: async (page, account) => {
      account.mode = 'net';
      await changeDates(page, '2027-07-10');
    },
    wait: async (page) => {
      await expect(page.locator('.crow-chip')).toHaveText('Not synced yet');
    },
  },
  {
    name: 'retry',
    run: async (page, account) => {
      account.bump = true;
      await changeDates(page, '2027-07-10');
    },
    wait: async (page) => {
      await expect(page.locator('.crow-retry')).toContainText('Not synced · Retry');
    },
  },
  {
    name: 'on-this-device',
    seedCopies: true,
    run: async () => undefined,
    wait: async (page) => {
      await expect(page.locator('.crow-chip').first()).toHaveText('On this device');
      await expect(page.locator('.mine-card')).toContainText('can’t reach your account');
    },
  },
];

test.describe('signed-in Mine chip states (shots)', () => {
  test.skip(!built, `needs web/${DIST}`);
  test.setTimeout(240_000);
  let on: Server;
  test.beforeAll(async () => {
    on = await startNext(DIST);
    mkdirSync(OUT, { recursive: true });
  });
  test.afterAll(() => on?.stop());

  async function shoot(browser: Browser, s: Scenario, size: { width: number; height: number }, theme: 'light' | 'dark') {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'en-CA', hasTouch: size.width < 640 });
    const page = await context.newPage();
    const account = new FakeAccount();
    account.add(IDS.a, 'Dolomites');
    account.add(IDS.b, 'Algonquin', { trip: 'algonquin-muskoka-2026', start: '2027-09-01', children: [], days: 7 });
    if (s.seedCopies) {
      account.mode = 503;
      account.rows.clear();
      await page.addInitScript((kv) => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('travel.copies.local', JSON.stringify({ schema: 'copies/1', items: kv, noteSeen: null, snoozedUntil: null, merged: {} }));
      }, [copy(IDS.a), copy(IDS.c, { slug: 'algonquin-muskoka-2026', title: 'Algonquin', start: '2027-09-01', children: [], profile: null, days: 7 })]);
    }
    await setTheme(page, theme);
    await account.install(page);
    await page.goto(`${on.url}/mine/`);
    await expect(page.locator('.crow').first()).toBeVisible();
    await s.run(page, account);
    await s.wait(page);
    await page.waitForTimeout(400); // the toast and the row settle
    await page.screenshot({ path: path.join(OUT, `${s.name}-${size.width}-${theme}.png`) });
    await context.close();
  }

  for (const s of SCENARIOS) {
    test(`${s.name}`, async ({ browser }) => {
      for (const theme of THEMES) for (const size of WIDTHS) await shoot(browser, s, size, theme);
    });
  }
});
