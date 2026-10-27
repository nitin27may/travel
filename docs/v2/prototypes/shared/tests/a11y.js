/* Accessibility-tree dump per page: Playwright's aria snapshot (the getByRole tree) plus a list of interactive elements
   with no accessible name. Dumps are written to test-results so a reviewer can read what a screen reader would. */
const fs = require('node:fs');
const path = require('node:path');

/** @param {import('@playwright/test').Page} page */
async function dumpA11y(page, outFile) {
  const snapshot = await page.locator('body').ariaSnapshot();
  const unnamed = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=switch],[role=tab],[role=checkbox]').forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || getComputedStyle(e).visibility === 'hidden' || e.closest('[hidden],[aria-hidden="true"]')) return;
      const lb = e.getAttribute('aria-labelledby');
      const name = e.getAttribute('aria-label') || (lb && lb.split(' ').map((i) => (document.getElementById(i) || {}).textContent || '').join(' ')) || (e.labels && e.labels.length && e.labels[0].textContent) || e.textContent || e.getAttribute('title') || e.getAttribute('alt') || (e.querySelector && e.querySelector('img[alt]') && e.querySelector('img[alt]').alt) || '';
      if (!name.trim()) out.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''));
    });
    return out;
  });
  if (outFile) { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, snapshot + '\n\nUNNAMED CONTROLS: ' + (unnamed.length ? '\n' + unnamed.join('\n') : 'none') + '\n'); }
  return { snapshot, unnamed };
}
module.exports = { dumpA11y };
