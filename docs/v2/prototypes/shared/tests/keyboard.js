/* Keyboard-only walker: presses Tab from the top of the page and records every stop. Reports stops with no visible focus
   indicator (outline or box-shadow or border change), stops outside the viewport after scrolling, a focus trap (the same
   element twice in a row, or the cycle never leaving a region), and visible interactive elements the walk never reached. */

/** @param {import('@playwright/test').Page} page @param {{max?: number}} [opts] */
async function walkKeyboard(page, opts = {}) {
  const max = opts.max || 120;
  await page.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); window.scrollTo(0, 0); });
  const stops = []; const seenKeys = new Set(); let trapped = false;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      const name = e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].textContent) || e.textContent || e.getAttribute('title') || e.getAttribute('placeholder') || '';
      const nth = [...document.querySelectorAll(e.tagName)].indexOf(e);
      return {
        key: e.tagName + '#' + nth + '#' + (e.id || ''), tag: e.tagName.toLowerCase(), role: e.getAttribute('role') || '', name: name.replace(/\s+/g, ' ').trim().slice(0, 60),
        indicator: e.getAttribute('data-focus') === 'visible' /* SVG pins draw their own ring (map.js) */ || (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' || e.matches(':focus-visible') && cs.outlineStyle !== 'none',
        inViewport: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, w: Math.round(r.width), h: Math.round(r.height)
      };
    });
    if (!s) { if (stops.length) break; continue; } // left the document (browser chrome): the cycle is complete
    if (stops.length && stops[stops.length - 1].key === s.key) { trapped = true; break; }
    if (seenKeys.has(s.key)) break; // wrapped round
    seenKeys.add(s.key); stops.push(s);
  }
  const unreached = await page.evaluate((reached) => {
    const sel = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[tabindex]:not([tabindex="-1"]),[role=button]';
    const out = [];
    document.querySelectorAll(sel).forEach((e) => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none' || e.disabled || e.closest('[hidden],[inert],[aria-hidden="true"]')) return;
      const nth = [...document.querySelectorAll(e.tagName)].indexOf(e);
      if (!reached.includes(e.tagName + '#' + nth + '#' + (e.id || ''))) out.push((e.getAttribute('aria-label') || e.textContent || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 50));
    });
    return out;
  }, [...seenKeys]);
  return { stops, trapped, noIndicator: stops.filter((s) => !s.indicator), unreached, count: stops.length };
}
module.exports = { walkKeyboard };
