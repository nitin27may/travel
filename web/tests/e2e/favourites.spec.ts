import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { setTheme, THEMES } from './shots';

// FAV-1 (docs/v2/build/briefs-bundle-A.md 7.12; visitor spec 16 items 1, 2, 6; mine-and-bar-spec 5.3, 6, 7): hearts on a place and a trip,
// card badges, the Favourites tab in Mine, the first-save note, and a browser that keeps nothing. Sign-in is off in this build.

const FAV_KEY = 'travel.fav.local';
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
// real pages of the fixture catalogue
const PLACES = ['lago-di-braies', 'lago-di-carezza', 'cinque-torri'];
const TRIP = 'dolomites-2027';

type Row = { space: 'place' | 'trip'; slug: string; name?: string | null; kind?: string | null; cc?: string | null; at?: string; gone?: boolean };
const envelope = (rows: Row[]) =>
  JSON.stringify({
    schema: 'favourites/1',
    items: rows.map((r, i) => ({
      space: r.space, slug: r.slug, ref: null, name: r.name ?? null, kind: r.kind ?? null, cc: r.cc ?? null,
      favouredAt: r.at ?? new Date(Date.UTC(2026, 9, 25, 10, 0, 0) - i * 60_000).toISOString(), unlistedAt: r.gone ? '2026-10-25T12:00:00.000Z' : null,
    })),
    noteSeen: '2026-10-20T10:00:00.000Z', snoozedUntil: null, snoozedAtCount: null, merged: {}, pending: [],
  });

/** Writes the list before the first document of the context loads (and only then, so a reload keeps what the page wrote). */
async function seed(page: Page, rows: Row[]) {
  await page.addInitScript(([k, v]) => {
    if (sessionStorage.getItem('fav-seeded')) return;
    sessionStorage.setItem('fav-seeded', '1');
    localStorage.setItem(k, v);
  }, [FAV_KEY, envelope(rows)] as const);
}
const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null') as { items: { space: string; slug: string }[]; noteSeen: string | null } | null, FAV_KEY);
const heart = (page: Page) => page.getByRole('button', { name: /^Favourite / });

/** Requests the page makes to the API, for the privacy and "no request to save" checks. */
function watchApi(page: Page) {
  const calls: { method: string; url: string }[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) calls.push({ method: r.method(), url: r.url() });
  });
  return calls;
}

test.describe('the heart on a place page', () => {
  test.use({ viewport: DESKTOP });

  test('is not in the server HTML, appears after Share once the page is live, with one fixed name', async ({ page, request, site }) => {
    const html = await (await request.get(`${site.url}/places/${PLACES[0]}/`)).text();
    expect(html).not.toContain('fav-heart');
    expect(html).not.toContain('Favourite ');
    await page.goto(`${site.url}/places/${PLACES[0]}/`, { waitUntil: 'networkidle' });
    const h1 = (await page.getByRole('heading', { level: 1 }).first().innerText()).trim();
    const btn = page.getByRole('button', { name: `Favourite ${h1}` });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(btn).toHaveAttribute('title', 'Favourite');
    // right after Share, in the page order and on screen
    const order = await page.locator('.pl-actions').evaluate((row) => [...row.children].map((c) => c.matches('[data-share]') ? 'share' : c.querySelector('.fav-heart') ? 'heart' : 'other'));
    expect(order.indexOf('heart')).toBe(order.indexOf('share') + 1);
    // 38 px visual with a padded 44 px hit area on a desktop
    const box = (await btn.boundingBox())!;
    expect(Math.round(box.width)).toBe(38);
    expect(Math.round(box.height)).toBe(38);
    const hit = await btn.evaluate((el) => {
      const a = getComputedStyle(el, '::after');
      return [parseFloat(a.width), parseFloat(a.height)];
    });
    expect(hit[0]).toBeGreaterThanOrEqual(44);
    expect(hit[1]).toBeGreaterThanOrEqual(44);
  });

  test('toggles with Space and Enter, fills when pressed, and the first heart says where favourites live, with Undo', async ({ page, site }) => {
    const api = watchApi(page);
    await page.goto(`${site.url}/places/${PLACES[0]}/`, { waitUntil: 'networkidle' });
    const btn = heart(page);
    await btn.focus();
    await page.keyboard.press('Space');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    const toast = page.locator('.toast-region .toast');
    await expect(toast).toContainText('Added to favourites. They are kept in this browser.'); // sign-in is off in this build
    expect((await stored(page))!.items.map((i) => i.slug)).toEqual([PLACES[0]]);
    expect((await stored(page))!.noteSeen).not.toBeNull();
    // pressed is shape as well as colour: the glyph is filled
    expect(await btn.locator('path').evaluate((p) => getComputedStyle(p).fill)).not.toBe('rgba(0, 0, 0, 0)');
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect((await stored(page))!.items).toEqual([]);
    // the next one is the short toast, not the first-save note
    await btn.press('Enter');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(toast).toContainText('to favourites');
    await expect(toast).not.toContainText('kept in this browser');
    await btn.press('Enter');
    await expect(page.locator('.toast-region')).toContainText('Removed');
    await expect(page.locator('.toast-region')).toContainText('from favourites');
    expect(api.filter((c) => c.method !== 'GET')).toEqual([]);
    expect(api.filter((c) => /favour|resolve/i.test(c.url))).toEqual([]); // saving a heart makes no request at all
  });

  test('a second tab on the same page follows', async ({ page, context, site }) => {
    await page.goto(`${site.url}/places/${PLACES[0]}/`, { waitUntil: 'networkidle' });
    const other = await context.newPage();
    await other.goto(`${site.url}/places/${PLACES[0]}/`, { waitUntil: 'networkidle' });
    await expect(heart(other)).toHaveAttribute('aria-pressed', 'false');
    await heart(page).click();
    await expect(heart(other)).toHaveAttribute('aria-pressed', 'true');
    await heart(page).click();
    await expect(heart(other)).toHaveAttribute('aria-pressed', 'false');
  });

  test('a list from a newer version of the site is left exactly as it is and the heart says so', async ({ page, site }) => {
    const newer = JSON.stringify({ schema: 'favourites/2', items: [] });
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [FAV_KEY, newer] as const);
    await page.goto(`${site.url}/places/${PLACES[0]}/`, { waitUntil: 'networkidle' });
    await heart(page).click();
    await expect(page.locator('.toast-region')).toContainText('We could not change your favourites');
    expect(await page.evaluate((k) => localStorage.getItem(k), FAV_KEY)).toBe(newer);
  });
});

test.describe('the heart on a trip page', () => {
  test.use({ viewport: DESKTOP });
  test('sits after Share in the cover row only, and a trip is its own favourite', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/${TRIP}/`, { waitUntil: 'networkidle' });
    await expect(heart(page)).toHaveCount(1); // the cover's row, not the end-of-page row
    const order = await page.locator('.trip-cover .trip-actions').evaluate((row) => [...row.children].map((c) => (c.matches('.fav-heart') ? 'heart' : c.querySelector('[data-share]') || c.matches('[data-share]') ? 'share' : 'other')));
    expect(order.indexOf('heart')).toBe(order.indexOf('share') + 1);
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    expect((await stored(page))!.items).toMatchObject([{ space: 'trip', slug: TRIP }]);
  });
});

test.describe('the heart on a phone', () => {
  test.use({ viewport: PHONE });
  test('is 44 px square', async ({ page, site }) => {
    await page.goto(`${site.url}/places/${PLACES[0]}/`, { waitUntil: 'networkidle' });
    const box = (await heart(page).boundingBox())!;
    expect(Math.round(box.width)).toBe(44);
    expect(Math.round(box.height)).toBe(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
});

test.describe('a browser that keeps nothing', () => {
  test.use({ viewport: DESKTOP });
  test('the heart still works for this page, says the list is session only, and Mine says the browser keeps nothing', async ({ page, site }) => {
    await page.addInitScript(() => {
      for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } });
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${site.url}/places/${PLACES[0]}/`, { waitUntil: 'networkidle' });
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.toast-region')).toContainText('This browser is not keeping data, so this favourite lasts only until you leave this page.');
    await page.locator('.toast-region').getByRole('button', { name: 'Undo' }).click();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
    await page.goto(`${site.url}/mine/?show=favourites`, { waitUntil: 'networkidle' });
    await expect(page.getByText('This browser is not keeping data.')).toBeVisible();
    expect(errors.filter((m) => /storage|insecure|SecurityError/i.test(m))).toEqual([]);
  });
});

test.describe('Mine > Favourites', () => {
  test.use({ viewport: DESKTOP });

  test('three places and a trip hearted on their pages are all in Mine after a reload', async ({ page, site }) => {
    const api = watchApi(page);
    for (const slug of PLACES) {
      await page.goto(`${site.url}/places/${slug}/`, { waitUntil: 'networkidle' });
      await heart(page).click();
      await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    }
    await page.goto(`${site.url}/trips/${TRIP}/`, { waitUntil: 'networkidle' });
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    // nothing was sent anywhere to keep them (the pages' own export-data reads are GETs of the page itself)
    expect(api.filter((c) => c.method !== 'GET' || /favour|resolve/i.test(c.url))).toEqual([]);

    await page.goto(`${site.url}/mine/`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('tab', { name: /^Favourites/ })).toHaveAttribute('aria-selected', 'true'); // the tab with the newest item
    const panel = page.getByRole('tabpanel', { name: /^Favourites/ });
    await expect(panel.locator('.frow')).toHaveCount(4);
    await expect(panel.locator('.frow[data-handle^="trip:"]')).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'Favourites, 4' })).toBeVisible();
    // list rows: a thumbnail slot each (a photo when the page has one, else the kind glyph)
    await expect(panel.locator('.frow img[alt=""]')).not.toHaveCount(5);
    await expect(panel.locator('.mthumb')).toHaveCount(4);
    // the filters: All 4 · Places 3 · Trips 1
    const scope = panel.getByRole('radiogroup', { name: 'Show' });
    await expect(scope.getByRole('radio')).toHaveText(['All 4', 'Places 3', 'Trips 1']);
    await scope.getByRole('radio', { name: 'Trips 1' }).click();
    await expect(panel.locator('.frow')).toHaveCount(1);
    await scope.getByRole('radio', { name: /^All/ }).click();
    // the visible rows were asked once, as handles, and got light rows back (no favourite leaves as a body, and nothing is written to the server)
    expect(api.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  test('a renamed page takes its current name; a page that is gone reads "No longer listed", is not a link, and Remove works with Undo', async ({ page, site }) => {
    await seed(page, [
      { space: 'place', slug: PLACES[0], name: 'An old name for it', kind: 'lake', cc: 'IT' },
      { space: 'place', slug: 'a-place-we-withdrew', name: 'Withdrawn Falls', kind: 'waterfall', cc: 'CA' },
    ]);
    await page.goto(`${site.url}/mine/?show=favourites`, { waitUntil: 'networkidle' });
    const panel = page.getByRole('tabpanel', { name: /^Favourites/ });
    await expect(panel.locator('.frow')).toHaveCount(2);
    await expect(panel.getByText('An old name for it')).toHaveCount(0); // refreshed from the catalogue
    const gone = panel.locator('.frow[data-handle="place:a-place-we-withdrew"]');
    await expect(gone.getByText('No longer listed')).toBeVisible();
    await expect(gone).toContainText('Withdrawn Falls'); // the name is kept
    await expect(gone.locator('a')).toHaveCount(0);
    await expect(gone.getByRole('group', { name: 'Withdrawn Falls, no longer listed' })).toBeVisible();
    await gone.getByRole('button', { name: 'Remove Withdrawn Falls' }).click();
    await expect(panel.locator('.frow')).toHaveCount(1);
    await expect(page.locator('.toast-region')).toContainText('Removed Withdrawn Falls from favourites');
    await page.locator('.toast-region').getByRole('button', { name: 'Undo' }).click();
    await expect(panel.locator('.frow')).toHaveCount(2);
    expect((await stored(page))!.items.map((i) => i.slug).sort()).toEqual([PLACES[0], 'a-place-we-withdrew'].sort());
    // refreshing wrote the tombstone and the new name into the list
    const env = (await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), FAV_KEY)) as { items: { slug: string; name: string; unlistedAt: string | null }[] };
    expect(env.items.find((i) => i.slug === 'a-place-we-withdrew')!.unlistedAt).not.toBeNull();
    expect(env.items.find((i) => i.slug === PLACES[0])!.name).not.toBe('An old name for it');
  });

  test('the heart in a row removes it with Undo, and focus lands on the next row', async ({ page, site }) => {
    await seed(page, [
      { space: 'place', slug: PLACES[0], name: 'Lago di Braies', kind: 'lake', cc: 'IT' },
      { space: 'place', slug: PLACES[1], name: 'Lago di Carezza', kind: 'lake', cc: 'IT' },
    ]);
    await page.goto(`${site.url}/mine/?show=favourites`, { waitUntil: 'networkidle' });
    const panel = page.getByRole('tabpanel', { name: /^Favourites/ });
    const first = panel.locator('.frow').first();
    await expect(first.getByRole('button', { name: /^Favourite / })).toHaveAttribute('aria-pressed', 'true');
    await first.getByRole('button', { name: /^Favourite / }).click();
    await expect(panel.locator('.frow')).toHaveCount(1);
    await expect(page.locator('.toast-region')).toContainText('from favourites');
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.frow')?.getAttribute('data-handle'))).toBe(`place:${PLACES[1]}`);
    await page.locator('.toast-region').getByRole('button', { name: 'Undo' }).click();
    await expect(panel.locator('.frow')).toHaveCount(2);
  });

  test('empty: the heart, the line and the two ways out', async ({ page, site }) => {
    await page.goto(`${site.url}/mine/?show=favourites`, { waitUntil: 'networkidle' });
    const panel = page.getByRole('tabpanel', { name: /^Favourites/ });
    await expect(panel.getByRole('heading', { name: 'No favourites yet' })).toBeVisible();
    await expect(panel.getByText('Tap the heart on a place or a trip to keep it here.')).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Browse places' })).toHaveAttribute('href', '/places/');
    await expect(panel.getByRole('link', { name: 'Browse trips' })).toHaveAttribute('href', '/trips/');
  });

  test('pages of 48 with the page in the URL, newest first, and Name sorts A to Z', async ({ page, site }) => {
    const rows: Row[] = Array.from({ length: 60 }, (_, i) => ({ space: 'place', slug: `fixture-place-${String(i).padStart(2, '0')}`, name: `Place ${String(59 - i).padStart(2, '0')}`, kind: 'lake', cc: 'CA' }));
    await seed(page, rows);
    await page.goto(`${site.url}/mine/?show=favourites`, { waitUntil: 'networkidle' });
    const panel = page.getByRole('tabpanel', { name: /^Favourites/ });
    await expect(panel.locator('.frow')).toHaveCount(48);
    await expect(panel.getByText('1 to 48 of 60')).toBeVisible();
    await panel.getByRole('button', { name: 'Page 2' }).click();
    await expect(panel.locator('.frow')).toHaveCount(12);
    await expect(page).toHaveURL(/show=favourites&page=2/);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(panel.locator('.frow')).toHaveCount(12);
    await page.goto(`${site.url}/mine/?show=favourites`, { waitUntil: 'networkidle' });
    await panel.getByRole('radio', { name: 'Name' }).click();
    await expect(panel.locator('.frow-name').first()).toHaveText('Place 00');
  });

  test('/favourites/ is a permanent redirect to the tab', async ({ request, site }) => {
    const r = await request.get(`${site.url}/favourites/`, { maxRedirects: 0 });
    expect(r.status()).toBe(308);
    expect(r.headers()['location']).toMatch(/\/mine\/\?show=favourites$/);
  });
});

test.describe('Mine > Favourites on a phone', () => {
  test.use({ viewport: PHONE });
  test('one column, the filters behind "Filters" in a bottom sheet', async ({ page, site }) => {
    await seed(page, [
      { space: 'place', slug: PLACES[0], name: 'Lago di Braies', kind: 'lake', cc: 'IT' },
      { space: 'place', slug: PLACES[1], name: 'Lago di Carezza', kind: 'lake', cc: 'IT' },
      { space: 'place', slug: 'a-trail-somewhere', name: 'A trail', kind: 'trail', cc: 'CA' },
    ]);
    await page.goto(`${site.url}/mine/?show=favourites`, { waitUntil: 'networkidle' });
    const panel = page.getByRole('tabpanel', { name: /^Favourites/ });
    const filters = panel.getByRole('button', { name: /^Filters/ });
    await expect(filters).toBeVisible();
    expect(Math.round((await filters.boundingBox())!.height)).toBe(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await filters.click();
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    await sheet.getByRole('checkbox', { name: /Trail/ }).check();
    await sheet.getByRole('button', { name: /^Show 1 favourite$/ }).click();
    await expect(panel.locator('.frow')).toHaveCount(1);
    await expect(panel.getByRole('button', { name: 'Filters (1)' })).toBeVisible();
    // every row control is at least 44 px
    for (const b of await panel.locator('.frow-heart').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('card badges', () => {
  test.use({ viewport: DESKTOP });
  test('a favourited trip and place wear a decorative badge and their link gains ", in your favourites"; nothing else changes', async ({ page, site }) => {
    await seed(page, [{ space: 'trip', slug: TRIP, name: 'Dolomites' }]);
    const html = await (await page.request.get(`${site.url}/trips/`)).text();
    expect(html).not.toContain('fav-badge'); // the markup is the same for everyone
    await page.goto(`${site.url}/trips/`, { waitUntil: 'networkidle' });
    const card = page.locator(`.card:has(a.card-open[href="/trips/${TRIP}/"])`);
    await expect(card.locator('.fav-badge')).toHaveCount(1);
    await expect(card.locator('.fav-badge')).toHaveAttribute('aria-hidden', 'true');
    await expect(card.locator('.fav-badge')).toHaveText(''); // a mark, never a count
    await expect(card.getByRole('link', { name: /, in your favourites$/ })).toHaveCount(1);
    await expect(card.locator('button')).toHaveCount(0); // never a second toggle on a card
    await expect(page.locator('.fav-badge')).toHaveCount(1);
    // heart the first place of the list on its page, come back: the Places list badges it too
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    const first = (await page.locator('.card a.card-open').first().getAttribute('href'))!;
    await page.goto(`${site.url}${first}`, { waitUntil: 'networkidle' });
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    await expect(page.locator(`.card:has(a.card-open[href="${first}"]) .fav-badge`)).toHaveCount(1);
    // and the home strips
    await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
    await expect(page.locator('.fav-badge')).not.toHaveCount(0);
  });
});

test.describe('axe', () => {
  for (const theme of THEMES) {
    test(`a place page with the heart pressed, and Mine > Favourites with rows and a withdrawn row, in ${theme}`, async ({ page, site }) => {
      await setTheme(page, theme);
      await seed(page, [
        { space: 'place', slug: PLACES[0], name: 'Lago di Braies', kind: 'lake', cc: 'IT' },
        { space: 'trip', slug: TRIP, name: 'Dolomites', cc: 'IT' },
        { space: 'place', slug: 'a-place-we-withdrew', name: 'Withdrawn Falls', kind: 'waterfall', cc: 'CA' },
      ]);
      await page.goto(`${site.url}/places/${PLACES[0]}/`, { waitUntil: 'networkidle' });
      await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
      let r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      await page.goto(`${site.url}/mine/?show=favourites`, { waitUntil: 'networkidle' });
      await expect(page.locator('.frow')).toHaveCount(3);
      await expect(page.getByText('No longer listed')).toBeVisible();
      r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
});
