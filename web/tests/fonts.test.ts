import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB, readText, walkFiles } from './helpers';

const OUT = path.join(WEB, 'out');

describe('fonts are self-hosted', () => {
  it('references fonts.googleapis.com or fonts.gstatic.com from no exported file', () => {
    const offenders = walkFiles(OUT)
      .filter((f) => /\.(html|txt|js|css|json|xml|map)$/.test(f))
      .filter((f) => /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(readText(f)))
      .map((f) => path.relative(OUT, f));
    expect(offenders).toEqual([]);
  });

  it('ships the WOFF2 files and their licences', () => {
    const files = walkFiles(path.join(OUT, 'fonts')).map((f) => path.basename(f));
    for (const needle of ['big-shoulders-display-latin-wght-normal.woff2', 'source-serif-4-latin-wght-normal.woff2', 'ibm-plex-mono-latin-400-normal.woff2', 'OFL-big-shoulders-display.txt', 'OFL-source-serif-4.txt', 'OFL-ibm-plex-mono.txt']) {
      expect(files).toContain(needle);
    }
  });
});
