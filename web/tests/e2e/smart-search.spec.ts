import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expectSlow as expect, settledValue, test } from './fixtures';
import { setTheme, THEMES } from './shots';

// slow-machine settings: a 30 s wait per assertion and 120 s per test (see expectSlow in fixtures.ts)
test.describe.configure({ timeout: 120_000 });

// Smart search phase 1, the UI (backlog 3.43 part B; smart-search.md 6.1, 7 and 12): chips in the header search and in the Places and
// Trips boxes, "Not checked yet", the undo line, the keyboard, a phone, and axe in both themes. Real data, no counts asserted: the
// assertions read the URL the words became and the structure the visitor sees.

const Q1 = 'easy hike with kids near Banff in September';
// September gives no trail in Banff, so the list relaxes it (REVIEW4 4.29); the same words without the month give trails
const QB = 'easy hike with kids near Banff';
const QB_KEYS = { country: 'CA', region: 'alberta', area: 'banff,banff-national-park', k: 'nature.trail', effort: 'stroll,easy' };
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
  const box = page.getByRole('searchbox', { name: path === '/places/' ? 'Search places' : 'Search trips' });
  // the box is plain HTML until the list has hydrated and loaded its rows; text filled before that is lost to the first render. The filter buttons are disabled until then.
  await expect(box).toBeVisible();
  await expect(page.locator('[role="group"][aria-label="Filters"] button[disabled]')).toHaveCount(0);
  return box;
}

/** Puts the caret at the end of the box. The End and Home keys do that on Linux and Windows but not on macOS, where they scroll the page. */
const caretTo = (box: Locator, where: 'start' | 'end') =>
  box.evaluate((el, at) => {
    const input = el as HTMLInputElement;
    input.focus();
    const n = at === 'end' ? input.value.length : 0;
    input.setSelectionRange(n, n);
  }, where);
const caretToEnd = (box: Locator) => caretTo(box, 'end');

test.describe('header search', () => {
  test('query 1 reads as five chips, "Show places" is the first option, and Enter opens the list with the parsed keys', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill(Q1);
    for (const name of ['Remove Trails and walks', 'Remove With kids: how old is the youngest?', 'Remove Banff area, Alberta', 'Remove September', 'Remove Effort: Stroll, Easy']) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
    const first = page.getByRole('option').first();
    await expect(first).toHaveText(/^Show places/);
    await expect(box).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!);
    await box.press('Enter');
    await expect(page).toHaveURL(/\/places\/\?/);
    // the reading gave no rows, so the list relaxes the narrowest chip and says so, instead of an empty state under neat chips
    await expect(page.locator('.smart-relaxed')).toContainText('No match for all 4; showing places that match 3');
    await expect(page.locator('.smart-relaxed')).toContainText('put back September');
    await expect.poll(() => keys(page.url())).toEqual(QB_KEYS);
    await expect(page.getByRole('heading', { name: /^No places match/ })).toHaveCount(0);
    await expect(page.locator('.count .num')).not.toHaveText('0');
  });

  test('"easy hike with kids near Banff" opens trails in Banff and Banff National Park, and asks the age (it gave 0 of 75)', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill(QB);
    await expect(page.getByRole('button', { name: 'Remove Banff area, Alberta' })).toBeVisible();
    await box.press('Enter');
    await expect(page).toHaveURL(/\/places\/\?/);
    expect(keys(page.url())).toEqual(QB_KEYS);
    await expect(page.locator('.count .num')).not.toHaveText('0');
    await expect(page.locator('.smart-relaxed')).toHaveCount(0);
  });

  test('"lake for a 6 year old in the Dolomites" opens lakes across South Tyrol and Veneto (it gave 0 of 10)', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill('lake for a 6 year old in the Dolomites');
    await expect(page.getByRole('button', { name: /^Remove Dolomites range/ })).toBeVisible();
    await box.press('Enter');
    await expect(page).toHaveURL(/k=water\.body/);
    await expect(page.locator('.count .num')).not.toHaveText('0');
    await expect(page.locator('.smart-relaxed')).toHaveCount(0);
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
    await caretToEnd(box);
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
    await caretTo(box, 'start');
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
    await box.fill('waterfalls worth the journey in Kancamagus');
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
    await pop.getByRole('button', { name: 'Youngest child 6' }).click();
    await expect(page.getByRole('option').first()).toHaveAttribute('href', /kid=6/);
    await expect(page.getByRole('option').first()).toHaveAttribute('href', /^\/trips\//);
  });

  test('the other area reading replaces the chip (Auronzo in Veneto or in South Tyrol)', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill('easy hike near Auronzo');
    const chip = page.getByRole('button', { name: /^Auronzo,/ }).first();
    await expect(chip).toBeVisible();
    // the chip is re-created while the reading settles; open the popover once the chip set has stopped changing
    await settledValue(() => chips(page).innerText());
    await chip.click();
    const pop = page.getByRole('group', { name: 'Other readings' });
    await expect(pop).toBeVisible();
    const before = await page.getByRole('option').first().getAttribute('href');
    await pop.getByRole('button').first().click();
    await expect(page.getByRole('option').first()).not.toHaveAttribute('href', before!);
    await expect(page.getByRole('option').first()).toHaveAttribute('href', /area=auronzo/);
  });

  test('the cover search on the home page opens the same reading', async ({ page, site }) => {
    await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Search trips, places and countries/ }).click();
    await page.getByRole('combobox', { name: 'Search trips, places and areas' }).fill(Q1);
    await expect(page.getByRole('button', { name: 'Remove Trails and walks' })).toBeVisible();
  });

  test('chip popover Esc closes the popover first and keeps the dialog', async ({ page, site }) => {
    const box = await openHeader(page, site);
    await box.fill('easy hike near Auronzo');
    await page.getByRole('button', { name: /^Auronzo,/ }).first().click();
    await expect(page.getByRole('group', { name: 'Other readings' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('group', { name: 'Other readings' })).toHaveCount(0);
    await expect(box).toHaveValue('easy hike near Auronzo');
  });
});

test.describe('the Places and Trips search boxes', () => {
  test('Places: Enter applies the reading, the undo line brings the words back, Esc does the same', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await box.fill(QB);
    await expect(chips(page)).toBeVisible();
    await expect(page.getByText(/Enter.*shows/)).toBeVisible();
    await box.press('Enter');
    await expect(page).toHaveURL(/country=CA/);
    expect(keys(page.url())).toEqual(QB_KEYS);
    const note = page.locator('.smart-undo');
    await expect(note).toContainText(/as 3 filters/);
    await expect(box).toHaveValue('');
    // undo with the button
    await note.getByRole('button', { name: /^Search the words instead|^Undo/ }).click();
    await expect(box).toHaveValue(QB);
    expect(keys(page.url())).toEqual({ q: QB });
    // apply again and undo with Esc
    await box.press('Enter');
    await expect(page).toHaveURL(/country=CA/);
    await box.focus();
    await box.press('Escape');
    await expect(box).toHaveValue(QB);
    expect(keys(page.url())).toEqual({ q: QB });
  });

  test('Places: Backspace at the start of the box removes the last chip before Enter', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await box.fill(Q1);
    await expect(page.locator('.qchip')).toHaveCount(5);
    await caretTo(box, 'start');
    await box.press('Backspace');
    await expect(page.locator('.qchip')).toHaveCount(4);
    await box.press('Enter');
    await expect(page).toHaveURL(/country=CA/);
    const k = keys(page.url());
    expect(k.season).toBeUndefined();
    expect(Object.keys(k)).toHaveLength(5);
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
    // the rows' text is empty while the group is still opening (WebKit): read the names once every row has its text
    const names = await settledValue<string[]>(async () => {
      const all = await group.locator('.unchecked-row a, .unchecked-row b').allInnerTexts();
      return (all.every((n) => n.trim()) ? all : undefined) as string[];
    });
    expect(names.length).toBeGreaterThan(0);
    // no row of the group is a card of the main results
    for (const n of names) await expect(page.locator('.results .card').filter({ hasText: n })).toHaveCount(0);
    // the count line and the group agree on the word "stroller"
    await expect(page.locator('.smart-undo')).toBeVisible();
  });

  test('Places: a reading that gives nothing is relaxed, says what it relaxed, and the chip can be put back', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await box.fill(Q1);
    await expect(page.getByText(/Enter.*shows \d+ places? that match 3 of 4/)).toBeVisible();
    await box.press('Enter');
    const relaxed = page.locator('.smart-relaxed');
    await expect(relaxed).toContainText('No match for all 4; showing places that match 3');
    await expect(page.getByRole('heading', { name: 'No places match all of this' })).toHaveCount(0);
    expect(keys(page.url()).season).toBeUndefined();
    // putting the chip back is the visitor's choice: the honest empty answer then returns
    await tap(relaxed.getByRole('button', { name: 'put back September' }));
    await expect(page).toHaveURL(/season=9/);
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
    await page.getByRole('group', { name: 'Pick the age' }).getByRole('button', { name: 'Youngest child 6' }).click();
    await expect(page).toHaveURL(/kid=6/);
  });

  test('a filter changed by hand ends the undo line: the reading is no longer the visitor\'s to undo', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await box.fill(QWATERFALL);
    await box.press('Enter');
    await expect(page.locator('.smart-undo')).toBeVisible();
    // one control per filter at each width: the pill's clear button from 640 px up, the chip's remove button on a phone
    const phone = (page.viewportSize()?.width ?? 0) < 640;
    const kind = phone ? page.getByRole('list', { name: 'Active filters' }).getByRole('button', { name: /^Remove filter Kind:/ }) : page.getByRole('button', { name: 'Clear Kind filter' });
    await expect(kind).toBeVisible();
    if (phone) {
      const box = await kind.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(40);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    }
    await kind.click();
    await expect(page).not.toHaveURL(/[?&]k=/);
    await expect(page.locator('.smart-row')).not.toHaveAttribute('data-open', '');
  });
});

test.describe('review SQ1b: must-fixes', () => {
  test('M1: while the reading shows, the list is held, not filtered by the sentence', async ({ page, site }) => {
    const box = await list(page, site, '/places/');
    await expect(page.locator('.count .num')).toBeVisible();
    const before = await page.locator('.count .num').innerText();
    await box.fill(Q1);
    await expect(chips(page)).toBeVisible();
    await expect(page.getByText(/Enter.*shows \d+ places?/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /^No places match/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Clear all' })).toHaveCount(0);
    await expect(page.locator('.count .num')).toHaveText(before);
    await expect(page.locator('.count .of')).toHaveCount(0);
  });

  test('M2: values no row carries still read as names in the filter bar', async ({ page, site }) => {
    // a link with a month no hot spring carries: the pills and chips name it, never its code (a parse would relax it away, 4.29)
    await page.goto(`${site.url}/places/?k=water.thermal.hot_spring&country=IS&season=12&effort=easy`, { waitUntil: 'networkidle' });
    const bar = page.getByRole('list', { name: 'Active filters' });
    const buttons = page.getByRole('group', { name: 'Filters' });
    if ((page.viewportSize()?.width ?? 0) >= 640) {
      await expect(buttons).toContainText('Hot spring');
      await expect(buttons).toContainText('Dec');
    }
    await expect(bar).not.toContainText('water.thermal');
    await expect(bar).not.toContainText(/Season: \d/);
    // the hot spring reading itself gives rows and is applied as it was read
    const box = page.getByRole('searchbox', { name: 'Search places' });
    await page.goto(`${site.url}/places/`, { waitUntil: 'networkidle' });
    await box.fill('hot springs in Iceland');
    await expect(chips(page)).toBeVisible();
    await box.press('Enter');
    await expect(page).toHaveURL(/k=water\.thermal\.hot_spring/);
  });

  test('M2 round 3: the facet buttons of the desktop bar read as names, after a parse and from a direct link', async ({ page, site }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'the facet buttons are the desktop bar');
    const box = await list(page, site, '/places/');
    await box.fill('hot springs in Iceland in winter');
    await expect(chips(page)).toBeVisible();
    await box.press('Enter');
    // no hot spring is listed for winter, so the reading relaxes the month and says so; the buttons still read as names
    await expect(page).toHaveURL(/k=water\.thermal\.hot_spring/);
    const buttons = page.getByRole('group', { name: 'Filters' });
    await expect(buttons).toContainText('Hot spring');
    await expect(buttons).not.toContainText('water.thermal');
    await expect(buttons).not.toContainText(/Season\s*·\s*\d/);
    await page.goto(`${site.url}/places/?k=water.thermal.hot_spring&season=12`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('group', { name: 'Filters' })).toContainText('Hot spring');
    await expect(page.getByRole('group', { name: 'Filters' })).not.toContainText('water.thermal');
  });

  test('M4: on Trips, "with kids" and Enter ask the age, and never fall back to a text search', async ({ page, site }) => {
    const box = await list(page, site, '/trips/');
    await box.fill('trip with kids');
    await expect(page.getByRole('button', { name: /^With kids: how old is the youngest/ })).toBeVisible();
    await box.press('Enter');
    const pop = page.getByRole('group', { name: 'Pick the age' });
    await expect(pop).toBeVisible();
    await expect(pop.getByRole('button')).toHaveText(['Youngest child Baby', 'Youngest child 3', 'Youngest child 6', 'Youngest child 9', 'Youngest child 12']);
    await expect(page.getByRole('heading', { name: /^No trips match/ })).toHaveCount(0);
    await pop.getByRole('button', { name: 'Youngest child 9' }).click();
    await box.press('Enter');
    await expect(page).toHaveURL(/kid=9/);
  });

  test.describe('M3 at 390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    test('the sticky bar stays at most 35% of the screen with three parsed filters, and the undo line is one line below it', async ({ page, site }) => {
      const box = await list(page, site, '/places/');
      await box.fill('moderate hike with 500 m climb');
      await expect(chips(page)).toBeVisible();
      const typing = await page.locator('.filter-sticky').evaluate((el) => el.getBoundingClientRect().height);
      expect(typing / 844, 'while typing').toBeLessThanOrEqual(0.35);
      await box.press('Enter');
      await expect(page).toHaveURL(/f\.climb=400-800/);
      const note = page.locator('.smart-slot').getByRole('status');
      await expect(note).toHaveText(/^Read as 3 filters\s*Undo$/);
      const h = await page.locator('.filter-sticky').evaluate((el) => el.getBoundingClientRect().height);
      expect(h / 844, `sticky bar ${h}px`).toBeLessThanOrEqual(0.35);
      expect(await note.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(60);
      await note.getByRole('button', { name: /^Undo/ }).click();
      await expect(box).toHaveValue('moderate hike with 500 m climb');
    });
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
      await box.fill('waterfalls worth the journey in Kancamagus');
      await expect(page.getByRole('group', { name: 'Did you mean' })).toBeVisible({ timeout: 30_000 });
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
