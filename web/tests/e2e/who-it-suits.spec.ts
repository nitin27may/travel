import { expect, test } from './fixtures';

test.describe('Who it suits (S1b)', () => {
  test('shows the chip row as a named list, a research line, and groups that open', async ({ page, site }) => {
    await page.goto(`${site.url}/places/larch-valley-to-sentinel-pass/`);
    const chips = page.getByRole('list', { name: 'Who it suits' }).first();
    await expect(chips.locator('li')).not.toHaveCount(0);
    await expect(page.locator('#suits .ps-meta')).toContainText(/\d+ of \d+ family checks done/);
    const group = page.locator('#suits details.su-group[data-group="effort"]');
    await expect(group).not.toHaveAttribute('open', '');
    await group.locator(':scope > summary').click();
    await expect(group).toHaveAttribute('open', '');
    await expect(group.locator('.su-row').first()).toBeVisible();
  });

  test('a row with a source opens its provenance, and the chip text never carries an FE code', async ({ page, site }) => {
    await page.goto(`${site.url}/places/larch-valley-to-sentinel-pass/`);
    expect(await page.locator('#suits').innerText()).not.toMatch(/\bFE[1-5]\b/);
    const row = page.locator('#suits details.su-row').first();
    await row.locator(':scope > summary').click();
    await expect(row.locator('.su-pop')).toBeVisible();
  });

  test('the timeline entry chips follow the party in the URL', async ({ page, site }) => {
    await page.goto(`${site.url}/trips/canadian-rockies-2029/?p=family-3#day-5`);
    await expect(page.locator('#day-5 .su-chip[data-kind="advice_fail"], #day-5 .su-chip[data-kind="fits"]').first()).toBeVisible();
  });

  test('place cards carry the kids chip and at most one relevance chip', async ({ page, site }) => {
    await page.goto(`${site.url}/places/?q=lake%20louise`);
    const card = page.locator('article.card').filter({ has: page.getByRole('heading', { name: 'Lake Louise', exact: true }) });
    await expect(card.locator('.badge-wrap[data-value="relevance"]')).toHaveCount(1);
    await expect(card.locator('.badge-wrap[data-tone="kid"], .badge-wrap[data-value="gap"]').first()).toBeVisible();
  });
});
