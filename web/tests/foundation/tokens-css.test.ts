import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = path.resolve(__dirname, '..', '..');
const themes = readFileSync(path.join(WEB, 'app', 'themes.css'), 'utf8');

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (['node_modules', '.next', 'out', 'test-results', '.generated'].includes(n) || n.startsWith('.fixture')) continue;
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) cssFiles(f, out);
    else if (n.endsWith('.css')) out.push(f);
  }
  return out;
}

describe('themes.css and the css that uses it', () => {
  it('has light as the default, dark, and the reduced-motion overrides', () => {
    expect(themes).toContain(':root,\n[data-theme="light"]');
    expect(themes).toContain('[data-theme="dark"]');
    expect(themes).toContain('prefers-reduced-motion: reduce');
    expect(themes).not.toContain('shell');
  });

  it('every var(--x) a stylesheet uses is defined (in themes.css or in the sheet itself)', () => {
    const files = cssFiles(WEB).filter((f) => !f.endsWith('themes.css'));
    const all = files.map((f) => readFileSync(f, 'utf8')).join('\n') + themes;
    const defined = new Set([...all.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    // custom properties set from TSX (inline style) or by a lane
    const runtime = new Set(['--tc', '--fill', '--bar-h', '--sbw', '--count-n', '--settle-ms']);
    const missing = new Set<string>();
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/var\((--[\w-]+)/g)) if (!defined.has(m[1]) && !runtime.has(m[1])) missing.add(`${path.relative(WEB, f)}: ${m[1]}`);
    }
    expect([...missing]).toEqual([]);
  });

  it('uses Big Shoulders only through the display tokens', () => {
    const files = cssFiles(WEB).filter((f) => !f.endsWith('themes.css') && !f.endsWith('globals.css'));
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/Big Shoulders/);
  });
});
