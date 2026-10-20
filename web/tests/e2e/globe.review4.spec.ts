import { expect, test } from './fixtures';

// Review 4 and backlog 3.65, the small globe items: one search placeholder, and the home cue only once a pin is drawn.
test('the globe search has one placeholder at every size', async ({ page, site }) => {
  for (const [width, height] of [[1440, 900], [844, 390], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${site.url}/globe/`);
    await expect(page.getByRole('combobox', { name: 'Search the globe' })).toHaveAttribute('placeholder', 'Search the globe');
  }
});

test('the home cue "Tap a pin" is shown only while a pin is drawn (phone)', async ({ page, site }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${site.url}/`);
  const cue = page.locator('.home-globe-cue');
  // sample until pins appear: at every sample the cue must not be there without a pin
  const deadline = Date.now() + 25_000;
  let withPins = false;
  while (Date.now() < deadline && !withPins) {
    const s = await page.evaluate(() => ({ cue: !!document.querySelector('.home-globe-cue'), pins: !!document.querySelector('.home-globe .globe-pin') }));
    expect(s.cue && !s.pins, 'the cue is up over a globe with no pin').toBe(false);
    withPins = s.pins;
    if (!withPins) await page.waitForTimeout(100);
  }
  expect(withPins, 'pins draw on the cover').toBe(true);
  await expect(cue).toBeVisible();
});
