import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { imageBucket } from '@/lib/format/image';

// Photo URLs in API responses. The site never reads from Commons at runtime: every photo is a same-origin rendition
// `/img/<key>-<w>.webp` that scripts/images.mjs made. That script rewrites the PRERENDERED output, so a response made at request time
// takes the same rendition from the record the script leaves (`.generated/image-map.json`, Commons file name -> content key). A photo with
// no rendition is left out (null, or dropped from a list); a Commons image URL is never sent.
const FILE_PATH = /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^?]+)(?:\?width=(\d+))?$/;
const REMOVED = Symbol('removed');

let map: Map<string, string> | null = null;
function renditions(): Map<string, string> {
  if (map) return map;
  const file = path.join(process.cwd(), '.generated', 'image-map.json');
  map = new Map(existsSync(file) ? Object.entries(JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>) : []);
  // Without the map every photo is left out of every response and nothing else says why (audit GB-A-14): say it once per process. The
  // build's own prerender runs before scripts/images.mjs writes the map, so that phase stays quiet.
  if (!map.size && process.env.NEXT_PHASE !== 'phase-production-build') {
    console.error(`[images] ${file} is missing or empty: API responses carry no photos. Run the web build (scripts/images.mjs writes it).`);
  }
  return map;
}

/** Forgets the loaded map so the next read looks at the file again (tests only). */
export function resetRenditionsForTest(): void {
  map = null;
}

/** The rendition URL for a Commons photo URL, at the width nearest above the one asked, or null when there is none. */
export function renditionOf(url: string): string | null {
  const m = FILE_PATH.exec(url);
  if (!m) return null;
  let name: string;
  try {
    name = decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
  const key = renditions().get(name);
  return key ? `/img/${key}-${imageBucket(Number(m[2] ?? 960))}.webp` : null;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isImageUrl = (u: unknown): u is string => typeof u === 'string' && (/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//.test(u) || /^https:\/\/upload\.wikimedia\.org\//.test(u));

function walk(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(walk).filter((y) => y !== REMOVED);
  if (!isObj(x)) return x;
  // an image object (a photo, a card image) whose file has no rendition is not an image at all
  if (isImageUrl(x.url)) {
    const r = renditionOf(x.url);
    if (!r) return REMOVED;
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === 'url' ? r : walk(v)]));
  }
  return Object.fromEntries(
    Object.entries(x).map(([k, v]) => {
      if (isImageUrl(v)) return [k, renditionOf(v)];
      const w = walk(v);
      return [k, w === REMOVED ? null : w];
    }),
  );
}

/** A response body with every photo URL turned into its rendition, and every photo without one taken out. */
export function withRenditions<T>(x: T): T {
  const w = walk(x);
  return (w === REMOVED ? null : w) as T;
}
