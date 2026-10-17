import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const WEB = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', 'out', '.next', '.fixture-out', '.generated', 'test-results', 'playwright-report', 'fixtures']);
const ALLOWED = new Set([path.join('app', 'themes.css')]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(full);
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
