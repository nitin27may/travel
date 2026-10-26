// The site's own photo renditions (backlog 2.38, IMG-1b). They are made BEFORE `next build`, from the cache only:
//   node scripts/images.mjs --prebuild   list the photos from the pages' own loaders (prebuild-data.ts), cut 320/640/960 px WebP from the
//                                        cached Commons thumbnails into web/public/img, write .generated/image-map.json (file -> key)
//   node scripts/images.mjs --verify     after `next build`, read-only: no Commons image URL in the prerendered output, an og:image file for
//                                        every page that names one, the image map present; it fails on an empty scan
//   node scripts/images.mjs --warm [--rekey] [--fetch]   the only path that touches Commons: fills the cache for the missing photos, one at a
//                                        time. Run by one person under `flock /tmp/travel-commons.lock` (`pnpm images:warm`)
//   node scripts/images.mjs --rekey [--dry-run]          renames cache files to the collision-free key (see commons-cache.mjs)
// Pages ask `renditionOf()` (lib/server/images.ts) for the rendition while they render, so nothing after the build changes what ships (the
// Vercel build adapter copies the prerendered output inside `next build`). A photo with no rendition is left out with its credit and listed
// at the end; the build still passes. Offline by default: only `--warm --fetch` downloads.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CACHE, cachePath, keyOf, legacyKey, networkLooksDown, sourceUrlOf, thumb } from './commons-cache.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(WEB, process.env.NEXT_DIST_DIR || '.next');
const PUBLIC = process.env.IMG_PUBLIC_DIR || path.join(WEB, 'public');
const GENERATED = process.env.IMG_GENERATED_DIR || path.join(WEB, '.generated');
const IMG = path.join(PUBLIC, 'img'); // gitignored
const MAP = path.join(GENERATED, 'image-map.json');
const PHOTOS = path.join(GENERATED, 'prebuild-photos.json');
const WIDTHS = [320, 640, 960];
const args = new Set(process.argv.slice(2));
const COMMONS_IN_OUTPUT = /commons\.wikimedia\.org\/wiki\/Special:FilePath|upload\.wikimedia\.org/;

/** Runs scripts/prebuild-data.ts: the loaders, in plain Node, write the photo list and the share-image list. */
function collect() {
  const r = spawnSync(process.execPath, ['--import', path.join(WEB, 'scripts', 'ts-hooks.mjs'), path.join(WEB, 'scripts', 'prebuild-data.ts')], { cwd: WEB, stdio: 'inherit', env: process.env });
  if (r.status !== 0) { console.error('images: could not list the photos from the page loaders'); process.exit(1); }
}
const listed = () => JSON.parse(readFileSync(PHOTOS, 'utf8'));

// ---- --rekey -------------------------------------------------------------------------------------------------------------
/** Files that share an old key are different photos under one file: drop that file, and fetch them again. Returns the names to fetch. */
function rekey(names, dry) {
  const byOld = new Map();
  for (const n of names) {
    const k = legacyKey(sourceUrlOf(n));
    byOld.set(k, [...(byOld.get(k) ?? []), n]);
  }
  let renamed = 0, dropped = 0;
  const refetch = [];
  for (const [old, group] of byOld) {
    const oldFile = path.join(CACHE, old);
    if (group.length > 1) {
      if (existsSync(oldFile)) { dropped++; if (!dry) rmSync(oldFile); }
      for (const n of group) if (!existsSync(cachePath(sourceUrlOf(n)))) refetch.push(n);
      continue;
    }
    const n = group[0];
    const next = cachePath(sourceUrlOf(n));
    if (!existsSync(next) && existsSync(oldFile)) { renamed++; if (!dry) renameSync(oldFile, next); }
    else if (!existsSync(next)) refetch.push(n);
  }
  console.log(`images: rekey${dry ? ' (dry run)' : ''}: ${renamed} file(s) renamed, ${dropped} collided file(s) dropped, ${refetch.length} photo(s) to fetch:`);
  for (const n of refetch) console.log(`  ${n}`);
  return refetch;
}

// ---- --prebuild ----------------------------------------------------------------------------------------------------------
async function prebuild() {
  collect();
  const names = listed();
  const sharp = (await import('sharp')).default;
  mkdirSync(IMG, { recursive: true });
  const keys = {};
  const missing = [];
  for (const name of names) {
    const src = await thumb(sourceUrlOf(name)); // cache only: no fetch option
    if (!src) { missing.push(name); continue; }
    try {
      const bytes = readFileSync(src);
      const key = createHash('sha1').update(bytes).digest('hex').slice(0, 10);
      for (const w of WIDTHS) {
        const dest = path.join(IMG, `${key}-${w}.webp`);
        if (!existsSync(dest)) writeFileSync(dest, await sharp(bytes).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74, effort: 5 }).toBuffer());
      }
      keys[name] = key;
    } catch (e) {
      missing.push(name);
      console.warn(`images: ${name} could not be converted (${String(e).split('\n')[0]}); it is left out`);
    }
  }
  mkdirSync(GENERATED, { recursive: true });
  writeFileSync(MAP, JSON.stringify(Object.fromEntries(Object.entries(keys).sort(([a], [b]) => (a < b ? -1 : 1))), null, 1) + '\n');
  console.log(`images: ${Object.keys(keys).length} of ${names.length} photos have renditions in ${path.relative(WEB, IMG)} (${WIDTHS.join('/')} px WebP)`);
  if (missing.length) {
    console.warn(`images: ${missing.length} photo(s) not in the cache: ${missing.join(', ')}`);
    console.warn('images: they are left out of the pages with their credit. On the Mac, run "flock /tmp/travel-commons.lock pnpm --dir web images:warm --fetch".');
  }
}

// ---- --warm --------------------------------------------------------------------------------------------------------------
async function warm() {
  if (!existsSync(PHOTOS)) collect();
  const names = listed();
  if (args.has('--rekey')) rekey(names, args.has('--dry-run'));
  const todo = names.filter((n) => !existsSync(cachePath(sourceUrlOf(n))));
  if (!args.has('--fetch')) {
    console.log(`images: ${todo.length} of ${names.length} photo(s) are not in the cache${todo.length ? ' (add --fetch to download them, one at a time, under the Commons lock):' : '.'}`);
    for (const n of todo) console.log(`  ${n}`);
    return;
  }
  let got = 0;
  for (const n of todo) {
    if (await thumb(sourceUrlOf(n), { fetch: true })) { got++; console.log(`images: fetched ${n}`); }
    else console.warn(`images: could not fetch ${n}${networkLooksDown() ? ' (the network looks down)' : ''}`);
  }
  console.log(`images: fetched ${got} of ${todo.length}`);
}

// ---- --verify ------------------------------------------------------------------------------------------------------------
function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) { if (name !== 'chunks') yield* walk(full); }
    else if (/\.(html|rsc|body|meta|json|txt)$/.test(name) && !/\.nft\.json$|manifest\.json$/.test(name)) yield full;
  }
}

function verify() {
  const roots = [path.join(DIST, 'server', 'app'), path.join(DIST, 'server', 'route-cache')];
  const files = roots.flatMap((r) => [...walk(r)]);
  const fail = [];
  if (!files.length) fail.push(`scanned 0 prerendered files under ${roots.map((r) => path.relative(WEB, r)).join(' and ')}: the check would pass on nothing`);
  if (!existsSync(MAP)) fail.push(`${path.relative(WEB, MAP)} is missing`);
  const hits = [];
  const noFile = new Set();
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    if (COMMONS_IN_OUTPUT.test(text)) hits.push(path.relative(WEB, f));
    for (const m of text.matchAll(/property="og:image"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:image"/g)) {
      const u = m[1] ?? m[2];
      let p;
      try { p = new URL(u, 'https://x.invalid').pathname; } catch { p = u; }
      if (!existsSync(path.join(PUBLIC, decodeURIComponent(p)))) noFile.add(`${u} (in ${path.relative(WEB, f)})`);
    }
  }
  if (hits.length) fail.push(`${hits.length} prerendered file(s) still hold a Commons image URL: ${hits.slice(0, 5).join(', ')}${hits.length > 5 ? ', ...' : ''}`);
  if (noFile.size) fail.push(`${noFile.size} og:image URL(s) with no file in ${path.relative(WEB, PUBLIC)}: ${[...noFile].slice(0, 5).join(', ')}`);
  if (fail.length) {
    for (const m of fail) console.error(`images: VERIFY FAILED: ${m}`);
    process.exit(1);
  }
  console.log(`images: verified ${files.length} prerendered files: 0 Commons image URLs, every og:image has a file, image map present`);
}

if (args.has('--verify')) verify();
else if (args.has('--warm')) await warm();
else if (args.has('--rekey')) { if (!existsSync(PHOTOS)) collect(); rekey(listed(), args.has('--dry-run')); }
else if (args.has('--prebuild')) await prebuild();
else { console.error('usage: images.mjs --prebuild | --verify | --warm [--rekey] [--fetch] | --rekey [--dry-run]'); process.exit(2); }
