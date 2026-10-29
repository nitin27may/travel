// The real builder driven to Build my days (STEP2-B1); shared by t-built.spec.ts. Not a spec.
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function allowHttpBuild(page: Page) {
  await page.route('**/api/v1/plan/build/', async (route) => {
    const headers = { ...route.request().headers() };
    delete headers.origin;
    delete headers.referer;
    await route.fulfill({ response: await route.fetch({ headers }) });
  });
}

/** The real builder, a week by air to Canada with two picks, to Build my days; ends on the trip's page. Returns its id. */
export async function buildByAir(page: Page, site: { url: string }): Promise<string> {
  await allowHttpBuild(page);
  await page.goto(`${site.url}/plan/`);
  await page.getByRole('button', { name: /^A week by air/ }).click();
  await expect(page.getByText('Flying from')).toBeVisible();
  await page.getByRole('button', { name: /Next: Where/ }).filter({ visible: true }).click();
  await page.getByLabel('Country').selectOption('CA');
  await page.locator('.region-row input[type="checkbox"]:not([disabled])').first().check({ force: true });
  await page.getByRole('button', { name: /Next: Pick/ }).filter({ visible: true }).click();
  await expect(page.locator('.cand').first()).toBeVisible({ timeout: 20_000 });
  await page.locator('.pick-btn').nth(0).click();
  await page.locator('.pick-btn').nth(1).click();
  await page.locator('.pick-btn').nth(2).click();
  await expect(page.locator('.pick-btn[aria-pressed="true"]')).toHaveCount(3);
  await page.getByRole('button', { name: /Next: Days/ }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Days and driving' })).toBeVisible();
  await page.getByRole('button', { name: /^Build my days/ }).filter({ visible: true }).click();
  await page.waitForURL(/\/t\/[0-9a-f-]{36}\//, { timeout: 60_000 });
  return /\/t\/([0-9a-f-]{36})\//.exec(page.url())![1]!;
}

