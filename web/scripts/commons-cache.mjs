// One Commons thumbnail per photo, cached on disk outside git (web/.og-cache, ignored). Shared by og.mjs (share images) and images.mjs
// (the site's own photo renditions), so a photo is fetched once per machine.
//
// OFFLINE BY DEFAULT (IMG-1b, Q292): `thumb()` reads the cache and never touches the network. Only a caller that passes `{ fetch: true }`
// (`images:warm --fetch`, run by one person under `flock /tmp/travel-commons.lock`) downloads, and then one at a time, pausing after
// each download and backing off on 429. Any run (a build, a test) can set COMMONS_FETCH_GUARD=1 to make a Wikimedia fetch throw.
// The cache key is the first 32 hex characters of sha256 of the 960 px source URL. The old key was the tail of the URL, and two pairs of
// different photos shared one file (a wrong credit under a right photo); `legacyKey()` is kept only for `images.mjs --rekey`.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = process.env.COMMONS_CACHE || path.join(WEB, '.og-cache');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let consecutiveFailures = 0;

/** True after three downloads in a row failed at the network: the machine is offline, so stop trying (each try costs seconds). */
export const networkLooksDown = () => consecutiveFailures >= 3;

/** The 960 px Commons source URL of a file name (spaces or underscores). */
export const sourceUrlOf = (name) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name.replace(/ /g, '_'))}?width=960`;
const at960 = (url) => url.replace(/([?&])width=\d+/, '$1width=960');

/** The cache file name (without folder) for a source URL: collision-free. */
export const keyOf = (url) => createHash('sha256').update(at960(url)).digest('hex').slice(0, 32) + '.jpg';
/** The pre-IMG-1b key (base64url tail of the URL). Two pairs of photos collided on it. Used by --rekey only. */
export const legacyKey = (url) => Buffer.from(at960(url)).toString('base64url').slice(-80) + '.jpg';

export const cachePath = (url) => path.join(CACHE, keyOf(url));

/**
 * The 960 px thumbnail of a Commons Special:FilePath URL, as a path on disk, or null when it is not in the cache.
 * `width` in the URL is ignored: every rendition is cut from the 960 px thumbnail. Fetches only with `{ fetch: true }`.
 */
export async function thumb(url, opts = {}) {
  const src = at960(url);
  const file = path.join(CACHE, keyOf(src));
  if (existsSync(file)) return file;
  if (!opts.fetch || networkLooksDown()) return null;
  mkdirSync(CACHE, { recursive: true });
  for (let i = 0; i < 4; i++) {
    try {
      if (process.env.COMMONS_FETCH_GUARD === '1') throw new Error(`COMMONS_FETCH_GUARD: refused to fetch ${src}`);
      const r = await fetch(src, { headers: { 'user-agent': 'trip-plans-og/1.0 (nks-travel.pages.dev)' }, signal: AbortSignal.timeout(30000) });
      consecutiveFailures = 0;
      if (r.ok && /^image\//.test(r.headers.get('content-type') ?? '')) {
        writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        await sleep(250);
        return file;
      }
      if (r.status !== 429 && r.status < 500) return null;
    } catch (e) {
      if (/COMMONS_FETCH_GUARD/.test(String(e))) throw e;
      consecutiveFailures++;
      if (networkLooksDown()) return null;
    }
    await sleep(1500 * (i + 1));
  }
  return null;
}
