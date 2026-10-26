import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, ROOT, startNext, test } from './fixtures';
import type { Server } from './fixtures';
import { setTheme, THEMES } from './shots';

// NAV-1: the bottom bar's Mine item, the phone header's account link, the desktop Mine button and the /mine/ shell
// (docs/v2/design/shell/mine-and-bar-spec.md 2 to 5, 12). The public build runs the bar, Mine and the desktop button; the sign-in-on
// build (web/.next-signin, built with NEXT_PUBLIC_SIGN_IN=1; the header tests skip without it) runs the phone header link.

const PHONE = { width: 390, height: 844 };
const SMALL = { width: 320, height: 640 };
const COPIES_KEY = 'travel.copies.local';
const FAV_KEY = 'travel.fav.local';
const SEEN_KEY = 'travel.mine.seen';

const copies = (at = '2026-10-20T10:00:00.000Z') =>
  JSON.stringify({
    schema: 'copies/1',
    items: [{ id: '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', slug: 'dolomites-2027', title: 'Dolomites', days: 14, cc: 'IT', photo: null, start: '2027-07-03', adults: 2, children: [], profile: null, overrides: {}, added: [], copiedAt: at }],
    noteSeen: null,
    snoozedUntil: null,
    merged: {},
  });
const favourites = (at = '2026-10-22T10:00:00.000Z') =>
  JSON.stringify({
    schema: 'favourites/1',
    items: [{ space: 'place', slug: 'lago-di-braies', ref: null, name: 'Lago di Braies', kind: 'lake', cc: 'IT', favouredAt: at, unlistedAt: null }],
    noteSeen: null,
    snoozedUntil: null,
    snoozedAtCount: null,
    merged: {},
    pending: [],
  });

async function seed(page: Page, values: Record<string, string>) {
  await page.addInitScript((kv) => {
    // only on the first document of the context, so a reload keeps what the page itself wrote
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, values);
}

test.describe('bottom bar: Mine', () => {
  test.use({ viewport: SMALL });

  test('five items, each at least 56 px wide at 320, Mine last and constant', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/`, { waitUntil: 'networkidle' });
    const bar = page.getByRole('navigation', { name: 'Main, bottom' });
    const items = bar.locator('a, button');
    await expect(items).toHaveCount(5);
    await expect(items.last()).toHaveText('Mine');
    for (const i of await items.all()) {
      const b = (await i.boundingBox())!;
      expect(b.width, await i.innerText()).toBeGreaterThanOrEqual(56);
      expect(b.height).toBeGreaterThanOrEqual(56);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });

  const CURRENT: [string, string | null][] = [
    ['/mine/', 'page'],
    // sign-in is off in this build, so the account routes are placeholders and Mine is not lit there (NAV-R1 P3); the sign-in build is tested below
    ['/account/', null],
    ['/sign-in/', null],
    ['/sign-up/', null],
    ['/trips/', null],
    ['/places/', null],
  ];
  for (const [url, current] of CURRENT) {
    test(`Mine is ${current ? `aria-current="${current}"` : 'not current'} on ${url}`, async ({ page, site }) => {
      await page.goto(`${site.url}${url}`);
      const mine = page.getByRole('navigation', { name: 'Main, bottom' }).getByRole('link', { name: 'Mine' });
      if (current) await expect(mine).toHaveAttribute('aria-current', current);
      else await expect(mine).not.toHaveAttribute('aria-current', /.*/);
      // no other item is marked on these pages, except the section's own tab
      const marked = await page.locator('.bottom-bar [aria-current]').count();
      expect(marked).toBe(current ? 1 : url === '/trips/' || url === '/places/' ? 1 : 0);
    });
  }

  test('Mine is a keyboard stop after Search, in visual order', async ({ page, site, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari tabs to form controls only unless Option is held');
    await page.goto(`${site.url}/mine/`);
    await page.getByRole('navigation', { name: 'Main, bottom' }).getByRole('link', { name: 'Trips' }).focus();
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      seen.push(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? ''));
    }
    expect(seen).toEqual(['Places', 'Globe', 'Search', 'Mine']);
  });

  test('the dot: appears for a new copy, reads "Mine, new items", clears when Mine opens, and clears in a second tab', async ({ page, context, site }) => {
    await seed(page, { [COPIES_KEY]: copies() });
    await page.goto(`${site.url}/trips/`, { waitUntil: 'networkidle' });
    const mine = page.getByRole('navigation', { name: 'Main, bottom' }).getByRole('link', { name: /^Mine/ });
    await expect(mine).toHaveAttribute('data-dot', 'true');
    await expect(mine).toHaveAccessibleName('Mine, new items');
    expect(await mine.evaluate((el) => getComputedStyle(el, '::after').width)).toBe('7px');
    expect(await mine.innerText()).toBe('Mine'); // no number

    const other = await context.newPage();
    await other.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    await expect(other.locator('.bottom-bar a[href="/mine/"]')).toHaveAttribute('data-dot', 'true');

    await mine.click();
    await expect(page).toHaveURL(/\/mine\/$/);
    await expect(page.locator('.bottom-bar a[href="/mine/"]')).not.toHaveAttribute('data-dot', /.*/);
    await expect(page.locator('.bottom-bar a[href="/mine/"]')).toHaveAccessibleName('Mine');
    await expect(other.locator('.bottom-bar a[href="/mine/"]')).not.toHaveAttribute('data-dot', /.*/); // storage event
    expect(await page.evaluate((k) => localStorage.getItem(k), SEEN_KEY)).not.toBeNull();
  });

  test('no dot with nothing kept', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/`, { waitUntil: 'networkidle' });
    await expect(page.locator('.bottom-bar a[href="/mine/"]')).not.toHaveAttribute('data-dot', /.*/);
  });
});

test.describe('forced colours (NAV-R1 M3)', () => {
  test.use({ viewport: PHONE, forcedColors: 'active' });
  test('the bar icons are painted: a mask needs a non-transparent background', async ({ page, site, browserName }) => {
    test.skip(browserName !== 'chromium', 'forced-colors emulation is Chromium only');
    await page.goto(`${site.url}/mine/`, { waitUntil: 'networkidle' });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const icons = page.locator('.bottom-bar .mi');
    await expect(icons).toHaveCount(5);
    for (const i of await icons.all()) {
      const bg = await i.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');
      expect(bg).not.toBe('transparent');
      expect((await i.boundingBox())!.width).toBeGreaterThan(0);
    }
  });
});

test.describe('/mine/ shell', () => {
  test.use({ viewport: PHONE });

  test('signed out and empty: card, tabs with counts of 0, the empty state and no notice', async ({ page, site }) => {
    await page.goto(`${site.url}/mine/`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1, name: 'Mine' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Your account' })).toContainText('Kept in this browser only.');
    // sign-in is off in this build: the card is the sentence alone
    await expect(page.getByRole('region', { name: 'Your account' }).getByRole('link')).toHaveCount(0);
    const tablist = page.getByRole('tablist', { name: 'Mine' });
    await expect(tablist.getByRole('tab', { name: 'My trips, 0' })).toHaveAttribute('aria-selected', 'true');
    await expect(tablist.getByRole('tab', { name: 'Favourites, 0' })).toBeVisible();
    const tab = (await tablist.getByRole('tab').first().boundingBox())!;
    expect(tab.height).toBe(44);
    const box = (await tablist.boundingBox())!;
    expect(box.width).toBeGreaterThan(340); // full width on a phone
    await expect(page.getByRole('tabpanel', { name: 'My trips' })).toContainText('No trips copied yet');
    await expect(page.getByRole('tabpanel', { name: 'My trips' }).getByRole('link', { name: 'Browse trips' })).toHaveAttribute('href', '/trips/');
    await expect(page.getByText('kept in this browser only. Clearing')).toHaveCount(0);
  });

  test('arrow keys switch tabs and ?show= follows; Home and End jump; the empty Favourites state', async ({ page, site }) => {
    await page.goto(`${site.url}/mine/`, { waitUntil: 'networkidle' });
    const trips = page.getByRole('tab', { name: /^My trips/ });
    const favs = page.getByRole('tab', { name: /^Favourites/ });
    await trips.focus();
    await page.keyboard.press('ArrowRight');
    await expect(favs).toBeFocused();
    await expect(favs).toHaveAttribute('aria-selected', 'true');
    expect(new URL(page.url()).searchParams.get('show')).toBe('favourites');
    const panel = page.getByRole('tabpanel', { name: 'Favourites' });
    await expect(panel).toContainText('No favourites yet');
    await expect(panel.getByRole('link', { name: 'Browse places' })).toHaveAttribute('href', '/places/');
    await expect(panel.getByRole('link', { name: 'Browse trips' })).toHaveAttribute('href', '/trips/');
    await page.keyboard.press('Home');
    await expect(trips).toHaveAttribute('aria-selected', 'true');
    expect(new URL(page.url()).searchParams.get('show')).toBe('trips');
    await page.keyboard.press('End');
    await expect(favs).toHaveAttribute('aria-selected', 'true');
    // only the selected tab is a tab stop
    await expect(trips).toHaveAttribute('tabindex', '-1');
  });

  test('?show=favourites opens that tab, and /favourites/ redirects to it', async ({ page, site }) => {
    await page.goto(`${site.url}/favourites/`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/mine\/\?show=favourites$/);
    await expect(page.getByRole('tab', { name: /^Favourites/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('counts come from the two lists, the default tab is the one with the newest item, and the notice is dismissible', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: copies('2026-10-20T10:00:00.000Z'), [FAV_KEY]: favourites('2026-10-22T10:00:00.000Z') });
    await page.goto(`${site.url}/mine/`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: 'My trips, 1' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Favourites, 1' })).toHaveAttribute('aria-selected', 'true'); // the heart is newer
    await expect(page.getByRole('tabpanel', { name: 'Favourites' })).toContainText('Lago di Braies');
    const notice = page.getByRole('status').filter({ hasText: 'kept in this browser only. Clearing browser data' });
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: 'Got it' }).click();
    await expect(notice).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /^Favourites/ })).toBeFocused();
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: /^Favourites/ })).toBeVisible();
    await expect(page.getByText('Clearing browser data, using a private window')).toHaveCount(0); // snoozed for 30 days
  });

  test('a copy newer than the heart opens My trips; ?show= overrides', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: copies('2026-10-25T10:00:00.000Z'), [FAV_KEY]: favourites('2026-10-22T10:00:00.000Z') });
    await page.goto(`${site.url}/mine/`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: /^My trips/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'My trips' })).toContainText('Dolomites');
    await page.goto(`${site.url}/mine/?show=favourites`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: /^Favourites/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('an envelope this version cannot read is reported and left untouched', async ({ page, site }) => {
    const bad = '{"schema":"copies/2","items":[]}';
    await seed(page, { [COPIES_KEY]: bad });
    await page.goto(`${site.url}/mine/`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: /^My trips$/ })).toBeVisible(); // no count rather than a wrong one
    await expect(page.getByRole('tabpanel', { name: 'My trips' })).toContainText('This list was written by a newer version of the site');
    expect(await page.evaluate((k) => localStorage.getItem(k), COPIES_KEY)).toBe(bad);
  });

  test('storage blocked: the page says so and still works', async ({ page, site }) => {
    // the probe's write fails (a private mode, a full store); the rest of the site tolerates that
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k === 'travel.probe') throw new DOMException('blocked', 'SecurityError');
        return set.call(this, k, v);
      };
    });
    await page.goto(`${site.url}/mine/`, { waitUntil: 'networkidle' });
    // one message, as a components 5.4 notice above the tabs; the panel keeps its own empty state, and only one role=status is on the page (S5, P4)
    const notice = page.getByRole('status').filter({ hasText: 'This browser is not keeping data' });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Copies and favourites last until you close this tab.');
    await expect(notice).toHaveClass(/ban-notice/);
    const nb = (await notice.boundingBox())!;
    const tb = (await page.getByRole('tablist', { name: 'Mine' }).boundingBox())!;
    expect(nb.y + nb.height).toBeLessThanOrEqual(tb.y);
    await expect(page.getByRole('tabpanel', { name: 'My trips' })).toContainText('No trips copied yet');
    await expect(page.getByRole('status')).toHaveCount(1);
    expect(await page.locator('.empty[role="status"]').count()).toBe(0);
  });

  test('a list written by a newer version offers Reload; a damaged one has no action (S4)', async ({ page, site }) => {
    const newer = '{"schema":"copies/2","items":[]}';
    await seed(page, { [COPIES_KEY]: newer, [FAV_KEY]: '{not json' });
    await page.goto(`${site.url}/mine/`, { waitUntil: 'networkidle' });
    const trips = page.getByRole('tabpanel', { name: 'My trips' });
    await expect(trips).toContainText('This list was written by a newer version of the site');
    await expect(trips).toContainText('Reload the page to see it. Nothing has been changed.');
    await expect(trips.getByRole('button', { name: 'Reload' })).toBeVisible();
    await page.getByRole('tab', { name: /^Favourites/ }).click();
    const favs = page.getByRole('tabpanel', { name: 'Favourites' });
    await expect(favs).toContainText("We couldn't read your favourites");
    await expect(favs).toContainText('The list in this browser is damaged. It has been left exactly as it is.');
    await expect(favs.getByRole('button')).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), COPIES_KEY)).toBe(newer); // never written
    expect(await page.locator('.empty[role="status"]').count()).toBe(0);
  });

  test('the interim rows read "Sat 3 Jul 2027" and "Lake · Italy" (S3)', async ({ page, site }) => {
    await seed(page, { [COPIES_KEY]: copies(), [FAV_KEY]: favourites() });
    await page.goto(`${site.url}/mine/?show=trips`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('tabpanel', { name: 'My trips' })).toContainText('Sat 3 Jul 2027');
    await page.getByRole('tab', { name: /^Favourites/ }).click();
    await expect(page.getByRole('tabpanel', { name: 'Favourites' })).toContainText('Lake · Italy');
  });

  for (const theme of THEMES) {
    for (const [name, values] of [['empty', {}], ['kept', { [COPIES_KEY]: copies(), [FAV_KEY]: favourites() }]] as const) {
      test(`axe: ${name} (${theme})`, async ({ page, site }) => {
        await setTheme(page, theme);
        await seed(page, values);
        await page.goto(`${site.url}/mine/`, { waitUntil: 'networkidle' });
        await expect(page.getByRole('tablist', { name: 'Mine' })).toBeVisible();
        const r = await new AxeBuilder({ page }).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
      });
    }
  }
});

test.describe('/mine/ on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('the tabs sit at auto width under the card, 40 px tall, and keep their keys', async ({ page, site }) => {
    await page.goto(`${site.url}/mine/`, { waitUntil: 'networkidle' });
    const tabs = page.getByRole('tablist', { name: 'Mine' });
    const t = (await tabs.boundingBox())!;
    expect(t.width).toBeLessThan(400);
    expect((await tabs.getByRole('tab').first().boundingBox())!.height).toBe(40);
    const card = (await page.getByRole('region', { name: 'Your account' }).boundingBox())!;
    expect(card.y + card.height).toBeLessThan(t.y); // card above the tabs
  });
});

test.describe('desktop header: Mine', () => {
  const at = (width: number) => ({ width, height: 900 });
  for (const [w, label] of [[1440, true], [900, true], [899, false], [640, false]] as const) {
    test(`${w}px: Mine shows ${label ? 'icon and label' : 'the icon only'}, 44 px hit area, after Theme`, async ({ page, site }) => {
      await page.setViewportSize(at(w));
      await page.goto(`${site.url}/trips/`, { waitUntil: 'networkidle' });
      const link = page.locator('.site-header').getByRole('link', { name: 'Mine' });
      await expect(link).toBeVisible();
      expect(await page.locator('.mine-link-label').isVisible()).toBe(label);
      const b = (await link.boundingBox())!;
      expect(b.height).toBe(38);
      expect(b.width).toBe(label ? 77 : 38);
      const theme = (await page.locator('.site-header').getByRole('button', { name: /theme/ }).boundingBox())!;
      expect(b.x).toBeGreaterThan(theme.x);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(w);
    });
  }

  test('no phone Mine in the header at 390 (the bar holds it)', async ({ page, site }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`${site.url}/trips/`, { waitUntil: 'networkidle' });
    await expect(page.locator('.site-header').getByRole('link', { name: 'Mine' })).toBeHidden();
  });

  test('Mine is current on /mine/ and mounts with no header layout shift', async ({ page, site }) => {
    await page.setViewportSize(at(1440));
    await page.addInitScript(() => {
      (window as unknown as { __shifts: number[] }).__shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] }[]) {
          if (e.hadRecentInput) continue;
          if ((e.sources ?? []).some((s) => (s.node as Element | undefined)?.closest?.('.site-header'))) (window as unknown as { __shifts: number[] }).__shifts.push(e.value);
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(`${site.url}/mine/`);
    const link = page.locator('.site-header').getByRole('link', { name: 'Mine' });
    await expect(link).toBeVisible();
    await page.waitForTimeout(600);
    await expect(link).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts)).toEqual([]);
  });

  test('the dot sits on the header Mine button too, and its name says so', async ({ page, site }) => {
    await page.setViewportSize(at(1440));
    await seed(page, { [FAV_KEY]: favourites() });
    await page.goto(`${site.url}/trips/`, { waitUntil: 'networkidle' });
    const link = page.locator('.site-header .mine-link');
    await expect(link).toHaveAttribute('data-dot', 'true');
    await expect(link).toHaveAccessibleName('Mine, new items');
  });
});

// ---- the phone header's account link: needs the sign-in-on build ----


const SIGNIN_DIST = '.next-signin';
const signInBuild = existsSync(path.join(ROOT, 'web', SIGNIN_DIST, 'BUILD_ID'));

test.describe('phone header account link (sign-in build)', () => {
  test.skip(!signInBuild, `needs web/${SIGNIN_DIST}: NEXT_PUBLIC_SIGN_IN=1 NEXT_DIST_DIR=${SIGNIN_DIST} next build`);
  let on: Server;
  test.beforeAll(async () => {
    on = await startNext(SIGNIN_DIST);
  });
  test.afterAll(() => on?.stop());

  const signedIn = async (page: Page) => {
    await page.route('**/api/auth/get-session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ session: { id: 's1', userId: 'u1', expiresAt: '2099-01-01T00:00:00.000Z', token: 't' }, user: { id: 'u1', email: 'a@b.com', name: 'A', emailVerified: true } }) }),
    );
  };
  const signedOut = async (page: Page) => {
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  };

  for (const w of [320, 390, 639]) {
    test(`${w}px signed out: brand, Search, Sign in, Theme on one row, 44 px targets 8 px apart, no overflow`, async ({ page }) => {
      await signedOut(page);
      await page.setViewportSize({ width: w, height: 844 });
      await page.goto(`${on.url}/trips/`, { waitUntil: 'networkidle' });
      const tools = page.locator('.header-tools');
      const targets = [page.getByRole('button', { name: 'Search' }).first(), page.locator('.site-header').getByRole('link', { name: 'Sign in' }), page.getByRole('button', { name: /theme/ })];
      const boxes = [];
      for (const t of targets) {
        await expect(t).toBeVisible();
        boxes.push((await t.boundingBox())!);
      }
      for (const b of boxes) {
        expect(b.width).toBe(44);
        expect(b.height).toBe(44);
      }
      expect(boxes[1].x - (boxes[0].x + boxes[0].width)).toBe(8);
      expect(boxes[2].x - (boxes[1].x + boxes[1].width)).toBe(8);
      // one row
      expect(new Set(boxes.map((b) => b.y)).size).toBe(1);
      const brand = (await page.locator('.brand').boundingBox())!;
      expect(brand.x + brand.width).toBeLessThanOrEqual(boxes[0].x);
      expect((await tools.boundingBox())!.x + (await tools.boundingBox())!.width).toBeLessThanOrEqual(w - 14 + 0.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(w);
      // the signed-in twin is not rendered visible, nor focusable
      await expect(page.locator('.site-header').getByRole('link', { name: 'Account' })).toBeHidden();
      await expect(page.locator('.avatar-btn')).toHaveCount(0);
    });
  }

  test('320: the spare between brand and tools is at least 30 px', async ({ page }) => {
    await signedOut(page);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(`${on.url}/trips/`, { waitUntil: 'networkidle' });
    const brand = (await page.locator('.brand').boundingBox())!;
    const search = (await page.getByRole('button', { name: 'Search' }).first().boundingBox())!;
    expect(search.x - (brand.x + brand.width) - 12).toBeGreaterThanOrEqual(30);
  });

  test('signed out the link goes to /sign-in/; tab order is brand, Search, Sign in, Theme', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari tabs to form controls only unless Option is held');
    await signedOut(page);
    await page.setViewportSize(PHONE);
    await page.goto(`${on.url}/trips/`, { waitUntil: 'networkidle' });
    const link = page.locator('.site-header').getByRole('link', { name: 'Sign in' });
    await expect(link).toHaveAttribute('href', '/sign-in/');
    await page.locator('.brand').focus();
    const names: string[] = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      names.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''));
    }
    expect(names).toEqual(['Search', 'Sign in', expect.stringMatching(/theme/)]);
  });

  test('signed in on a phone: the Account link in a ring, no avatar menu and no AccountMenu chunk', async ({ page }) => {
    await signedIn(page);
    const chunks: string[] = [];
    page.on('request', (r) => {
      if (/\/_next\/static\/.*\.js/.test(r.url())) chunks.push(r.url());
    });
    await page.setViewportSize(PHONE);
    await page.goto(`${on.url}/trips/`, { waitUntil: 'networkidle' });
    const link = page.locator('.site-header').getByRole('link', { name: 'Account' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/account/');
    await expect(page.locator('.site-header').getByRole('link', { name: 'Sign in' })).toBeHidden();
    await expect(page.locator('.avatar-btn')).toHaveCount(0);
    const ring = await link.evaluate((el) => getComputedStyle(el, '::before').width);
    expect(ring).toBe('30px');
    expect(await page.evaluate(() => 'signedIn' in document.documentElement.dataset)).toBe(true);
    // the avatar menu's chunk (the only one that names "Account menu") is never requested on a phone
    const bodies = await Promise.all(chunks.map((u) => page.request.get(u).then((r) => r.text())));
    expect(bodies.some((b) => b.includes('Account menu'))).toBe(false);
    // targets are still 44 and 8 apart
    const b = (await link.boundingBox())!;
    expect([b.width, b.height]).toEqual([44, 44]);
    // the bar still says Mine
    await expect(page.getByRole('navigation', { name: 'Main, bottom' }).getByRole('link', { name: 'Mine' })).toBeVisible();
  });

  test('signed in at desktop width: the avatar menu holds Account and Sign out only, Mine stays a button', async ({ page }) => {
    await signedIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${on.url}/trips/`, { waitUntil: 'networkidle' });
    await page.locator('.avatar-btn').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Account', 'Sign out']);
    await expect(page.locator('.site-header').getByRole('link', { name: 'Mine' })).toBeVisible();
    await expect(page.locator('.phone-acct').first()).toBeHidden();
  });

  test('current: the account link is aria-current on /sign-in/ signed out and on /account/ signed in', async ({ page }) => {
    await signedOut(page);
    await page.setViewportSize(PHONE);
    await page.goto(`${on.url}/sign-in/`, { waitUntil: 'networkidle' });
    await expect(page.locator('.site-header').getByRole('link', { name: 'Sign in' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('navigation', { name: 'Main, bottom' }).getByRole('link', { name: 'Mine' })).toHaveAttribute('aria-current', 'true');
  });

  test('forced colours: the phone account link is painted (a mask needs a background)', async ({ browser, browserName }) => {
    test.skip(browserName !== 'chromium', 'forced-colors emulation is Chromium only');
    const ctx = await browser.newContext({ viewport: PHONE, forcedColors: 'active' });
    const page = await ctx.newPage();
    await signedOut(page);
    await page.goto(`${on.url}/trips/`, { waitUntil: 'networkidle' });
    const icon = page.locator('.phone-acct:visible .mi');
    await expect(icon).toHaveCount(1);
    const bg = await icon.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect((await icon.boundingBox())!.width).toBeGreaterThan(0);
    await ctx.close();
  });

  test('the card buttons are the 38 px secondary, not the 30 px small one (S1)', async ({ page }) => {
    await signedOut(page);
    await page.setViewportSize(PHONE);
    await page.goto(`${on.url}/mine/`, { waitUntil: 'networkidle' });
    const card = page.getByRole('region', { name: 'Your account' });
    for (const n of ['Sign in', 'Create an account']) expect((await card.getByRole('link', { name: n }).boundingBox())!.height).toBeGreaterThanOrEqual(38);
  });

  test('the device notice buttons sit under the text on a phone (S6)', async ({ page }) => {
    await signedOut(page);
    await seed(page, { [COPIES_KEY]: copies() });
    await page.setViewportSize(SMALL);
    await page.goto(`${on.url}/mine/`, { waitUntil: 'networkidle' });
    const n = page.locator('.mine-notice');
    const text = (await n.locator('.ban-text').boundingBox())!;
    const act = (await n.locator('.ban-action').boundingBox())!;
    expect(act.y).toBeGreaterThanOrEqual(text.y + text.height - 1);
  });

  test('the Mine account card offers Sign in and Create an account, returning to /mine/', async ({ page }) => {
    await signedOut(page);
    await page.setViewportSize(PHONE);
    await page.goto(`${on.url}/mine/`, { waitUntil: 'networkidle' });
    const card = page.getByRole('region', { name: 'Your account' });
    await expect(card.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in/?next=%2Fmine%2F');
    await expect(card.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/sign-up/?next=%2Fmine%2F');
    // text on line 1, buttons on line 2 on a phone
    const text = (await card.locator('.mine-card-text').boundingBox())!;
    const first = (await card.getByRole('link').first().boundingBox())!;
    expect(first.y).toBeGreaterThan(text.y + text.height - 1);
  });

  test('signed in, the card reads "Signed in as" with Account and no notice', async ({ page }) => {
    await signedIn(page);
    await seed(page, { [COPIES_KEY]: copies() });
    await page.setViewportSize(PHONE);
    await page.goto(`${on.url}/mine/`, { waitUntil: 'networkidle' });
    const card = page.getByRole('region', { name: 'Your account' });
    await expect(card).toContainText('Signed in as a@b.com');
    await expect(card.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account/');
    await expect(page.getByText('Clearing browser data, using a private window')).toHaveCount(0);
  });
});
