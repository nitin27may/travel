import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB } from '../helpers';

// Standing rule: the owner's email never goes in a request header. Every script's User-Agent names the project and the about page.
const ROOT = path.resolve(WEB, '..');
function files(dir: string, re: RegExp, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (['node_modules', '.cache', '__pycache__', '.next', 'out'].includes(n) || n.startsWith('.')) continue;
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) files(f, re, out);
    else if (re.test(n)) out.push(f);
  }
  return out;
}

describe('request headers carry no email address', () => {
  const sources = [...files(path.join(ROOT, 'tools'), /\.(py|sh|mjs|ts)$/), ...files(path.join(WEB, 'scripts'), /\.(mjs|ts)$/), ...files(path.join(ROOT, 'core', 'src'), /\.ts$/), ...files(path.join(ROOT, 'core', 'bin'), /\.ts$/), ...files(path.join(WEB, 'lib'), /\.(ts|tsx)$/)];
  it('finds the scripts', () => expect(sources.length).toBeGreaterThan(20));
  it('has no "@" in any User-Agent or Api-User-Agent', () => {
    const bad: string[] = [];
    for (const f of sources) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/(user-agent|\bUA\b\s*[=:])/i.test(line) && /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(line)) bad.push(`${path.relative(ROOT, f)}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
