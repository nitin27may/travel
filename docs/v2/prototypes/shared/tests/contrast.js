/* Contrast checker on computed styles. For every visible text node it composites the text colour and every ancestor
   background (alpha, opacity) and reports the WCAG ratio; for every visible control (button, link, input, select, textarea,
   role=button/switch/tab/checkbox) it compares the border, or the fill when there is no border, with the surrounding
   background. Limits: text 4.5:1, large text (24 px, or 18.66 px bold) 3:1, controls 3:1. Text over a background image or
   gradient is reported as "unchecked" rather than guessed. Disabled controls are exempt (WCAG 1.4.3).
   Colours of any CSS syntax (rgb, color(srgb), color-mix results) are resolved through a canvas. */

/** @param {import('@playwright/test').Page} page
 *  @param {{themes?: string[], scope?: string}} [opts]
 *  @returns {Promise<{failures: object[], unchecked: object[], checked: number}>} */
async function checkContrast(page, opts = {}) {
  const themes = opts.themes || ['light', 'dark'];
  const all = { failures: [], unchecked: [], checked: 0 };
  for (const theme of themes) {
    await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, theme);
    await page.waitForTimeout(60);
    const r = await page.evaluate(inPage, opts.scope || 'body');
    all.checked += r.checked;
    r.failures.forEach((f) => all.failures.push({ theme, ...f }));
    r.unchecked.forEach((f) => all.unchecked.push({ theme, ...f }));
  }
  return all;
}

function inPage(scope) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  function rgba(css) {
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data; // premultiplied by canvas; alpha preserved
    if (d[3] === 0) return [0, 0, 0, 0];
    return [d[0] * 255 / d[3], d[1] * 255 / d[3], d[2] * 255 / d[3], d[3] / 255];
  }
  const over = (f, b) => { const a = f[3]; return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a), 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const canvasBg = rgba(getComputedStyle(document.documentElement).backgroundColor); // may be transparent
  const rootBg = canvasBg[3] ? over(canvasBg, [255, 255, 255, 1]) : [255, 255, 255, 1];

  /** effective opaque background behind `node`, or {image:true} when a background image sits in the way */
  function bgOf(node) {
    const chain = [];
    for (let n = node; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
    let acc = rootBg, image = false;
    for (let i = chain.length - 1; i >= 0; i--) {
      const cs = getComputedStyle(chain[i]);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') image = true;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) { acc = over(c, acc); if (cs.backgroundImage === 'none') image = false; }
    }
    return { color: acc, image };
  }
  function opacityOf(node) { let o = 1; for (let n = node; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; }
  function visible(node) {
    const r = node.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true' && !(n instanceof SVGElement)) return false;
      if (parseFloat(cs.opacity) === 0) return false;
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || (cs.clipPath === 'inset(50%)')) return false;
    }
    return true;
  }
  function label(node) {
    const id = node.id ? '#' + node.id : '';
    const cls = (typeof node.className === 'string' && node.className.trim()) ? '.' + node.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return node.tagName.toLowerCase() + id + cls;
  }
  const failures = [], unchecked = []; let checked = 0;
  const root = document.querySelector(scope) || document.body;
  const seen = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const txt = t.nodeValue.replace(/\s+/g, ' ').trim();
    if (!txt) continue;
    const node = t.parentElement;
    if (!node || /^(script|style|noscript|title)$/i.test(node.tagName) || !visible(node)) continue;
    const inSvg = node instanceof SVGElement;
    if (node.closest('[disabled],[aria-disabled="true"]')) continue;
    const key = node; if (seen.has(key)) continue; seen.add(key);
    const cs = getComputedStyle(node);
    let bg = bgOf(node);
    if (inSvg) { // SVG text sits on the nearest earlier sibling shape with a fill (pin disc, label plate); else the HTML background
      for (let sb = node.previousElementSibling; sb; sb = sb.previousElementSibling) {
        const f = rgba(getComputedStyle(sb).fill);
        if (/^(circle|rect|path|ellipse|polygon)$/i.test(sb.tagName) && f[3] > 0.5) { bg = { color: over(f, bg.color), image: false }; break; }
      }
    }
    const op = opacityOf(node);
    let fg = rgba(inSvg ? (cs.fill && cs.fill !== 'none' ? cs.fill : cs.color) : cs.color);
    fg = [fg[0], fg[1], fg[2], fg[3] * op];
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (bg.image) { unchecked.push({ el: label(node), text: txt.slice(0, 40), why: 'text over a background image or gradient' }); continue; }
    const r = ratio(over(fg, bg.color), bg.color);
    checked++;
    if (r < need) failures.push({ kind: 'text', el: label(node), text: txt.slice(0, 40), ratio: +r.toFixed(2), need, size, fg: cs.color, bg: 'rgb(' + bg.color.slice(0, 3).map(Math.round).join(',') + ')' });
  }
  const sel = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=switch],[role=tab],[role=checkbox],[role=radio],[role=link],[role=menuitem]';
  root.querySelectorAll(sel).forEach((node) => {
    if (!visible(node) || node.disabled || node.getAttribute('aria-disabled') === 'true') return;
    const parentBg = node.parentElement ? bgOf(node.parentElement) : { color: rootBg, image: false };
    if (parentBg.image) { unchecked.push({ el: label(node), why: 'control over a background image' }); return; }
    const cs = getComputedStyle(node);
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map((s) => ({ w: parseFloat(cs['border' + s + 'Width']), st: cs['border' + s + 'Style'], c: rgba(cs['border' + s + 'Color']) })).filter((s) => s.w > 0 && s.st !== 'none' && s.c[3] > 0);
    const own = bgOf(node);
    let edge = null, what = '';
    if (sides.length) { edge = over(sides[0].c, parentBg.color); what = 'border'; }
    else if (!own.image && ratio(own.color, parentBg.color) > 1.02) { edge = own.color; what = 'fill'; }
    else if (node.matches('input,select,textarea')) { edge = rgba(cs.outlineColor); what = 'none'; }
    if (!edge || what === 'none' && !node.matches('input,select,textarea')) return; // text-only control: covered by the text check
    if (what === 'none') { failures.push({ kind: 'control', el: label(node), ratio: 1, need: 3, why: 'form field with no visible boundary' }); checked++; return; }
    const r = ratio(edge, parentBg.color);
    checked++;
    if (r < 3) failures.push({ kind: 'control', el: label(node), what, ratio: +r.toFixed(2), need: 3 });
  });
  return { failures, unchecked, checked };
}

/** One readable line per failure */
function formatFailures(r) {
  return r.failures.map((f) => `[${f.theme}] ${f.kind} ${f.el}${f.text ? ' "' + f.text + '"' : ''} ${f.ratio}:1 < ${f.need}:1${f.what ? ' (' + f.what + ')' : ''}${f.why ? ' ' + f.why : ''}`).join('\n');
}
module.exports = { checkContrast, formatFailures };
