import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readText, walkFiles } from './helpers';
import { builtOutDir } from './helpers/built';

const OUT = builtOutDir();

describe('fonts are self-hosted', () => {
  it('references fonts.googleapis.com or fonts.gstatic.com from no exported file', () => {
    const offenders = walkFiles(OUT)
      .filter((f) => /\.(html|txt|js|css|json|xml|map)$/.test(f))
      .filter((f) => /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(readText(f)))
      .map((f) => path.relative(OUT, f));
    expect(offenders).toEqual([]);
  });

  it('ships the three families: Big Shoulders Display, Source Serif 4 (roman and italic), IBM Plex Mono 400, 500, 600, with their licences', () => {
    const files = walkFiles(path.join(OUT, 'fonts')).map((f) => path.basename(f));
    for (const needle of [
      'big-shoulders-display-latin-wght-normal.woff2',
      'source-serif-4-latin-wght-normal.woff2',
      'source-serif-4-latin-wght-italic.woff2',
      'ibm-plex-mono-latin-400-normal.woff2',
      'ibm-plex-mono-latin-500-normal.woff2',
      'ibm-plex-mono-latin-600-normal.woff2',
      'OFL-big-shoulders-display.txt',
      'OFL-source-serif-4.txt',
      'OFL-ibm-plex-mono.txt',
    ]) {
      expect(files).toContain(needle);
    }
  });

  it('preloads the two faces that paint first', () => {
    const home = readText(path.join(OUT, 'index.html'));
    expect(home).toContain('rel="preload"');
    expect(home).toContain('big-shoulders-display-latin-wght-normal.woff2');
    expect(home).toContain('source-serif-4-latin-wght-normal.woff2');
  });
});
