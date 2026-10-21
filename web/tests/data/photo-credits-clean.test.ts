import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanAuthor } from '@/lib/public/photos';
import { walkFiles } from '../helpers';
import { builtOutDir } from '../helpers/built';

// Backlog 2.41: a gallery credit is the author and the licence, never a Commons description sentence.
describe('cleanAuthor', () => {
  it.each([
    ['This Photo was taken by Wolfgang Moroder', 'Wolfgang Moroder'],
    ['This image or media was taken or created by Matt H', 'Matt H'],
    ['The original uploader was Datch78 at English Wikipedia.', 'Datch78'],
    ['Original uploader was Averette at en.wikipedia', 'Averette'],
    ['Ken Gallager at English Wikipedia', 'Ken Gallager'],
    ['Jon Sullivan, PD Photo.', 'Jon Sullivan'],
    ['Flickr user: Peter Rivera Stamford, Connecticut https://www.flickr.com/people/riverap1/', 'Peter Rivera Stamford, Connecticut'],
    ['Flickr user via Wikimedia Commons', 'Flickr user'],
    ['Phil Whitehouse from London, United Kingdom', 'Phil Whitehouse from London, United Kingdom'],
    ['<a href="x">Larry D. Moore</a>', 'Larry D. Moore'],
    ['Ximonic (Simo Räsänen)', 'Ximonic (Simo Räsänen)'],
  ])('%s -> %s', (raw, want) => {
    expect(cleanAuthor(raw)).toBe(want);
  });
});

const OUT = builtOutDir();
const SENTENCE = /\b(?:this (?:photo|image|picture)|was taken|taken or created|original uploader|photo credit)\b/i;

describe('built pages carry no Commons description as a credit', () => {
  const files = walkFiles(OUT).filter((f) => f.endsWith('index.html'));
  it('no author in the credits or the page data reads as a sentence', () => {
    const bad: string[] = [];
    for (const f of files) {
      const html = readFileSync(f, 'utf8').replace(/\\"/g, '"');
      for (const m of html.matchAll(/"author":"([^"]*)"/g)) if (SENTENCE.test(m[1]!)) bad.push(`${path.relative(OUT, f)}: ${m[1]}`);
      const footer = /<footer class="credits[^>]*>([\s\S]*?)<\/footer>/g;
      for (const m of html.matchAll(footer)) if (SENTENCE.test(m[1]!.replace(/<[^>]+>/g, ' '))) bad.push(`${path.relative(OUT, f)}: credits footer`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});
