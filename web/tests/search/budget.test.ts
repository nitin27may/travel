import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '@/lib/search/parse/parse';
import { WEB } from '../helpers';
import { fixtures, loadVocab, searchRecords, vocabPath } from './support';

// Size and time budgets of smart-search.md section 8: vocab.json at most 12 KB gzip, the parser at most 8 KB gzip, a parse at most 2 ms p95
// on a mid-range phone (the spec's 4x CPU throttle), so at most 0.5 ms here.

const KB = 1024;

/** The part of rolldown's API this test uses (it is vite's bundler, not a dependency of ours, so it has no types here). */
interface Rolldown {
  rolldown(o: { input: string; resolve: { alias: Record<string, string> }; treeshake: boolean }): Promise<{ generate(o: { format: 'esm'; minify: boolean }): Promise<{ output: { code: string }[] }> }>;
}

describe('budgets (section 8)', () => {
  it('vocab.json is at most 12 KB gzip', () => {
    const gz = gzipSync(readFileSync(vocabPath)).length;
    expect(gz).toBeLessThanOrEqual(12 * KB);
  });

  it('the parser is at most 8 KB gzip, minified, with the modules it pulls in', async () => {
    // bundle the entry with the same tool the test runner uses (rolldown), minified, as the search chunk would be
    const require = createRequire(path.join(WEB, 'package.json'));
    const vite = createRequire(require.resolve('vitest')).resolve('vite');
    const rolldown = (await import(createRequire(vite).resolve('rolldown'))) as Rolldown;
    const bundle = await rolldown.rolldown({ input: path.join(WEB, 'lib/search/parse/parse.ts'), resolve: { alias: { '@': WEB } }, treeshake: true });
    const out = await bundle.generate({ format: 'esm', minify: true });
    const code = out.output[0].code;
    const gz = gzipSync(code).length;
    expect(gz, `parser bundle: ${code.length} bytes, ${gz} gzip`).toBeLessThanOrEqual(8 * KB);
  });

  it('a parse takes at most 0.5 ms at p95 here, which is 2 ms on a phone at 4x throttle', () => {
    const vocab = loadVocab();
    const records = searchRecords();
    const queries = fixtures.map((f) => f.query);
    for (let i = 0; i < 20; i += 1) for (const q of queries) parse(q, vocab, records); // warm: the vocabulary and name indexes build once
    const times: number[] = [];
    for (let round = 0; round < 40; round += 1) {
      for (const q of queries) {
        const t = performance.now();
        parse(q, vocab, records);
        times.push(performance.now() - t);
      }
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)]!;
    expect(p95, `p95 ${p95.toFixed(3)} ms, p50 ${times[Math.floor(times.length / 2)]!.toFixed(3)} ms, max ${times[times.length - 1]!.toFixed(3)} ms`).toBeLessThanOrEqual(0.5);
  });
});
