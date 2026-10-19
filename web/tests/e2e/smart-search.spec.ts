import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { setTheme, THEMES } from './shots';

// Smart search phase 1, the UI (backlog 3.43 part B; smart-search.md 6.1, 7 and 12): chips in the header search and in the Places and
// Trips boxes, "Not checked yet", the undo line, the keyboard, a phone, and axe in both themes. Real data, no counts asserted: the
// assertions read the URL the words became and the structure the visitor sees.

const Q1 = 'easy hike with kids near Banff in September';
const Q1_KEYS = { country: 'CA', region: 'alberta', area: 'banff', k: 'nature.trail', season: '9', kid: 'yes', effort: 'stroll,easy' };
const QWATERFALL = 'waterfall I can reach with a stroller';

const keys = (url: string) => Object.fromEntries(new URL(url).searchParams.entries());
/**
 * A click on a control far down the list. On a phone the sticky filter bar and the bottom bar cover most of the viewport once a reading is
 * applied (the bar already carries the count note), so Playwright's scroll lands the control under one of them. The click is the control's own.
 */
const tap = (l: Locator) => l.evaluate((el) => (el as HTMLElement).click());
const chips = (page: Page) => page.getByRole('group', { name: 'How the search was read' });

async function openHeader(page: Page, site: { url: string }, path = '/about/data/') {
  await page.goto(`${site.url}${path}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Search' }).first().click();
  const box = page.getByRole('combobox', { name: 'Search trips, places and areas' });
  await expect(box).toBeFocused();
  return box;
}

async function list(page: Page, site: { url: string }, path: '/places/' | '/trips/') {
  await page.goto(`${site.url}${path}`, { waitUntil: 'networkidle' });
  return page.getByRole('searchbox', { name: path === '/places/' ? 'Search places' : 'Search trips' });
}

test.describe('header search', () => {
  test('query 1 reads as five chips, "Show places" is the first option, and Enter opens the list with the parsed keys', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill(Q1);
    for (const name of ['Remove Trails and walks', 'Remove With kids', 'Remove Banff, Alberta', 'Remove September', 'Remove Easy or a stroll']) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
    const first = page.getByRole('option').first();
    await expect(first).toHaveText(/^Show places/);
    await expect(box).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!);
    await box.press('Enter');
    await expect(page).toHaveURL(/\/places\/\?/);
    expect(keys(page.url())).toEqual(Q1_KEYS);
    // the list holds the same keys as its own active filters
    await expect(page.getByRole('list', { name: 'Active filters' }).getByText('Season: Sep')).toBeVisible();
  });

  test('on the Places page the Show option carries the count of the list', async ({ page, site }) => {
    const box = await openHeader(page, site, '/places/');
    await box.fill('lakes in Iceland');
    await expect(page.getByRole('option').first()).toHaveText(/^Show \d+ places?/);
  });

  test('removing a chip drops its key from the link, and its words do not come back while typing on', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill(Q1);
    await expect(page.getByRole('button', { name: 'Remove September' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove September' }).click();
    await expect(page.getByRole('button', { name: 'Remove September' })).toHaveCount(0);
    await expect(page.getByRole('option').first()).toHaveAttribute('href', /^(?!.*season=)/);
    // typing on re-reads the text, and the removed chip stays removed
    await box.press('End');
    await box.pressSequentially(' quiet');
    await expect(page.getByText('quiet', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Trails and walks' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove September' })).toHaveCount(0);
    // the unused word is listed, never dropped silently (H3)
    await expect(page.getByText('Not used', { exact: true })).toBeVisible();
  });

  test('keyboard: Backspace at the start of the box takes off the last chip, Esc clears and then closes', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill(Q1);
    const last = page.locator('.qchip').last();
    await expect(page.locator('.qchip')).toHaveCount(5);
    const lastName = (await last.locator('.qchip-t').innerText()).trim();
    await box.press('Home');
    await box.press('Backspace');
    await expect(page.locator('.qchip')).toHaveCount(4);
    await expect(page.getByRole('button', { name: `Remove ${lastName}` })).toHaveCount(0);
    expect(await box.inputValue()).toBe(Q1);
    await box.press('Escape');
    await expect(box).toHaveValue('');
    await box.press('Escape');
    await expect(box).toHaveCount(0);
  });

  test('a name wins over a parse: "Niagara Falls" shows name hits and no chips', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill('Niagara Falls');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.waitForTimeout(500);
    await expect(chips(page)).toHaveCount(0);
    await expect(page.getByRole('option', { name: /^Show/ })).toHaveCount(0);
  });

  test('words with no filter are "Not used yet", never approximated: "hidden gems in Utah"', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill('hidden gems in Utah');
    await expect(page.getByText('Not used yet')).toBeVisible();
    await expect(page.locator('.qc-word[data-yet]')).toHaveText('hidden gem');
    await expect(page.getByRole('button', { name: /Remove Utah/ })).toBeVisible();
  });

  test('"Did you mean" is a listbox option you can reach with the arrows: query 29', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill('waterfalls worth the journey in Patagonia');
    const dym = page.getByRole('group', { name: 'Did you mean' });
    await expect(dym).toBeVisible();
    await expect(page.getByText('worth the journey')).toBeVisible();
    await box.press('ArrowDown');
    await expect(dym.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  });

  test('Trips: "with kids" asks the age and sets nothing until one is picked (Q40)', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill('weekend trip with kids in October');
    const ask = page.getByRole('button', { name: /^With kids: how old is the youngest/ }).first();
    await expect(ask).toBeVisible();
    await expect(page.getByRole('option').first()).toHaveText(/^Show trips/);
    await expect(page.getByRole('option').first()).toHaveAttribute('href', /^(?!.*kid=)/);
    await ask.click();
    const pop = page.getByRole('group', { name: 'Pick the age' });
    await expect(pop).toBeVisible();
    await pop.getByRole('button', { name: 'A child of 6' }).click();
    await expect(page.getByRole('option').first()).toHaveAttribute('href', /kid=6/);
    await expect(page.getByRole('option').first()).toHaveAttribute('href', /^\/trips\//);
  });

  test('the other area reading replaces the chip (Banff or Banff National Park)', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill(Q1);
    await page.getByRole('button', { name: /^Banff, Alberta/ }).click();
    const pop = page.getByRole('group', { name: 'Other readings' });
    await expect(pop).toBeVisible();
    await pop.getByRole('button').first().click();
    await expect(page.getByRole('button', { name: /^Remove Banff National Park/ })).toBeVisible();
    await expect(page.getByRole('option').first()).toHaveAttribute('href', /area=banff-national-park|area=banff/);
  });

  test('the cover search on the home page opens the same reading', async ({ page, site }) => {
    await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Search trips, places and countries/ }).click();
    await page.getByRole('combobox', { name: 'Search trips, places and areas' }).fill(Q1);
    await expect(page.getByRole('button', { name: 'Remove Trails and walks' })).toBeVisible();
  });

  test('chip popover Esc closes the popover first and keeps the dialog', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill(Q1);
    await page.getByRole('button', { name: /^Banff, Alberta/ }).click();
    await expect(page.getByRole('group', { name: 'Other readings' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('group', { name: 'Other readings' })).toHaveCount(0);
    await expect(box).toHaveValue(Q1);
  });
});

test.describe('the Places and Trips search boxes', () => {
  test('Places: Enter applies the reading, the undo line brings the words back, Esc does the same', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await box.fill(Q1);
    await expect(chips(page)).toBeVisible();
    await expect(page.getByText('applies this reading')).toBeVisible();
    await box.press('Enter');
    await expect(page).toHaveURL(/country=CA/);
    expect(keys(page.url())).toEqual(Q1_KEYS);
    const note = page.getByRole('status').filter({ hasText: /^Read .easy hike/ });
    await expect(note).toContainText('as 5 filters');
    await expect(box).toHaveValue('');
    // undo with the button
    await note.getByRole('button', { name: 'Search the words instead' }).click();
    await expect(box).toHaveValue(Q1);
    expect(keys(page.url())).toEqual({ q: Q1 });
    // apply again and undo with Esc
    await box.press('Enter');
    await expect(page).toHaveURL(/country=CA/);
    await box.focus();
    await box.press('Escape');
    await expect(box).toHaveValue(Q1);
    expect(keys(page.url())).toEqual({ q: Q1 });
  });

  test('Places: Backspace at the start of the box removes the last chip before Enter', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await box.fill(Q1);
    await expect(page.locator('.qchip')).toHaveCount(5);
    await box.press('Home');
    await box.press('Backspace');
    await expect(page.locator('.qchip')).toHaveCount(4);
    await box.press('Enter');
    await expect(page).toHaveURL(/country=CA/);
    const k = keys(page.url());
    expect(k.season).toBeUndefined();
    expect(Object.keys(k)).toHaveLength(6);
  });

  test('Places: "Not checked yet" holds the rows with no stroller answer, collapsed, and never inside the results (H1)', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await box.fill(QWATERFALL);
    await expect(chips(page)).toBeVisible();
    await box.press('Enter');
    await expect(page).toHaveURL(/stroller=any/);
    expect(keys(page.url())).toEqual({ k: 'water.falls', stroller: 'any' });
    const group = page.getByRole('region', { name: 'Not checked yet' });
    await expect(group).toBeVisible();
    const head = group.getByRole('button', { name: /^Not checked yet \(\d+\)/ });
    await expect(head).toHaveAttribute('aria-expanded', 'false');
    const total = Number(/\((\d+)\)/.exec(await head.innerText())![1]);
    expect(total).toBeGreaterThan(0);
    await tap(head);
    await expect(head).toHaveAttribute('aria-expanded', 'true');
    await expect(group.getByRole('heading', { name: /^Stroller: \d+/ })).toBeVisible();
    const names = await group.locator('.unchecked-row a, .unchecked-row b').allInnerTexts();
    expect(names.length).toBeGreaterThan(0);
    // no row of the group is a card of the main results
    for (const n of names) await expect(page.locator('.results .card').filter({ hasText: n })).toHaveCount(0);
    // the count line and the group agree on the word "stroller"
    await expect(page.getByRole('status').filter({ hasText: /^Read .waterfall/ })).toBeVisible();
  });

  test('Places: an empty answer says so, names the chip that costs the most, and offers the words back', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await box.fill(Q1);
    await box.press('Enter');
    await expect(page.getByRole('heading', { name: 'No places match all of this' })).toBeVisible();
    const words = page.getByRole('button', { name: 'Search the words instead' }).last();
    await tap(words);
    await expect(box).toHaveValue(Q1);
    await expect(page.getByRole('heading', { name: 'No places match all of this' })).toHaveCount(0);
  });

  test('Places: one word stays a plain text search, and a name wins', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await box.fill('braies');
    await box.press('Enter');
    await expect(page).toHaveURL(/q=braies/);
    expect(keys(page.url())).toEqual({ q: 'braies' });
    await expect(page.locator('.qchip')).toHaveCount(0);
  });

  test('Trips: the reading applies with the existing keys, and the age is still asked for', async ({ page, site }) => {
    const box = await list(page, site, '/trips/');
    await box.fill('weekend trip with kids in October');
    await expect(page.getByRole('button', { name: /^With kids: how old is the youngest/ })).toBeVisible();
    await box.press('Enter');
    await expect(page).toHaveURL(/length=weekend/);
    expect(keys(page.url())).toEqual({ length: 'weekend', season: '10' });
    const ask = page.getByRole('button', { name: /^With kids: how old is the youngest/ });
    await expect(ask).toBeVisible();
    await ask.click();
    await page.getByRole('group', { name: 'Pick the age' }).getByRole('button', { name: 'A child of 6' }).click();
    await expect(page).toHaveURL(/kid=6/);
  });

  test('a filter changed by hand ends the undo line: the reading is no longer the visitor\'s to undo', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await box.fill(QWATERFALL);
    await box.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: /^Read .waterfall/ })).toBeVisible();
    await page.getByRole('button', { name: 'Remove filter Kind: Waterfalls and rapids' }).click();
    await expect(page.locator('.smart-row')).not.toHaveAttribute('data-open', '');
  });
});

test.describe('phone, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the header chips fit the sheet and every remove control is at least 36 px', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill(Q1);
    await expect(chips(page)).toBeVisible();
    const over = await page.evaluate(() => {
      const d = document.querySelector('.search-dialog') as HTMLElement;
      return { dialog: d.scrollWidth - d.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(over.dialog).toBeLessThanOrEqual(0);
    expect(over.page).toBeLessThanOrEqual(0);
    for (const x of await page.locator('.qchip-x').all()) {
      const b = (await x.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(35.5);
      expect(b.height).toBeGreaterThanOrEqual(35.5);
    }
    for (const c of await page.locator('.qchip').all()) {
      const b = (await c.boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(390);
    }
  });

  test('the Places box shows the preview and the undo line without horizontal scroll', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await box.fill(QWATERFALL);
    await expect(chips(page)).toBeVisible();
    await box.press('Enter');
    await expect(page).toHaveURL(/stroller=any/);
    await expect(page.getByRole('region', { name: 'Not checked yet' })).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});

test.describe('axe', () => {
  for (const theme of THEMES) {
    test(`header search with chips, a question and words not used (${theme})`, async ({ page, site }) => {
      await setTheme(page, theme);
      const box = await openHeader(page, site);
      await box.fill('waterfalls worth the journey in Patagonia');
      await expect(page.getByRole('group', { name: 'Did you mean' })).toBeVisible();
      await page.waitForTimeout(400);
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
    });

    test(`header search with an open popover (${theme})`, async ({ page, site }) => {
      await setTheme(page, theme);
      const box = await openHeader(page, site);
      await box.fill('weekend trip with kids in October');
      await page.getByRole('button', { name: /^With kids: how old is the youngest/ }).first().click();
      await expect(page.getByRole('group', { name: 'Pick the age' })).toBeVisible();
      await page.waitForTimeout(400);
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
    });

    test(`Places with the reading, the undo line and Not checked yet open (${theme})`, async ({ page, site }) => {
      await setTheme(page, theme);
      const box = await list(page, site, '/places/');
      await box.fill(QWATERFALL);
      await expect(chips(page)).toBeVisible();
      await page.waitForTimeout(400);
      let r = await new AxeBuilder({ page }).exclude('.maplibregl-canvas').analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`), 'preview').toEqual([]);
      await box.press('Enter');
      const group = page.getByRole('region', { name: 'Not checked yet' });
      await tap(group.getByRole('button', { name: /^Not checked yet/ }));
      await expect(group.getByRole('heading', { name: /^Stroller/ })).toBeVisible();
      await page.waitForTimeout(500);
      r = await new AxeBuilder({ page }).exclude('.maplibregl-canvas').analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`), 'applied').toEqual([]);
    });
  }
});
