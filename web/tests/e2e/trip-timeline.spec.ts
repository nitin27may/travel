import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { openParty } from './party';

const ROCKIES = '/trips/canadian-rockies-2029/';
const MARKER = /\b(INFERENCE|CALC|GAP)\b|low confidence/;
const FULL = ['canadian-rockies-2029', 'dolomites-2027', 'patagonia-2027', 'iceland-ring-road-2027', 'utah-five-parks', 'algonquin-muskoka-2026', 'vermont-fall-2026', 'chamonix-mont-blanc-2028'];

test.describe('trip timeline (L3c)', () => {
  test('every full and summary trip has the profile, the whole-trip view and a timeline per day; an overview trip has none (check 2)', async ({ page, site }) => {
    for (const slug of FULL) {
      await page.goto(`${site.url}/trips/${slug}/`);
      await expect(page.locator('#plan-for'), slug).toBeVisible();
      await expect(page.locator('#trip-shape'), slug).toBeVisible(); // the whole-trip view (the shape) is in the Summary
      await page.getByRole('tab', { name: /^Days/ }).click();
      const days = await page.locator('li.tl-day').count();
      expect(days, slug).toBeGreaterThan(2);
      await page.getByRole('tab', { name: /^Summary/ }).click();
      await page.locator('#trip-shape .shape-toggle').click();
      await expect(page.locator('#trip-shape tbody tr.shape-row'), slug).toHaveCount(days);
      await page.getByRole('tab', { name: /^Days/ }).click();
      await expect(page.locator('li.tl-day').first().locator('.tl-time').first(), slug).toBeVisible();
    }
    await page.goto(`${site.url}/trips/switzerland-2027/`);
    await expect(page.locator('#plan-for')).toHaveCount(0);
    await expect(page.locator('li.tl-day')).toHaveCount(0);
    await expect(page.getByText(/This plan has not been converted to days yet\./)).toBeVisible();
  });

  test('the "Suggested times" banner is present once, and the page is free of research markers (checks 7, 9)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(page.getByText('Suggested times.')).toHaveCount(1);
    expect(await page.content()).not.toMatch(MARKER);
    expect(await page.locator('main').innerText()).not.toMatch(MARKER);
    await expect(page.locator('#day-5 .tl-time[data-conf="fixed"]').first()).toBeVisible();
    await expect(page.locator('#day-5').getByText('Slot').first()).toBeVisible();
    await expect(page.locator('#day-5 .tl-time[data-conf="anchored"]').first()).toContainText('about');
    await expect(page.locator('#day-1')).toContainText('about 19:');
  });

  test('profile picks the version of each day (checks 3, 12)', async ({ page, site }) => {
    const chip = (n: number) => page.locator(`#day-${n}`).getByRole('button', { name: new RegExp(`Version of Day ${n}:`) });
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    for (const n of [2, 5, 9]) await expect(chip(n)).toContainText('Whole family');
    await expect(page.locator('#day-5 .tl-split')).toContainText('Split option');
    await page.goto(`${site.url}${ROCKIES}?p=adults&view=day`);
    await expect(chip(5)).toContainText("Adults' hike");
    await expect(page.locator('#day-5 .tl-split')).toHaveCount(0);
    await page.goto(`${site.url}${ROCKIES}?p=family-14&view=day`);
    await expect(chip(5)).toContainText("Adults' hike");
    // no-fit: a Dolomites day with a long walk for a young child
    await page.goto(`${site.url}/trips/dolomites-2027/?p=family-4#day-3`);
    await expect(page.locator('#day-3 .tl-nofit')).toContainText('we plan walks up to 4 km at age 4');
  });

  test('split=1 draws two lanes that rejoin; a=1 removes the option (check 4)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?split=1#day-5`);
    await expect(page.locator('#day-5 .tl-rail')).toHaveAttribute('data-lanes', '2');
    await expect(page.locator('#day-5 .tl-title', { hasText: 'Together again at the Maligne Lake boathouse car park' })).toBeVisible();
    await expect(page.locator('#day-5 [data-lane="A"]').first()).toBeVisible();
    await page.goto(`${site.url}${ROCKIES}?a=1&split=1#day-5`);
    await expect(page.locator('#day-5 .tl-rail')).toHaveAttribute('data-lanes', '1');
    await expect(page.locator('#day-5 .tl-split')).toHaveCount(0);
  });

  test('Show both lanes draws two headed lanes and a Together again band (round two)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}#day-5`);
    await page.locator('#day-5').getByRole('button', { name: 'Show both lanes' }).click();
    await expect(page).toHaveURL(/split=1/);
    await expect(page.locator('#day-5 .tl-lane-name')).toHaveCount(2);
    await expect(page.locator('#day-5 .tl-lane-name').last()).toContainText('The stronger walkers: Bald Hills');
    await expect(page.locator('#day-5 .tl-entry[data-band]')).toContainText('Together again');
    await page.locator('#day-5').getByRole('button', { name: 'Show one lane' }).click();
    await expect(page).not.toHaveURL(/split=1/);
  });

  test('a condensed plan shows parts of the day and its flight, with no invented drives (round two)', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/patagonia-2027/#day-2`);
    const d2 = page.locator('#day-2');
    await expect(d2.locator('.tl-time').first()).toHaveText('Morning');
    await expect(d2).toContainText('Flight to Ushuaia');
    await expect(d2.locator('.tl-leg')).toHaveCount(0);
    await expect(page.getByText('Parts of the day.')).toHaveCount(1);
  });

  test('the adults version of Day 5 is titled for itself; the research words are gone (round two)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?p=adults#day-5`);
    await expect(page.locator('#day-5 .tl-day-title')).toHaveText('Bald Hills');
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    expect(await page.locator('main').innerText()).not.toMatch(/\bdataset\b|trail id|audience '/i);
  });

  test('a day can be swapped, says so, and resets (check 5)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?d=5C#day-5`);
    await expect(page.locator('#day-5').getByText('Changed for this day')).toBeVisible();
    await openParty(page);
    await expect(page.getByTestId('profile-line')).toContainText('1 day changed');
    await page.locator('#day-5').getByRole('button', { name: 'Reset' }).click();
    await expect(page).not.toHaveURL(/d=5C/);
    await expect(page.locator('#day-5').getByText('Changed for this day')).toHaveCount(0);
  });

  test('the version chip is a menu that picks a version for one day (check 5)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}#day-2`);
    await page.locator('#day-2').getByRole('button', { name: /Version of Day 2/ }).click();
    await page.getByRole('menuitem', { name: /Easy day/ }).click();
    await expect(page).toHaveURL(/d=2C/);
    await expect(page.locator('#day-2').getByText('Changed for this day')).toBeVisible();
    await expect(page.locator('#day-5').getByText('Changed for this day')).toHaveCount(0);
  });

  test('Back and Forward restore the profile; the keys follow the codec order (check 12)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await openParty(page);
    await page.getByRole('radio', { name: 'Relaxed' }).click();
    await expect(page).toHaveURL(/\?pace=relaxed/);
    // one editing session is one history entry (review UXB-2 S2): Done and Edit again start the next
    await page.locator('#plan-for .pb-edit').click();
    await openParty(page);
    await page.getByRole('button', { name: 'Fewer children' }).click();
    await expect(page).toHaveURL(/\?p=adults&pace=relaxed/);
    await page.goBack();
    await expect(page).toHaveURL(/\?pace=relaxed&view=day$/);
    await expect(page.getByRole('radio', { name: 'Relaxed' })).toBeChecked();
    await page.goBack();
    await expect(page).not.toHaveURL(/pace=/);
    await expect(page.getByRole('radio', { name: 'Standard' })).toBeChecked();
    await page.goForward();
    await expect(page.getByRole('radio', { name: 'Relaxed' })).toBeChecked();
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Relaxed' })).toBeChecked();
  });

  test('add and remove a place on a day: re-flows, marks it, survives reload (check 6)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}#day-5`);
    const day = page.locator('#day-5');
    await day.getByRole('button', { name: /Add a place to Day 5/ }).click();
    // The panel offers the 8 nearest places and the catalogue keeps growing (D2b-INT), so the test takes the nearest one whose cost is
    // worked out and fits, not a named place that a nearer one can push out of the eight (Athabasca Falls Walk was). Waiting for a cost
    // also waits for the lazily loaded panel.
    await day.locator('.tl-add-item:has(.tl-add-cost[data-state="ok"])').first().click();
    await expect(page).toHaveURL(/add=5\.[a-z0-9-]+/);
    const key = new URL(page.url()).searchParams.get('add')!.replace(/^5\./, '');
    await expect(day.getByText('You added this')).toBeVisible();
    await expect(day.locator(`#entry-5-add-${key}, .tl-entry[data-added]`).first()).toBeVisible();
    // the fixed slot stays
    await expect(day.locator('#entry-5-maligne-lake-cruise .tl-time')).toHaveText('10:00');
    await page.reload();
    await expect(page.locator('#day-5').getByText('You added this')).toBeVisible();
    const added = page.locator('#day-5 .tl-entry[data-added]').first();
    await added.getByRole('button', { name: 'Why this time' }).click();
    await added.getByRole('button', { name: 'Remove from this day' }).click();
    await expect(page).not.toHaveURL(/add=/);
    await expect(page.locator('#day-5').getByText('You added this')).toHaveCount(0);
  });

  test('Dolomites Day 3 keeps its times and shows routed legs without an estimate mark; Rockies legs are estimates (check 8)', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/dolomites-2027/#day-3`);
    const d3 = page.locator('#day-3');
    await expect(d3.locator('.tl-entry', { hasText: 'Tre Cime di Lavaredo loop' }).locator('.tl-time').first()).toHaveText('11:30');
    await expect(d3.locator('.tl-entry', { hasText: 'Cadini di Misurina viewpoint' }).locator('.tl-time').first()).toHaveText('16:30');
    await expect(d3.locator('.tl-leg').first()).toBeVisible();
    // the drives are routed; the walk from the car park to the Tre Cime trailhead is the rule's 10 minutes, drawn (SW-022) and marked ≈
    await expect(d3.locator('.tl-leg[data-mode="drive"] .tl-est')).toHaveCount(0);
    await expect(d3.locator('.tl-leg[data-mode="walk"]', { hasText: 'to the start of Tre Cime di Lavaredo loop' })).toHaveCount(1);
    await expect(d3.locator('.tl-entry', { hasText: 'Free time' })).toBeVisible();
    await expect(d3).toContainText('1 h 40 driving');
    await page.goto(`${site.url}${ROCKIES}#day-5`);
    await expect(page.locator('#day-5 .tl-leg .tl-est').first()).toBeVisible();
  });

  test('units: with miles chosen, notes and item lines agree (check 10)', async ({ page, site }) => {
    await page.addInitScript(() => localStorage.setItem('travel:v1:prefs', JSON.stringify({ distance: 'mi', elevation: 'ft', temperature: 'F', currency: 'USD', density: 'comfortable' })));
    await page.goto(`${site.url}${ROCKIES}#day-3`);
    await expect.poll(async () => (await page.locator('#day-3').innerText()).match(/\d mi\b/) !== null).toBe(true);
    const text = await page.locator('#day-3').innerText();
    expect(text).not.toMatch(/\d km\b/);
    expect(text).not.toMatch(/\d m up/);
    expect(text).not.toMatch(/\d m\)/);
  });

  test('Know before you go groups the notes in the fixed order, three at first (check 11)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}#day-5`);
    await page.locator('#day-5').getByRole('button', { name: /Know before you go/ }).click();
    const heads = await page.locator('#know-5 .tl-know-h').allInnerTexts();
    expect(heads.length).toBeGreaterThan(0);
    const order = ['Book', 'Getting there', 'With kids', 'Conditions', 'Decide on the day', 'If it rains', 'Other'];
    expect(heads.map((h) => order.indexOf(h))).toEqual([...heads.map((h) => order.indexOf(h))].sort((a, b) => a - b));
    expect(await page.locator('#know-5 li').count()).toBe(3);
    await page.locator('#know-5').getByRole('button', { name: /more$/ }).click();
    expect(await page.locator('#know-5 li').count()).toBeGreaterThan(3);
  });

  test('phone: the profile is a line with Edit, opens inline, no horizontal scroll (check 17)', async ({ page, site }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${site.url}${ROCKIES}?view=day`);
    await expect(page.getByTestId('party-line')).toBeVisible();
    await expect(page.locator('#plan-for-controls')).toBeHidden();
    await page.locator('.pb-edit').click();
    await expect(page.locator('#plan-for-controls .pe')).toBeVisible();
    await page.getByRole('radio', { name: 'Full' }).click();
    await expect(page).toHaveURL(/pace=full/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto(`${site.url}${ROCKIES}?split=1#day-5`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('axe is clean with the panel open and closed (check 17)', async ({ page, site }) => {
    for (const size of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto(`${site.url}${ROCKIES}?view=day`);
      await page.waitForTimeout(500);
      const run = async (label: string) => {
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('[data-map-family]').analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 90)}`), `${size.width} ${label}`).toEqual([]);
      };
      await run('closed');
      await openParty(page);
      await page.locator('#plan-for .tl-more').click();
      await run('open');
    }
  });

  test('the timeline reads in order: an ordered list per day with time, kind, title in each entry (check 17)', async ({ page, site }) => {
    await page.goto(`${site.url}${ROCKIES}#day-5`);
    const rail = page.locator('#day-5 ol.tl-rail');
    expect(await rail.evaluate((el) => el.tagName)).toBe('OL');
    const spoken = await rail.locator('.tl-entry .sr-only').first().innerText();
    expect(spoken).toMatch(/^\d\d:\d\d, (suggested|fixed|tied to the sun), [a-z-]+, /);
  });
});
