// Share images: one 1200x630 JPEG per trip and place, written to <export>/og/<kind>/<slug>.jpg after `next build`.
// Hero photo (a Commons 960 px thumbnail, never the original) under a scrim, title in Big Shoulders, credit line in Plex
// Mono, colours read from app/themes.css. Needs the export's og-manifest.json (app/og-manifest.json/route.ts), which is
// deleted afterwards. If the browser or the network is missing, an image still gets written (no photo, or the site
// default), so every og:image tag points at a file that exists.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(WEB, process.env.NEXT_DIST_DIR || 'out');
const CACHE = path.join(WEB, '.og-cache');
const manifestFile = path.join(OUT, 'og-manifest.json');
if (!existsSync(manifestFile)) { console.log('og: no manifest, skipped'); process.exit(0); }
const { items } = JSON.parse(readFileSync(manifestFile, 'utf8'));
rmSync(manifestFile);

const themes = readFileSync(path.join(WEB, 'app', 'themes.css'), 'utf8');
const token = (name) => new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(themes)?.[1] ?? '';
const HEADER = token('--header'), ACCENT = token('--accent');
const font = (f) => readFileSync(path.join(WEB, 'public', 'fonts', f)).toString('base64');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** One Commons thumbnail, cached on disk, fetched one at a time with a pause and a backoff on 429 (Commons rate-limits parallel fetches). */
async function thumb(url) {
  const src = url.replace(/([?&])width=\d+/, '$1width=960');
  const file = path.join(CACHE, Buffer.from(src).toString('base64url').slice(-80) + '.jpg');
  if (existsSync(file)) return file;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(src, { headers: { 'user-agent': 'trip-plans-og/1.0 (nks-travel.pages.dev)' } });
      if (r.ok) { writeFileSync(file, Buffer.from(await r.arrayBuffer())); await sleep(250); return file; }
      if (r.status !== 429 && r.status < 500) return null;
    } catch { /* retry */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}

const page = (it, photo) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Big Shoulders Display';font-weight:100 900;src:url(data:font/woff2;base64,${font('big-shoulders-display-latin-wght-normal.woff2')})}
@font-face{font-family:'IBM Plex Mono';font-weight:500;src:url(data:font/woff2;base64,${font('ibm-plex-mono-latin-500-normal.woff2')})}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;position:relative;overflow:hidden;background:${HEADER};color:#fff}
.ph{position:absolute;inset:0;background:center/cover no-repeat ${photo ? `url(data:image/jpeg;base64,${readFileSync(photo).toString('base64')})` : 'none'}}
.sc{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(11,17,25,.15),rgba(11,17,25,.88) 78%)}
.bar{position:absolute;left:0;right:0;bottom:0;height:10px;background:${ACCENT}}
.t{position:absolute;left:64px;right:64px;bottom:96px}
.k{font:500 24px 'IBM Plex Mono';letter-spacing:.06em;text-transform:uppercase;color:${ACCENT};margin-bottom:14px}
h1{font:800 ${it.title.length > 34 ? 92 : 120}px/.88 'Big Shoulders Display';text-transform:uppercase;letter-spacing:.005em;max-width:1070px}
.c{position:absolute;left:64px;right:64px;bottom:30px;display:flex;justify-content:space-between;font:500 18px 'IBM Plex Mono';color:rgba(255,255,255,.82)}
</style><div class="ph"></div><div class="sc"></div>
<div class="t"><div class="k">${esc(it.sub)}</div><h1>${esc(it.title)}</h1></div>
<div class="c"><span>nks-travel.pages.dev</span><span>${photo && it.photo?.author ? esc(`Photo: ${it.photo.author.slice(0, 48)}, ${it.photo.licence ?? ''}`) : ''}</span></div><div class="bar"></div>`;

let browser;
try {
  const { chromium } = await import('@playwright/test');
  browser = await chromium.launch();
} catch (e) { console.warn(`og: no browser (${String(e).split('\n')[0]}); copying og-default.png`); }

let made = 0, plain = 0;
const ctx = browser ? await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 }) : null;
for (const it of items) {
  const dir = path.join(OUT, 'og', it.kind);
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${it.slug}.jpg`);
  if (!ctx) { copyFileSync(path.join(WEB, 'public', 'og-default.png'), dest); continue; }
  const photo = it.photo ? await thumb(it.photo.url) : null;
  if (!photo) plain++;
  const p = await ctx.newPage();
  await p.setContent(page(it, photo), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  writeFileSync(dest, await p.screenshot({ type: 'jpeg', quality: 72 }));
  await p.close();
  made++;
}
await browser?.close();
console.log(`og: ${made} images (${plain} without a photo) in ${path.relative(WEB, path.join(OUT, 'og'))}`);
