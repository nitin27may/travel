// The site's own photo renditions (backlog 2.38). Runs after `next build` and BEFORE `next start`: finds every Commons
// Special:FilePath URL in the build's prerendered output (<distDir>/server/app: HTML, RSC payloads, route-handler bodies),
// fetches each photo once (sequentially, cached outside git, backing off on 429; see commons-cache.mjs), writes 320, 640 and
// 960 px WebP files to web/public/img/<key>-<width>.webp and rewrites the URLs in the prerendered output to them. `next start`
// lists public/ when it starts (a file added later is a 404), so this must finish before the server starts; the e2e setup and
// check-all order it that way. The credit and licence text is data, not URLs, so it is untouched.
// The page code asks for exactly 320, 640 and 960 (lib/format/image.ts), so the rewrite is one to one. A photo that
// cannot be fetched (empty cache and no network, or a bad file) keeps its Commons URL, and the end of the run says so.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkLooksDown, thumb } from './commons-cache.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(WEB, process.env.NEXT_DIST_DIR || '.next');
const OUT = path.join(DIST, 'server', 'app');
const IMG = path.join(WEB, 'public', 'img'); // gitignored
const WIDTHS = [320, 640, 960];
const URL_RE = /https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^"\s?\\<>]+)\?width=(\d+)/g;
const bucket = (w) => (w <= 320 ? 320 : w <= 640 ? 640 : 960);

if (!existsSync(OUT)) { console.log('images: no build, skipped'); process.exit(0); }

// server code lives in <route>/page and <route>/route directories; chunks are server bundles
const SKIP_NAMES = new Set(['page', 'route', 'chunks']);
function* walk(dir, rel = '') {
  for (const name of readdirSync(dir)) {
    const r = path.join(rel, name);
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) { if (!SKIP_NAMES.has(name)) yield* walk(full, r); }
    else if (/\.(html|rsc|body|meta|txt|json)$/.test(name) && name !== 'og-manifest.json.body' && !/\.(nft|manifest)\.json$|manifest\.json$/.test(name)) yield full;
  }
}

const files = [...walk(OUT)];
const used = new Map(); // encoded file name -> Commons URL at any width
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(URL_RE)) if (!used.has(m[1])) used.set(m[1], m[0]);
}
if (!used.size) { console.log('images: no Commons photos in the build'); process.exit(0); }

const sharp = (await import('sharp')).default;
mkdirSync(IMG, { recursive: true });
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
      const dest = path.join(IMG, `${key}-${w}.webp`);
      if (!existsSync(dest)) writeFileSync(dest, await sharp(bytes).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74, effort: 5 }).toBuffer());
    }
    keyOf.set(enc, key);
  } catch (e) {
    failed++;
    console.warn(`images: ${decodeURIComponent(enc.replace(/&#x27;/g, "'"))} could not be converted (${String(e).split('\n')[0]}); it stays on Commons`);
  }
}

// The map the API reads (lib/server/images.ts): API responses are made at request time, after this rewrite of the prerendered output,
// so they take their photo URLs from this record (Commons file name -> content key) and never carry a Commons URL.
const MAP = path.join(WEB, '.generated', 'image-map.json');
mkdirSync(path.dirname(MAP), { recursive: true });
const decoded = (enc) => decodeURIComponent(enc.replace(/&#x27;|&#39;/g, "'"));
writeFileSync(MAP, JSON.stringify(Object.fromEntries([...keyOf].map(([enc, key]) => [decoded(enc), key]).sort()), null, 1) + '\n');

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
