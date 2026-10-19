// The site's own photo renditions (backlog 2.38). Runs after `next build`: finds every Commons Special:FilePath URL in the
// export, fetches each photo once (sequentially, cached outside git, backing off on 429; see commons-cache.mjs), writes
// 320, 640 and 960 px WebP files to <export>/img/<key>-<width>.webp and rewrites the URLs in the export to them. The
// credit and licence text is data, not URLs, so it is untouched.
// The page code asks for exactly 320, 640 and 960 (lib/format/image.ts), so the rewrite is one to one. A photo that
// cannot be fetched (empty cache and no network, or a bad file) keeps its Commons URL, and the end of the run says so.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkLooksDown, thumb } from './commons-cache.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(WEB, process.env.NEXT_DIST_DIR || 'out');
const WIDTHS = [320, 640, 960];
const URL_RE = /https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^"\s?\\<>]+)\?width=(\d+)/g;
const bucket = (w) => (w <= 320 ? 320 : w <= 640 ? 640 : 960);

if (!existsSync(OUT)) { console.log('images: no export, skipped'); process.exit(0); }

const SKIP_DIRS = new Set(['og', 'img', path.join('_next', 'static')]);
function* walk(dir, rel = '') {
  for (const name of readdirSync(dir)) {
    const r = path.join(rel, name);
    if (SKIP_DIRS.has(r)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full, r);
    else if (/\.(html|txt|json)$/.test(name) && name !== 'og-manifest.json') yield full;
  }
}

const files = [...walk(OUT)];
const used = new Map(); // encoded file name -> Commons URL at any width
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(URL_RE)) if (!used.has(m[1])) used.set(m[1], m[0]);
}
if (!used.size) { console.log('images: no Commons photos in the export'); process.exit(0); }

const sharp = (await import('sharp')).default;
mkdirSync(path.join(OUT, 'img'), { recursive: true });
const keyOf = new Map(); // encoded file name -> content key
let failed = 0;
const missing = [];
for (const [enc, url] of used) {
  // the HTML form escapes an apostrophe as &#x27;; the URL to fetch has the plain character
  const src = await thumb(url.replace(/&#x27;|&#39;/g, "'"));
  if (!src) { failed++; missing.push(decodeURIComponent(enc.replace(/&#x27;|&#39;/g, "'"))); continue; }
  try {
    const bytes = readFileSync(src);
    const key = createHash('sha1').update(bytes).digest('hex').slice(0, 10);
    for (const w of WIDTHS) {
      const dest = path.join(OUT, 'img', `${key}-${w}.webp`);
      if (!existsSync(dest)) writeFileSync(dest, await sharp(bytes).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74, effort: 5 }).toBuffer());
    }
    keyOf.set(enc, key);
  } catch (e) {
    failed++;
    console.warn(`images: ${decodeURIComponent(enc.replace(/&#x27;/g, "'"))} could not be converted (${String(e).split('\n')[0]}); it stays on Commons`);
  }
}

let rewritten = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const next = text.replace(URL_RE, (all, enc, w) => {
    const key = keyOf.get(enc);
    if (!key) return all;
    rewritten++;
    return `/img/${key}-${bucket(Number(w))}.webp`;
  });
  if (next !== text) writeFileSync(f, next);
}

console.log(`images: ${keyOf.size} of ${used.size} photos now served from /img (${rewritten} URLs rewritten, ${WIDTHS.join('/')} px WebP)`);
if (failed) {
  console.warn(`images: not fetched: ${missing.join(', ')}`);
  console.warn(`images: WARNING ${failed} photo(s) kept their Commons URL${networkLooksDown() ? ' because the network looks down and the cache did not have them' : ''}. The build is fine; those images load from Commons.`);
}
