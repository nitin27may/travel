// One Commons thumbnail at a time, cached on disk outside git (web/.og-cache, ignored). Shared by og.mjs (share images)
// and images.mjs (the site's own photo renditions), so a photo is fetched once per machine.
// Commons rate-limits parallel fetches: fetch sequentially, pause after each download, back off on 429.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = process.env.COMMONS_CACHE || path.join(WEB, '.og-cache');
mkdirSync(CACHE, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let consecutiveFailures = 0;

/** True after three downloads in a row failed at the network: the machine is offline, so stop trying (each try costs seconds). */
export const networkLooksDown = () => consecutiveFailures >= 3;

/**
 * The 960 px thumbnail of a Commons Special:FilePath URL, as a path on disk, or null when it cannot be had.
 * `width` in the URL is ignored: every rendition is cut from the 960 px thumbnail.
 */
export async function thumb(url) {
  const src = url.replace(/([?&])width=\d+/, '$1width=960');
  const file = path.join(CACHE, Buffer.from(src).toString('base64url').slice(-80) + '.jpg');
  if (existsSync(file)) return file;
  if (networkLooksDown()) return null;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(src, { headers: { 'user-agent': 'trip-plans-og/1.0 (nks-travel.pages.dev)' }, signal: AbortSignal.timeout(30000) });
      consecutiveFailures = 0;
      if (r.ok && /^image\//.test(r.headers.get('content-type') ?? '')) {
        writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        await sleep(250);
        return file;
      }
      if (r.status !== 429 && r.status < 500) return null;
    } catch {
      consecutiveFailures++;
      if (networkLooksDown()) return null;
    }
    await sleep(1500 * (i + 1));
  }
  return null;
}
