/* Plan 1B: "Ask us for more" opens a request sheet (place or region, note), writes proto.requests through shared/contract.js
   and shows Requested, Researching or Added chips in the pick list. */
const { test, expect } = require('../../shared/tests/fixtures.js');

async function toPickList(page, base) {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => { U.ctx = null; chooseKind('weekend'); S.stage = 3; render(); });
}

test('ask: the sheet needs a name, then saves a Requested request that survives a reload', async ({ page, base }) => {
  await toPickList(page, base);
  await page.getByRole('button', { name: 'Not here? Ask us for more' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('heading', { name: 'Ask us for more' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Send request' }).click();
  await expect(dlg.getByRole('alert')).toContainText('Add a place name first');
  await dlg.getByRole('button', { name: 'A region' }).click();
  await dlg.getByLabel('Region or area').fill('Lofoten');
  await dlg.getByLabel('Note (optional)').fill('For a week in March');
  await dlg.getByRole('button', { name: 'Send request' }).click();
  await dlg.getByRole('button', { name: 'Done' }).click();
  const row = page.locator('[data-req]').filter({ hasText: 'Lofoten' });
  await expect(row).toBeVisible();
  await expect(row.locator('.chip[data-status="Requested"]')).toHaveText('Requested');
  await expect(row).toContainText('Region');
  await expect(row).toContainText('For a week in March');
  const stored = await page.evaluate(() => ({ raw: JSON.parse(localStorage.getItem('proto.requests')), valid: ProtoContract.readRequests(localStorage).map((r) => ProtoContract.validateRequest(r).length) }));
  expect(stored.raw).toHaveLength(1);
  expect(stored.raw[0]).toMatchObject({ kind: 'region', name: 'Lofoten', status: 'Requested' });
  expect(stored.valid).toEqual([0]);
  await page.reload();
  await page.evaluate(() => { S.stage = 3; render(); });
  await expect(page.locator('[data-req]').filter({ hasText: 'Lofoten' })).toBeVisible();
});

test('ask: the status chips advance Requested, Researching, Added with the prototype control and show in the pick list', async ({ page, base }) => {
  await toPickList(page, base);
  await page.evaluate(() => { ProtoContract.addRequest(localStorage, { kind: 'place', name: 'Old Mill viewpoint', note: '' }); render(); });
  const row = page.locator('[data-req]').filter({ hasText: 'Old Mill viewpoint' });
  await expect(row.locator('.chip')).toHaveText('Requested');
  await page.getByRole('button', { name: 'Not here? Ask us for more' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText(/"Next status" is a prototype control/)).toBeVisible();
  const next = dlg.getByRole('button', { name: /Advance the status of Old Mill viewpoint/ });
  await next.click();
  await expect(row.locator('.chip')).toHaveText('Researching');
  await next.click();
  await expect(row.locator('.chip')).toHaveText('Added');
  await expect(row).toContainText('Now in our list');
  await next.click();
  await expect(row.locator('.chip')).toHaveText('Requested'); // the prototype control cycles
  expect(await page.evaluate(() => ProtoContract.readRequests(localStorage)[0].status)).toBe('Requested');
});

test('ask: the thin-count link, a region without places and "Somewhere else" all open the same request sheet', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => { U.ctx = null; chooseKind('weekair'); S.stage = 2; render(); });
  await page.getByRole('button', { name: /Somewhere else/ }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Ask us for more' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await page.evaluate(() => { A.country('IT'); A.macro('south'); });
  await page.getByRole('checkbox', { name: /Puglia/ }).click();
  await expect(page.getByRole('dialog').getByLabel('Region or area')).toHaveValue('Puglia');
});

test('ask: invalid saved data never breaks the pick list (bad JSON reads as none)', async ({ page, base }) => {
  await page.goto(base + '/builder/?fast');
  await page.evaluate(() => { localStorage.setItem('proto.requests', '{not json'); U.ctx = null; chooseKind('weekend'); S.stage = 3; render(); });
  await expect(page.getByRole('button', { name: 'Not here? Ask us for more' })).toBeVisible();
  await expect(page.locator('[data-req]')).toHaveCount(0);
});
