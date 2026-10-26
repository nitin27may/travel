// Share images: one 1200x630 JPEG per trip and place, written to web/public/og/<kind>/<slug>.jpg (gitignored) BEFORE `next build`
// (`node scripts/og.mjs --prebuild`), so the pages' og:image tags point at files that exist, and the Vercel build adapter copies them.
// The list comes from the pages' own loaders (scripts/prebuild-data.ts, .generated/og-items.json), not from a route of the build.
// Hero photo (the cached Commons 960 px thumbnail, never the original) under a scrim, title in Big Shoulders, credit line in Plex Mono,
// colours read from app/themes.css. Cards are kept in web/.og-cache/og/<kind>/<slug>-<hash>.jpg, where the hash covers the item, this file
// and the colours, so a stale card is never used. Where a card exists it is copied. Where it does not and a browser is installed (the
// Mac: e2e, check-all, the release worktree) it is drawn and cached. Where there is no browser (Vercel) the site default is written as a real
// JPEG and listed, so every og:image tag still points at a file. No network: photos come from the cache only.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanAuthor } from './og-text.mjs';
import { CACHE, thumb } from './commons-cache.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.IMG_PUBLIC_DIR || path.join(WEB, 'public');
const GENERATED = process.env.IMG_GENERATED_DIR || path.join(WEB, '.generated');
const itemsFile = path.join(GENERATED, 'og-items.json');
// `node scripts/og.mjs --default-only --write-public` redraws just public/og-default.png (no list needed).
const defaultOnly = process.argv.includes('--default-only');
if (!defaultOnly && !process.argv.includes('--prebuild')) { console.error('usage: og.mjs --prebuild | --default-only [--write-public]'); process.exit(2); }
if (!defaultOnly && !existsSync(itemsFile)) {
  const r = spawnSync(process.execPath, ['--import', path.join(WEB, 'scripts', 'ts-hooks.mjs'), path.join(WEB, 'scripts', 'prebuild-data.ts')], { cwd: WEB, stdio: 'inherit', env: process.env });
  if (r.status !== 0) { console.error('og: could not list the share images from the page loaders'); process.exit(1); }
}
const items = defaultOnly ? [] : JSON.parse(readFileSync(itemsFile, 'utf8'));

const themes = readFileSync(path.join(WEB, 'app', 'themes.css'), 'utf8');
const token = (name) => new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(themes)?.[1] ?? '';
const HEADER = token('--header'), ACCENT = token('--accent');
const font = (f) => readFileSync(path.join(WEB, 'public', 'fonts', f)).toString('base64');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const CARDS = path.join(CACHE, 'og');
const SELF = readFileSync(fileURLToPath(import.meta.url));
const hashOf = (it, hasPhoto) => createHash('sha256').update(JSON.stringify([it, hasPhoto])).update(SELF).update(HEADER).update(ACCENT).digest('hex').slice(0, 12);

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
<div class="c"><span>nks-travel.pages.dev</span><span>${photo && it.photo?.author ? esc(`Photo: ${cleanAuthor(it.photo.author).slice(0, 48)}, ${it.photo.licence ?? ''}`) : ''}</span></div><div class="bar"></div>`;

let browser;
let browserNote = '';
const cardFile = (it, h) => path.join(CARDS, it.kind, `${it.slug}-${h}.jpg`);
const photoOf = async (it) => (it.photo ? await thumb(it.photo.url) : null); // cache only
// A browser is only needed for a card that is not cached yet.
let needsBrowser = defaultOnly;
for (const it of items) if (!existsSync(cardFile(it, hashOf(it, !!(await photoOf(it)))))) { needsBrowser = true; break; }
if (needsBrowser) {
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch();
  } catch (e) { browserNote = String(e).split('\n')[0]; }
}

let made = 0, copied = 0, plain = 0;
const fallback = [];
let defaultJpeg = null;
// The site-wide card (home, lists, anything without its own image): same pipeline, no photo, navy ground and the gold bar.
const DEFAULT = { kind: '', slug: '', title: 'Trip plans', sub: 'Researched trips, trails and places', photo: null };
const ctx = browser ? await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 }) : null;
for (const it of items) {
  const dir = path.join(OUT, 'og', it.kind);
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${it.slug}.jpg`);
  const photo = await photoOf(it);
  if (!photo && it.photo) plain++;
  const cached = cardFile(it, hashOf(it, !!photo));
  if (existsSync(cached)) { copyFileSync(cached, dest); copied++; continue; }
  if (ctx) {
    const p = await ctx.newPage();
    await p.setContent(page(it, photo), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    mkdirSync(path.dirname(cached), { recursive: true });
    writeFileSync(cached, await p.screenshot({ type: 'jpeg', quality: 72 }));
    await p.close();
    copyFileSync(cached, dest);
    made++;
    continue;
  }
  // no browser, no card: the default as a real JPEG (not a PNG under a .jpg name)
  defaultJpeg ??= await (await import('sharp')).default(path.join(WEB, 'public', 'og-default.png')).jpeg({ quality: 80 }).toBuffer();
  writeFileSync(dest, defaultJpeg);
  fallback.push(`${it.kind}/${it.slug}`);
}
if (ctx) {
  const p = await ctx.newPage();
  await p.setContent(page(DEFAULT, null), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const png = await p.screenshot({ type: 'png' });
  // the checked-in public/og-default.png is what the server serves; only --write-public redraws it
  if (process.argv.includes('--write-public')) writeFileSync(path.join(WEB, 'public', 'og-default.png'), png);
  await p.close();
}
await browser?.close();
console.log(`og: ${items.length} images in ${path.relative(WEB, path.join(OUT, 'og'))}: ${copied} from the card cache, ${made} drawn, ${fallback.length} default (${plain} cards without a cached photo)`);
if (fallback.length) {
  console.warn(`og: no browser${browserNote ? ` (${browserNote})` : ''}: ${fallback.length} share image(s) are not cached and use the site default JPEG: ${fallback.slice(0, 8).join(', ')}${fallback.length > 8 ? ', ...' : ''}`);
  console.warn('og: on the Mac run "pnpm --dir web build" once (it draws and caches every card) before deploying.');
}
