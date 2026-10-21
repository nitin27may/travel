import { expectSlow as expect, settledValue, test } from './fixtures';

// slow-machine settings: a 30 s wait per assertion and 120 s per test (see expectSlow in fixtures.ts)
test.describe.configure({ timeout: 120_000 });

test.describe('Who it suits (S1b)', () => {
  test('shows the chip row as a named list, a research line, and groups that open', async ({ page, site }) => {
    await page.goto(`${site.url}/places/larch-valley-to-sentinel-pass/`);
    const chips = page.getByRole('list', { name: 'Who it suits' }).first();
    await expect(chips.locator('li')).not.toHaveCount(0);
    await expect(page.locator('#suits .ps-meta')).toContainText(/\d+ of \d+ key checks/);
    const group = page.locator('#suits details.su-group[data-group="effort"]');
    await expect(group).not.toHaveAttribute('open', '');
    await group.locator(':scope > summary').click();
    await expect(group).toHaveAttribute('open', '');
    await expect(group.locator('.sr').first()).toBeVisible();
  });

  test('a row with a source opens its provenance, and the chip text never carries an FE code', async ({ page, site }) => {
    await page.goto(`${site.url}/places/larch-valley-to-sentinel-pass/`);
    expect(await page.locator('#suits').innerText()).not.toMatch(/\bFE[1-5]\b/);
    const row = page.locator('#suits details.sr').first();
    await row.locator(':scope > summary').click();
    await expect(row.locator('.sp')).toBeVisible();
  });

  test('the timeline entry chips follow the party in the URL', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/canadian-rockies-2029/?p=family-3#day-5`);
    await expect(page.locator('#day-5 .ch[data-kind="advice_fail"], #day-5 .ch[data-kind="fits"]').first()).toBeVisible();
  });

  test('place cards carry the kids chip and at most one relevance chip', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?q=lake%20louise`);
    const card = page.locator('article.card').filter({ has: page.getByRole('heading', { name: 'Lake Louise', exact: true }) });
    await expect(card.locator('.badge-wrap[data-value="relevance"]')).toHaveCount(1);
    await expect(card.locator('.badge-wrap[data-tone="kid"], .badge-wrap[data-value="gap"]').first()).toBeVisible();
  });

  test('a day says the same thing in its line, its title and its version button (verifier 2)', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/canadian-rockies-2029/?p=family-3#day-5`);
    const line = page.locator('#day-5 .tl-reason').first();
    await expect(line).toBeVisible();
    // the line, its title and the button label are rewritten together when the party applies: read the three from one settled state, compare once
    const { text, title, aria } = await settledValue(async () => ({
      text: ((await line.innerText()) ?? '').trim(),
      title: await line.getAttribute('title'),
      aria: await page.locator('#day-5 [aria-label^="Version of Day 5"]').first().getAttribute('aria-label'),
    }));
    expect(title).toBe(text);
    expect(aria).toContain(text);
    if (/Not suited/.test(text)) expect(`${text} ${aria}`).not.toMatch(/\bfits age\b(?! \d+ where checked)/);
  });
});
