import { describe, expect, it } from 'vitest';
import { cleanAuthor } from '../scripts/og-text.mjs';

describe('share image credit line', () => {
  it.each([
    ['This Photo was taken by Wolfgang Moroder', 'Wolfgang Moroder'],
    ['Photo by Jane Roe', 'Jane Roe'],
    ['Phil Whitehouse from London, United Kingdom', 'Phil Whitehouse from London, United Kingdom'],
    ['<a href="x">Ben Smith</a>', 'Ben Smith'],
    ['© A. Person', 'A. Person'],
    ['Picture taken by Li Wei', 'Li Wei'],
  ])('%s -> %s', (raw, want) => expect(cleanAuthor(raw)).toBe(want));
});
