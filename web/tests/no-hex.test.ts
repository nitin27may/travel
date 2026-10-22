import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const WEB = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', 'out', '.next', '.fixture-out', '.generated', 'test-results', 'playwright-report', 'fixtures']);
const ALLOWED = new Set([path.join('app', 'themes.css')]);

function walk(dir: string, out: string[] = [], ext = /\.(ts|tsx|css)$/): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.fixture')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out, ext);
    else if (ext.test(name)) out.push(full);
  }
  return out;
}

describe('colour lives only in themes.css', () => {
  it('has no hex colour literal outside web/app/themes.css', () => {
    const offenders: string[] = [];
    for (const file of walk(WEB)) {
      const rel = path.relative(WEB, file);
      if (ALLOWED.has(rel) || rel === path.join('tests', 'no-hex.test.ts')) continue;
      const text = readFileSync(file, 'utf8');
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (/(^|[^&\w])#[0-9a-fA-F]{3,8}\b/.test(line.replace(/url\([^)]*\)/g, ''))) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Ratchet (CONS-1): `rgb(`, `hsl(` and named colours used as style values are held at the measured baseline of 20-21 Oct 2026, a count per
 * file that may only fall. A new file, or a rise, fails. The same baseline, with a reason per entry, is in tools/cons/baseline.json.
 */
const COLOUR_FN = /\b(rgba?|hsla?)\(/;
const NAMED = new RegExp(
  `\\b(?:color|background(?:-color)?|fill|stroke|border(?:-[a-z]+)*|outline(?:-color)?)\\s*[:=]\\s*["']?(?:red|green|blue|black|white|gray|grey|orange|yellow|purple|pink|brown|teal|navy|olive|maroon|cyan|magenta|lime|gold|silver|tomato|coral|salmon|crimson|indigo|violet|ivory|beige|khaki|tan|azure|aqua|lavender|plum|orchid|turquoise|chocolate|firebrick)\\b(?![-\\w])`,
);
const FN_BASELINE: Record<string, number> = {
  'components/ui/ui.css': 1,
  'lib/globe/palette.ts': 6,
  'lib/map/maplibre/engine.ts': 2,
  'lib/map/palette.ts': 13,
  'scripts/og.mjs': 2,
  'styles/globe.css': 1,
};
const NAMED_BASELINE: Record<string, number> = { 'styles/print.css': 4 };

function countByFile(re: RegExp): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of walk(WEB, [], /\.(ts|tsx|css|mjs)$/)) {
    const rel = path.relative(WEB, file).split(path.sep).join('/');
    if (rel === 'app/themes.css' || rel.startsWith('tests/')) continue;
    let n = 0;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
      if (re.test(line.replace(/url\([^)]*\)/g, 'url()'))) n++;
    }
    if (n) counts[rel] = n;
  }
  return counts;
}

function overBaseline(found: Record<string, number>, base: Record<string, number>): string[] {
  return Object.entries(found).filter(([f, n]) => n > (base[f] ?? 0)).map(([f, n]) => `${f}: ${n} (baseline ${base[f] ?? 0})`);
}

describe('colour functions and named colours are held at the baseline (ratchet)', () => {
  it('has no new rgb( or hsl( literal', () => {
    expect(overBaseline(countByFile(COLOUR_FN), FN_BASELINE)).toEqual([]);
  });
  it('has no new named colour used as a style value', () => {
    expect(overBaseline(countByFile(NAMED), NAMED_BASELINE)).toEqual([]);
  });
});
