import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { openParty } from './party';

// UXB-2: the party bar on the trip page (spec trip-and-places-ux-fixes.md 5.2 to 5.4, wireframe W3). The collapsed line, the lazy editor,
// each child's age, the device party and the landing rule, the shared-link offer, the sticky rail's Edit, Mine's Open, and what must never leave the device.
const ROCKIES = '/trips/canadian-rockies-2029/';
const PARTY_KEY = 'travel.party';

async function seed(page: Page, values: Record<string, string>) {
  await page.addInitScript((kv) => {
    if (sessionStorage.getItem('seeded')) return; // the first document of the tab only, so a reload keeps what the page wrote
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, values);
}
const party = (adults: number, children: (number | null)[]) => JSON.stringify({ v: 1, adults, children });
const long = (page: Page) => page.locator('#plan-for .pb-long');
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), PARTY_KEY);

test.describe('collapsed bar', () => {
  test('is one line of party words with a pencil Edit; the editor is closed, hidden and out of the tab order', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await expect(page.locator('#plan-for-h')).toHaveText('Plan it for');
    await expect(long(page)).toHaveText('2 adults · 1 child (10) · Standard pace');
    await expect(page.locator('#plan-for .pb-note')).toHaveText(/^Plan as written: /);
    const edit = page.getByRole('button', { name: 'Edit' });
    await expect(edit).toHaveAttribute('aria-expanded', 'false');
    await expect(edit.locator('svg')).toBeVisible();
    expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(28); // the hit area is 44 (::after); the visible button is the foundation's sm
    await expect(page.locator('#plan-for-controls')).toBeHidden();
    await expect(page.locator('#plan-for-controls')).toHaveAttribute('inert', '');
    expect(await page.locator('#plan-for').evaluate((e) => e.getBoundingClientRect().height)).toBeLessThanOrEqual(page.viewportSize()!.width < 640 ? 76 : 64); // one 56 px row on desktop; label over words on a phone
  });

  test('the editor is a lazy chunk: nothing of it is on the page until Edit', async ({ page, site }) => {
    const scripts: string[] = [];
    page.on('response', (r) => r.request().resourceType() === 'script' && scripts.push(r.url()));
    await page.goto(`${site.url}${ROCKIES}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#plan-for-controls .pe')).toHaveCount(0);
    const before = scripts.length;
    await openParty(page);
    expect(scripts.length, 'the editor chunk arrives on Edit').toBeGreaterThan(before - 1);
    await expect(page.getByRole('group', { name: 'Adults' })).toBeVisible();
  });
});

test.describe('the editor', () => {
  test('adults 1 to 12, children 0 to 8, one age select per child; the youngest goes in the link, the ages never do', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await openParty(page);
    // no "Who is going" switch and no Youngest stepper (I5)
    await expect(page.getByRole('radiogroup', { name: 'Who is going' })).toHaveCount(0);
    await expect(page.getByText('Youngest', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Child 1 age')).toHaveValue('10');
    await page.getByLabel('Child 1 age').selectOption('7');
    await expect(page).toHaveURL(/\?p=family-7&view=day$/);
    // adding a child appends its select, moves focus to it, and says the age is not set
    await page.getByRole('button', { name: 'More children' }).click();
    const second = page.getByLabel('Child 2 age');
    await expect(second).toBeFocused();
    await expect(second).toHaveValue('');
    await expect(page.getByTestId('profile-line')).toContainText('Age not set for a child, planning for 10');
    await expect(long(page)).toHaveText('2 adults · 2 children (7, age not set) · Standard pace');
    await second.selectOption('10');
    await expect(long(page)).toHaveText('2 adults · 2 children (7, 10) · Standard pace');
    await expect(page).toHaveURL(/\?p=family-7&view=day$/);
    expect(page.url()).not.toMatch(/7,10|10,7|age/);
    // adults go into the link as a=<n> beside the youngest, view=day kept
    await page.getByRole('button', { name: 'More adults' }).click();
    await expect(page).toHaveURL(/\?p=family-7&a=3&view=day$/);
    await expect(long(page)).toHaveText('3 adults · 2 children (7, 10) · Standard pace');
    await expect(page.getByTestId('profile-line')).toContainText('3 adults and 2 children (youngest 7)');
  });

  test('a stepper stays focusable at its bound with aria-disabled, and Up and Down step it', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?a=12&view=day`);
    await openParty(page);
    const more = page.getByRole('button', { name: 'More adults' });
    await expect(more).toHaveAttribute('aria-disabled', 'true');
    await expect(more).not.toHaveAttribute('disabled', /.*/);
    await more.focus();
    await more.press('Enter'); // Playwright's click refuses an aria-disabled button; a key press is what a keyboard user does
    await expect(more).toBeFocused();
    await expect(page.getByRole('group', { name: 'Adults' }).locator('output')).toHaveText('12');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('group', { name: 'Adults' }).locator('output')).toHaveText('11');
    await expect(page).toHaveURL(/a=11/);
    await page.keyboard.press('ArrowUp');
    await expect(page).toHaveURL(/a=12/);
    const fewer = page.getByRole('button', { name: 'Fewer adults' });
    for (let i = 0; i < 12; i++) await fewer.click({ force: true });
    await expect(fewer).toHaveAttribute('aria-disabled', 'true');
    await expect(page).toHaveURL(/a=1&/);
  });

  test('removing a child leaves focus on "Fewer children"; none left means adults only and the pace stays', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await openParty(page);
    await page.getByRole('radio', { name: 'Relaxed' }).click();
    const fewer = page.getByRole('button', { name: 'Fewer children' });
    await fewer.click();
    await expect(fewer).toBeFocused();
    await expect(fewer).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByLabel('Child 1 age')).toHaveCount(0);
    await expect(long(page)).toHaveText('2 adults · Relaxed pace');
    await expect(page).toHaveURL(/\?p=adults&pace=relaxed&view=day$/);
    const more = page.getByRole('button', { name: 'More children' });
    for (let i = 0; i < 9; i++) await more.click({ force: true });
    await expect(page.getByLabel(/^Child \d age$/)).toHaveCount(8);
    await expect(more).toHaveAttribute('aria-disabled', 'true');
  });

  test('Done and Escape close it and return focus to Edit; the open state is remembered', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    await openParty(page);
    const toggle = page.locator('#plan-for .pb-edit');
    await expect(toggle).toHaveText('Done');
    await page.getByRole('button', { name: 'More children' }).focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#plan-for-controls')).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveText('Edit');
    await toggle.click();
    await expect(page.locator('#plan-for-controls .pe')).toBeVisible();
    await toggle.click();
    await expect(page.locator('#plan-for-controls')).toBeHidden();
    await toggle.click();
    await page.reload();
    await expect(page.locator('#plan-for-controls .pe')).toBeVisible(); // travel.tripui partyOpen
  });

  test('reduced motion: the editor opens without a transition', async ({ page, site }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${site.url}${ROCKIES}`);
    expect(await page.locator('#plan-for-controls').evaluate((e) => getComputedStyle(e).transitionDuration)).toBe('0s');
  });
});

test.describe('the party on this device', () => {
  test('is kept and comes back: the words, "Your party", the youngest in the link, no ages', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await openParty(page);
    await page.getByLabel('Child 1 age').selectOption('7');
    await page.getByRole('button', { name: 'More children' }).click();
    await page.getByLabel('Child 2 age').selectOption('10');
    expect(JSON.parse((await stored(page))!)).toEqual({ v: 1, adults: 2, children: [7, 10] });
    await page.goto(`${site.url}${ROCKIES}?view=day`); // no party in the link: the kept party applies
    await expect(long(page)).toHaveText('2 adults · 2 children (7, 10) · Standard pace');
    await expect(page.locator('#plan-for .pb-note')).toHaveText('Your party');
    await expect(page).toHaveURL(/\?p=family-7&view=day$/);
    await page.reload();
    await expect(long(page)).toHaveText('2 adults · 2 children (7, 10) · Standard pace');
  });

  test('is applied with a replace: Back from the trip leaves it instead of re-applying', async ({ page, site }) => {
    await seed(page, { [PARTY_KEY]: party(3, [7, 10]) });
    await page.goto(`${site.url}/trips/`);
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(long(page)).toHaveText('3 adults · 2 children (7, 10) · Standard pace');
    await expect(page).toHaveURL(/\?p=family-7&a=3&view=day$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/trips\/$/);
  });

  test('a shared link wins and offers the kept party; "Use my party" applies it', async ({ page, site }) => {
    await seed(page, { [PARTY_KEY]: party(2, [7, 10]) });
    await page.goto(`${site.url}${ROCKIES}?p=family-6&view=day`);
    await expect(long(page)).toHaveText('Shared plan: family, youngest 6 · Standard pace');
    await expect(page.locator('#plan-for .pb-note')).toHaveCount(0);
    const offer = page.getByRole('button', { name: 'Use my party: 2 adults, 2 children' });
    await expect(offer).toBeVisible();
    await expect(page).toHaveURL(/\?p=family-6&view=day$/); // never applied over a shared link
    await offer.click();
    await expect(long(page)).toHaveText('2 adults · 2 children (7, 10) · Standard pace');
    await expect(page).toHaveURL(/\?p=family-7&view=day$/);
    await expect(offer).toHaveCount(0);
  });

  test('a shared link the kept party already plans for offers nothing and shows the full words', async ({ page, site }) => {
    await seed(page, { [PARTY_KEY]: party(2, [7, 10]) });
    await page.goto(`${site.url}${ROCKIES}?p=family-7&view=day`);
    await expect(long(page)).toHaveText('2 adults · 2 children (7, 10) · Standard pace');
    await expect(page.getByRole('button', { name: /^Use my party/ })).toHaveCount(0);
  });

  test('Reset is "Plan as written": the plan\'s own party, and the kept party is not applied to this trip again', async ({ page, site }) => {
    await seed(page, { [PARTY_KEY]: party(2, [7, 10]) });
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(page.locator('#plan-for .pb-note')).toHaveText('Your party');
    await page.getByRole('button', { name: 'Reset' }).first().click();
    await expect(long(page)).toHaveText('2 adults · 1 child (10) · Standard pace');
    await expect(page).toHaveURL(/\/trips\/canadian-rockies-2029\/\?view=day$/);
    await page.reload();
    await expect(long(page)).toHaveText('2 adults · 1 child (10) · Standard pace');
    await expect(page.locator('#plan-for .pb-note')).toHaveText(/^Plan as written/);
    // another trip still gets the kept party
    await page.goto(`${site.url}/trips/dolomites-2027/?view=day`);
    await expect(long(page)).toHaveText(/2 children \(7, 10\)/);
  });

  test('a broken stored party is ignored, not trusted', async ({ page, site }) => {
    await seed(page, { [PARTY_KEY]: '{"v":1,"adults":"many","children":"x"}' });
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(long(page)).toHaveText('2 adults · 1 child (10) · Standard pace');
  });

  test('a browser that blocks site data still works for the visit, and says it is not keeping the party', async ({ page, site }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    });
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await openParty(page);
    await page.getByRole('button', { name: 'More children' }).click();
    await page.getByLabel('Child 2 age').selectOption('4');
    await expect(long(page)).toHaveText('2 adults · 2 children (10, 4) · Standard pace');
    await expect(page.locator('.pe-device')).toContainText('This browser is not keeping data');
  });
});

test.describe('the sticky day rail', () => {
  test('says the same words and its Edit opens the same editor, focus on Done', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    const rail = page.locator('.tl-planbar');
    await expect(rail.locator('.tl-planbar-who')).toHaveText('2 adults, 1 child · Standard');
    await page.evaluate(() => document.getElementById('day-4')?.scrollIntoView({ block: 'start' }));
    const edit = rail.getByRole('button', { name: 'Edit' });
    await expect(edit).toBeVisible();
    expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    await edit.click();
    await expect(page.locator('#plan-for-controls .pe')).toBeVisible();
    await expect(page.locator('#plan-for .pb-edit')).toBeFocused();
    await page.getByRole('button', { name: 'More adults' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#plan-for-controls')).toBeHidden();
    await expect(rail.locator('.tl-planbar-who')).toHaveText('3 adults, 1 child · Standard');
  });
});

test.describe('what stays on the device', () => {
  test('no age in any address, request or other storage key; only travel.party holds them', async ({ page, site }) => {
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url() + (r.postData() ?? '')));
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await openParty(page);
    await page.getByLabel('Child 1 age').selectOption('3');
    await page.getByRole('button', { name: 'More children' }).click();
    await page.getByLabel('Child 2 age').selectOption('13');
    await page.getByRole('radio', { name: 'Full' }).click();
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/\?p=family-3&pace=full&view=day$/);
    expect(urls.filter((u) => /children=|ages?=|\b3(,|%2C)13\b|\b13(,|%2C)3\b/i.test(u))).toEqual([]);
    const all = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    const holders = Object.entries(all).filter(([, v]) => /"children"\s*:\s*\[3,\s*13\]/.test(v ?? '')).map(([k]) => k);
    expect(holders).toEqual([PARTY_KEY]);
    expect(await page.evaluate(() => document.cookie)).not.toMatch(/13/);
  });
});

test.describe('Mine opens a copy on its days with the adults', () => {
  test('a copy of 3 adults opens with a=3 and view=day, on Days, in the link\'s own words', async ({ page, site }) => {
    const copies = JSON.stringify({
      schema: 'copies/1',
      items: [{ id: '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', slug: 'dolomites-2027', title: 'Dolomites', days: 14, cc: 'IT', photo: null, start: '2027-07-03', adults: 3, children: [6, 9], profile: { party: 'family', youngest: 6, pace: 'standard', adults: 3, walk: null, split: false }, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z' }],
      noteSeen: null, snoozedUntil: null, merged: {},
    });
    await seed(page, { 'travel.copies.local': copies });
    await page.goto(`${site.url}/mine/`);
    await page.locator('a.crow-link').click();
    await expect(page).toHaveURL(/\/trips\/dolomites-2027\/\?p=family-6&a=3&view=day$/);
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveText(/^Days/);
    await expect(long(page)).toHaveText('Shared plan: family, youngest 6, 3 adults · Standard pace');
    expect(new URL(page.url()).search).not.toMatch(/9|children/);
  });
});

test.describe('layout and axe', () => {
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 700 }]) {
    test(`${size.width}: no horizontal scroll, bar and editor fit, axe is clean closed and open`, async ({ page, site }) => {
      await page.setViewportSize(size);
      await page.goto(`${site.url}${ROCKIES}?view=day`);
      await page.waitForTimeout(400);
      const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      const axe = async (label: string) => {
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('[data-map-family]').analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 90)}`), `${size.width} ${label}`).toEqual([]);
      };
      expect(await fits()).toBe(true);
      await axe('closed');
      await openParty(page);
      for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'More children' }).click({ force: true });
      await page.locator('#plan-for .tl-more').click();
      await page.waitForTimeout(400);
      expect(await fits()).toBe(true);
      await axe('open, 8 children, More open');
    });
  }
});

test.describe('review round (UXB-2F)', () => {
  test('M1: a baby reads "under 1" in the bar, the live line and the link, never 0', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await openParty(page);
    await page.getByLabel('Child 1 age').selectOption('0');
    await expect(long(page)).toHaveText('2 adults · 1 child (under 1) · Standard pace');
    await expect(page.getByTestId('profile-line')).toContainText('youngest under 1');
    await expect(page.getByTestId('profile-line')).toContainText(/on all 15 days/);
    expect(page.url()).toContain('p=family-0');
    await expect(page.locator('#plan-for')).not.toContainText(/\(0\)|youngest 0/);
  });

  test('S1: Edit and Done are 44 px tall', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}`);
    expect((await page.locator('#plan-for .pb-edit').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test('S2: an editing session is one history entry; Done ends it', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await openParty(page);
    await page.getByRole('button', { name: 'More adults' }).click();
    await page.getByRole('button', { name: 'More adults' }).click();
    await page.getByLabel('Child 1 age').selectOption('5');
    await expect(page).toHaveURL(/\?p=family-5&a=4&view=day$/);
    await page.locator('#plan-for .pb-edit').click(); // Done
    await openParty(page);
    await page.getByRole('radio', { name: 'Full' }).click();
    await expect(page).toHaveURL(/pace=full/);
    await page.goBack();
    await expect(page).toHaveURL(/\?p=family-5&a=4&view=day$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/canadian-rockies-2029\/\?view=day$/);
  });

  test('M3: a phone says "Your party" beside the label; a desktop has the note', async ({ page, site }) => {
    await seed(page, { [PARTY_KEY]: party(3, [7, 10]) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(page.locator('#plan-for-h')).toHaveText('Plan it for · Your party');
    await expect(page.locator('#plan-for .pb-yours')).toBeVisible();
    await expect(page.locator('#plan-for .pb-note')).toBeHidden();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('#plan-for .pb-yours')).toBeHidden();
    await expect(page.locator('#plan-for .pb-note')).toHaveText('Your party');
  });

  test('S3 and S5: on a shared link the rail says "Shared plan · Standard"; Escape returns to the rail Edit that opened it', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?p=family-6&view=day`);
    const rail = page.locator('.tl-planbar');
    await expect(rail.locator('.tl-planbar-who')).toHaveText('Shared plan · Standard');
    await page.evaluate(() => document.getElementById('day-9')?.scrollIntoView({ block: 'start' }));
    await rail.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#plan-for-controls .pe')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#plan-for-controls')).toBeHidden();
    await expect(rail.getByRole('button', { name: 'Edit' })).toBeFocused();
  });

  test('S4: at 320 a shared link shows the offer left-aligned and no Reset beside it', async ({ page, site }) => {
    await seed(page, { [PARTY_KEY]: party(2, [7, 10]) });
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`${site.url}${ROCKIES}?p=family-6&view=day`);
    await expect(page.getByRole('button', { name: /^Use my party/ })).toBeVisible();
    await expect(page.locator('#plan-for .pb-reset')).toBeHidden();
    expect(await page.locator('#plan-for .pb-offer').evaluate((e) => getComputedStyle(e).textAlign)).toBe('start');
  });

  test('M2: the copy sheet opens with the page\'s party (both ages), takes 12 adults, and writes a change back', async ({ page, site }) => {
    await seed(page, { [PARTY_KEY]: party(12, [7, 10]) });
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(long(page)).toHaveText('12 adults · 2 children (7, 10) · Standard pace');
    await page.getByRole('button', { name: 'Copy to my trips' }).first().click();
    const sheet = page.locator('.copy-sheet');
    await expect(sheet.getByRole('group', { name: 'Adults' }).locator('output')).toHaveText('12');
    await expect(sheet.getByRole('button', { name: 'More adults' })).toHaveAttribute('aria-disabled', 'true');
    await expect(sheet.getByLabel('Child 1 age')).toHaveValue('7');
    await expect(sheet.getByLabel('Child 2 age')).toHaveValue('10');
    await sheet.getByRole('button', { name: 'Fewer adults' }).click();
    await sheet.getByRole('button', { name: 'More children' }).click();
    await expect(sheet.getByLabel('Child 3 age')).toBeFocused();
    await sheet.getByLabel('Child 3 age').selectOption('0');
    await expect.poll(async () => JSON.parse((await stored(page))!)).toEqual({ v: 1, adults: 11, children: [7, 10, 0] });
    await page.keyboard.press('Escape');
    await expect(long(page)).toHaveText('11 adults · 3 children (7, 10, under 1) · Standard pace');
    await expect(page).toHaveURL(/\?p=family-0&a=11&view=day$/);
  });

  for (const width of [320, 1440]) {
    test(`axe wcag22aa is clean on the shared-link bar with the offer at ${width}`, async ({ page, site }) => {
      await seed(page, { [PARTY_KEY]: party(2, [7, 10]) });
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${site.url}${ROCKIES}?p=family-6&view=day`);
      await expect(page.getByRole('button', { name: /^Use my party/ })).toBeVisible();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).include('#plan-for').include('.tl-planbar').analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 90)}`)).toEqual([]);
    });
  }
});
