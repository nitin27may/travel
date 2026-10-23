import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { noHotlink } from '@/lib/client/static';
import type { GlobeCardFile } from '@/lib/globe/types';
import { builtServerApp } from '../helpers/built';

// The static fallback's files (/globe-data/card/..., /list/..., /search/...) carry renditions, not Commons photo URLs (audit G-B). The build's
// image step rewrites them; this holds the built files to it, and the browser's static adapter drops a card photo that is still off-site.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return statSync(f).isDirectory() ? files(f) : [f];
  });
}

describe('the static fallback files', () => {
  it('no built globe-data card, list part or search part holds a Commons photo URL', () => {
    const app = builtServerApp();
    const hits: string[] = [];
    for (const dir of ['globe-data', 'list', 'search']) {
      for (const f of files(path.join(app, dir)).filter((x) => x.endsWith('.body'))) {
        if (/Special:FilePath|upload\.wikimedia\.org/.test(readFileSync(f, 'utf8'))) hits.push(path.relative(app, f));
      }
    }
    expect(hits).toEqual([]);
  });

  it('a card whose build skipped the image step shows no photo instead of hotlinking', () => {
    const card = { card: { image: { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width=960', width: 960, author: 'a', licence: 'b', sourceUrl: 'c', from: 'place' } } } as unknown as GlobeCardFile;
    expect(noHotlink(card)?.card.image).toBeNull();
    const own = { card: { image: { url: '/img/abc-960.webp' } } } as unknown as GlobeCardFile;
    expect(noHotlink(own)).toBe(own);
    expect(noHotlink(null)).toBeNull();
  });
});
