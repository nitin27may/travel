import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Opens the party editor from the bar's Edit button and waits for its lazy chunk (controls drawn). */
export async function openParty(page: Page): Promise<void> {
  const edit = page.locator('#plan-for .pb-edit');
  if ((await edit.getAttribute('aria-expanded')) !== 'true') await edit.click();
  await expect(page.locator('#plan-for-controls .pe')).toBeVisible();
}
