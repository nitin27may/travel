import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const README = path.join(ROOT, 'docs', 'v2', 'build', 'public-site', 'README.md');
const SKIP = new Set(['node_modules', 'out', 'public', 'test-results', 'playwright-report', 'data-snapshots', 'prototype', '.git']);
const EXT = /\.(ts|tsx|mjs|js|py)$/;
const SKIP_FILES = new Set([path.join('web', 'tests', 'cons', 'env-table.test.ts'), path.join('tools', 'tests', 'test_hardcode_scan.py'), path.join('tools', 'cons', 'hardcode_scan.py')]);
// Names that belong to the shell, not to the product.
const IGNORE = new Set(['PATH']);

const PATTERNS = [
  /process\.env\.([A-Z][A-Z0-9_]*[A-Z0-9])\b/g,
  /process\.env\[\s*["']([A-Z][A-Z0-9_]*[A-Z0-9])["']\s*\]/g,
  /import\.meta\.env\.([A-Z][A-Z0-9_]*[A-Z0-9])\b/g,
  /\benv\.([A-Z][A-Z0-9_]{3,}[A-Z0-9])\b/g,
  /os\.environ(?:\.get)?[(\[]\s*["']([A-Z][A-Z0-9_]*[A-Z0-9])["']/g,
  /os\.getenv\(\s*["']([A-Z][A-Z0-9_]*[A-Z0-9])["']/g,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.next') || name.startsWith('.fixture') || name.startsWith('.generated')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}

/** Every environment variable name read in code, with where it was first seen. */
export function envNamesRead(): Map<string, string> {
  const found = new Map<string, string>();
  for (const dir of ['web', 'core', 'tools']) {
    for (const file of walk(path.join(ROOT, dir))) {
      const rel = path.relative(ROOT, file);
      if (SKIP_FILES.has(rel)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('#')) return;
        for (const re of PATTERNS) {
          for (const m of line.matchAll(re)) if (!found.has(m[1]!)) found.set(m[1]!, `${rel}:${i + 1}`);
        }
        const d = /\{([^}]*)\}\s*=\s*process\.env/.exec(line);
        if (d) for (const n of d[1]!.match(/[A-Z][A-Z0-9_]*[A-Z0-9]/g) ?? []) if (!found.has(n)) found.set(n, `${rel}:${i + 1}`);
      });
    }
  }
  return found;
}

/** The names in the first column of the "Environment variables" table. */
export function documentedEnvNames(): Set<string> {
  const text = readFileSync(README, 'utf8');
  const section = /^## Environment variables\b[\s\S]*?(?=^## |(?![\s\S]))/m.exec(text)?.[0] ?? '';
  const names = new Set<string>();
  for (const row of section.split('\n')) {
    if (!row.startsWith('|')) continue;
    for (const m of (row.split('|')[1] ?? '').matchAll(/`([A-Z][A-Z0-9_]*)`/g)) names.add(m[1]!);
  }
  return names;
}

describe('environment variables are documented (names only)', () => {
  it('has the Environment variables section with the phase B and 20 Oct names', () => {
    const doc = documentedEnvNames();
    for (const n of ['NEXT_PUBLIC_DATA_ADAPTER', 'CATALOGUE_STORE', 'SKIP_WEB_BUILD', 'PW_REUSE_SITE', 'PW_SITE_URL', 'NEXT_PUBLIC_CF_BEACON_TOKEN', 'TRAVEL_TODAY', 'HUB_TODAY', 'TRACKS_LOCKED', 'GLOBE_IMAGES_LOCKED', 'GLOBE_CITIES_LOCKED']) {
      expect(doc.has(n), `${n} is missing from the table`).toBe(true);
    }
  });

  it('lists every name read in web/, core/ and tools/', () => {
    const doc = documentedEnvNames();
    const missing = [...envNamesRead()].filter(([n]) => !doc.has(n) && !IGNORE.has(n)).map(([n, where]) => `${n} (${where})`);
    expect(missing, 'add a row to "Environment variables" in docs/v2/build/public-site/README.md').toEqual([]);
  });

  it('holds no value: a row never carries an assignment or a secret-looking string', () => {
    const text = readFileSync(README, 'utf8');
    const section = /^## Environment variables\b[\s\S]*?(?=^## |(?![\s\S]))/m.exec(text)?.[0] ?? '';
    expect(section).not.toMatch(/`[A-Z][A-Z0-9_]*=[^`]+`/);
    expect(section).not.toMatch(/\b(sk|pk|AIza|ghp)[-_A-Za-z0-9]{16,}/);
  });
});
