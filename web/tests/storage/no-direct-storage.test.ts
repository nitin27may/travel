import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// Backs the ESLint rule (eslint.config.mjs) for the files lint does not reach quickly: no direct localStorage or sessionStorage
// outside lib/storage/safe.ts and lib/mine/storage.ts (review NAV-2 C1). Comments and strings that only name the word are fine.
const WEB = path.resolve(__dirname, '..', '..');
const ROOTS = ['app', 'components', 'lib'];
const ALLOWED = new Set([path.join('lib', 'storage', 'safe.ts'), path.join('lib', 'mine', 'storage.ts')]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('storage access goes through lib/storage/safe.ts', () => {
  it('has no code that touches localStorage or sessionStorage directly', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(path.join(WEB, root))) {
        const rel = path.relative(WEB, file);
        if (ALLOWED.has(rel)) continue;
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          const code = line.replace(/\/\*.*?\*\//g, '').replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\s\/\/.*$/, '');
          if (/\b(localStorage|sessionStorage)\b/.test(code.replace(/'[^']*'|`[^`]*`/g, ''))) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
